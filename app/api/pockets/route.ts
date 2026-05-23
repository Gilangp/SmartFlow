import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
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

    const pockets = await prisma.pocket.findMany({
      where: { userId: decoded.userId },
    });

    return NextResponse.json({
      success: true,
      message: 'Pockets retrieved',
      data: pockets.map((p) => {
        const balance = p.balance.toNumber();
        let progressPercentage = undefined;

        if (p.targetAmount) {
          const target = p.targetAmount.toNumber();
          progressPercentage = target > 0 ? (balance / target) * 100 : 0;
        }

        return {
          id: p.id,
          name: p.name,
          type: p.type,
          balance,
          targetAmount: p.targetAmount?.toNumber(),
          status: p.status,
          progressPercentage,
        };
      }),
    });
  } catch (error) {
    console.error('Get pockets error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to retrieve pockets', error: String(error) },
      { status: 500 }
    );
  }
}

interface UpdatePocketRequest {
  targetAmount?: number;
  name?: string;
}

export async function PUT(request: NextRequest) {
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

    const body: UpdatePocketRequest & { pocketId: string } = await request.json();
    const { pocketId, targetAmount, name } = body;

    // Verify ownership
    const pocket = await prisma.pocket.findUnique({
      where: { id: pocketId },
    });

    if (!pocket || pocket.userId !== decoded.userId) {
      return NextResponse.json(
        { success: false, message: 'Pocket not found' },
        { status: 404 }
      );
    }

    const updated = await prisma.pocket.update({
      where: { id: pocketId },
      data: {
        ...(targetAmount !== undefined && { targetAmount }),
        ...(name && { name }),
      },
    });

    const balance = updated.balance.toNumber();
    const target = updated.targetAmount?.toNumber();
    const progressPercentage = target ? (balance / target) * 100 : undefined;

    return NextResponse.json({
      success: true,
      message: 'Pocket updated',
      data: {
        id: updated.id,
        name: updated.name,
        type: updated.type,
        balance,
        targetAmount: target,
        status: updated.status,
        progressPercentage,
      },
    });
  } catch (error) {
    console.error('Update pocket error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to update pocket', error: String(error) },
      { status: 500 }
    );
  }
}
