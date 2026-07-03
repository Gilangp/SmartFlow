import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const token = extractTokenFromHeader(request.headers.get('Authorization') || '');
    if (!token) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

    const decoded = verifyToken(token);
    if (!decoded) return NextResponse.json({ success: false, message: 'Invalid token' }, { status: 401 });

    const body = await request.json();
    const { sourceId, targetId, amount } = body;

    if (!sourceId || !targetId || !amount || amount <= 0) {
      return NextResponse.json({ success: false, message: 'Invalid request' }, { status: 400 });
    }

    if (sourceId === targetId) {
      return NextResponse.json({ success: false, message: 'Source and target must be different' }, { status: 400 });
    }

    // Atomic transaction
    const result = await prisma.$transaction(async (tx) => {
      const source = await tx.pocket.findUnique({ where: { id: sourceId } });
      const target = await tx.pocket.findUnique({ where: { id: targetId } });

      if (!source || source.userId !== decoded.userId || !target || target.userId !== decoded.userId) {
        throw new Error('Pocket not found');
      }

      if (source.balance.toNumber() < amount) {
        throw new Error('Insufficient balance');
      }

      // 1. Create transfer out from source
      await tx.transaction.create({
        data: {
          userId: decoded.userId,
          pocketId: sourceId,
          type: 'TRANSFER',
          amount,
          date: new Date(),
          notes: `Transfer ke ${target.name}`,
        }
      });

      // 2. Create transfer in to target
      await tx.transaction.create({
        data: {
          userId: decoded.userId,
          pocketId: targetId,
          type: 'TRANSFER',
          amount,
          date: new Date(),
          notes: `Transfer dari ${source.name}`,
        }
      });

      // 3. Update balances
      await tx.pocket.update({
        where: { id: sourceId },
        data: { balance: source.balance.minus(amount) }
      });

      await tx.pocket.update({
        where: { id: targetId },
        data: { balance: target.balance.plus(amount) }
      });

      return true;
    });

    return NextResponse.json({ success: true, message: 'Transfer successful' });

  } catch (error: any) {
    console.error('Transfer error:', error);
    return NextResponse.json({ success: false, message: error.message || 'Internal error' }, { status: 500 });
  }
}
