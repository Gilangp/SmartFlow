import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const token = extractTokenFromHeader(request.headers.get('Authorization') || '');

    if (!token) {
      return NextResponse.json(
        { success: false, message: 'No token provided' },
        { status: 401 }
      );
    }

    const decoded = verifyToken(token);

    if (!decoded) {
      return NextResponse.json(
        { success: false, message: 'Invalid token' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { performanceId, action, targetPocketType, targetPocketId } = body;

    if (!performanceId || !action) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get performance
    const performance = await prisma.dailyPerformance.findUnique({
      where: { id: performanceId },
    });

    if (!performance || performance.userId !== decoded.userId) {
      return NextResponse.json(
        { success: false, message: 'Performance record not found' },
        { status: 404 }
      );
    }

    if (performance.surplusTransferred !== null) {
      return NextResponse.json(
        { success: false, message: 'Rollover already processed for this date' },
        { status: 400 }
      );
    }

    const surplus = performance.dailyAllowance.toNumber() - performance.totalSpent.toNumber();

    if (surplus <= 0) {
      return NextResponse.json(
        { success: false, message: 'No surplus to rollover' },
        { status: 400 }
      );
    }

    if (action === 'CARRY_OVER') {
      await prisma.dailyPerformance.update({
        where: { id: performanceId },
        data: { surplusTransferred: 0 },
      });
      return NextResponse.json({ success: true, message: 'Surplus carried over successfully' });
    }

    if (action === 'TRANSFER') {
      if (!targetPocketType && !targetPocketId) {
        return NextResponse.json({ success: false, message: 'Target pocket required for transfer' }, { status: 400 });
      }

      const allPockets = await prisma.pocket.findMany({
        where: { userId: decoded.userId },
      });

      const mainPocket = allPockets.find((p) => p.type === 'MAIN');
      const targetPocket = targetPocketId
        ? allPockets.find((p) => p.id === targetPocketId)
        : allPockets.find((p) => p.type === targetPocketType);

      if (!mainPocket || !targetPocket) {
        return NextResponse.json({ success: false, message: 'Pockets not found' }, { status: 404 });
      }

      if (targetPocket.id === mainPocket.id) {
        return NextResponse.json({ success: false, message: 'Cannot transfer rollover to main pocket' }, { status: 400 });
      }

      await prisma.$transaction([
        // Out from MAIN
        prisma.transaction.create({
          data: {
            userId: decoded.userId,
            pocketId: mainPocket.id,
            type: 'TRANSFER',
            amount: surplus,
            date: new Date(),
            notes: `Rollover transfer to ${targetPocket.name}`,
          },
        }),
        // In to TARGET
        prisma.transaction.create({
          data: {
            userId: decoded.userId,
            pocketId: targetPocket.id,
            type: 'TRANSFER',
            amount: surplus,
            date: new Date(),
            notes: `Rollover received from MAIN`,
          },
        }),
        // Update MAIN balance
        prisma.pocket.update({
          where: { id: mainPocket.id },
          data: { balance: mainPocket.balance.minus(surplus) },
        }),
        // Update TARGET balance
        prisma.pocket.update({
          where: { id: targetPocket.id },
          data: { balance: targetPocket.balance.plus(surplus) },
        }),
        // Update Performance
        prisma.dailyPerformance.update({
          where: { id: performanceId },
          data: { surplusTransferred: surplus },
        }),
      ]);

      return NextResponse.json({ success: true, message: 'Rollover transfer successful' });
    }

    return NextResponse.json({ success: false, message: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('Rollover error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to process rollover', error: String(error) },
      { status: 500 }
    );
  }
}
