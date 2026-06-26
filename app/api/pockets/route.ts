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

    const sortedPockets = [...pockets].sort((a, b) => {
      if (a.type === 'MAIN') return -1;
      if (b.type === 'MAIN') return 1;
      return 0;
    });

    return NextResponse.json({
      success: true,
      message: 'Pockets retrieved',
      data: sortedPockets.map((p) => {
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
          allocation: p.allocation,
          color: p.color,
          icon: p.icon,
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
  allocation?: number;
  color?: string;
  icon?: string;
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
    const { pocketId, targetAmount, name, allocation, color, icon } = body;

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
        ...(allocation !== undefined && { allocation }),
        ...(color && { color }),
        ...(icon && { icon }),
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
        allocation: updated.allocation,
        color: updated.color,
        icon: updated.icon,
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

export async function POST(request: NextRequest) {
  try {
    const token = extractTokenFromHeader(request.headers.get('Authorization') || '');
    if (!token) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

    const decoded = verifyToken(token);
    if (!decoded) return NextResponse.json({ success: false, message: 'Invalid token' }, { status: 401 });

    const body = await request.json();
    const { name, targetAmount, allocation, color, icon } = body;

    if (!name) {
      return NextResponse.json({ success: false, message: 'Name is required' }, { status: 400 });
    }

    // Check plan limits
    const sub = await prisma.subscription.findUnique({ where: { userId: decoded.userId } });
    const isPremium = sub?.plan === 'PREMIUM' || sub?.plan === 'STUDENT';
    
    if (!isPremium) {
      const pocketCount = await prisma.pocket.count({ where: { userId: decoded.userId } });
      if (pocketCount >= 4) { // Trial has the 4 default pockets, cannot add more
        return NextResponse.json({ success: false, message: 'Maksimal 4 kantong untuk akun Trial. Silakan upgrade Premium!' }, { status: 403 });
      }
    }

    const pocket = await prisma.pocket.create({
      data: {
        userId: decoded.userId,
        name,
        type: 'CUSTOM',
        targetAmount: targetAmount || null,
        allocation: allocation || 0,
        color: color || '#6366f1',
        icon: icon || 'Wallet',
        balance: 0,
      }
    });

    return NextResponse.json({ success: true, message: 'Pocket created', data: pocket }, { status: 201 });
  } catch (error) {
    console.error('Create pocket error:', error);
    return NextResponse.json({ success: false, message: 'Internal error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const token = extractTokenFromHeader(request.headers.get('Authorization') || '');
    if (!token) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

    const decoded = verifyToken(token);
    if (!decoded) return NextResponse.json({ success: false, message: 'Invalid token' }, { status: 401 });

    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    if (!id) return NextResponse.json({ success: false, message: 'Pocket ID required' }, { status: 400 });

    const pocket = await prisma.pocket.findUnique({ where: { id } });
    if (!pocket || pocket.userId !== decoded.userId) {
      return NextResponse.json({ success: false, message: 'Not found' }, { status: 404 });
    }

    if (pocket.balance.toNumber() > 0) {
      return NextResponse.json({ success: false, message: 'Tidak bisa menghapus kantong yang masih bersaldo' }, { status: 400 });
    }
    
    if (pocket.type !== 'CUSTOM') {
       return NextResponse.json({ success: false, message: 'Tidak bisa menghapus kantong utama/bawaan' }, { status: 400 });
    }

    await prisma.pocket.delete({ where: { id } });

    return NextResponse.json({ success: true, message: 'Pocket deleted' });
  } catch (error) {
    console.error('Delete pocket error:', error);
    return NextResponse.json({ success: false, message: 'Internal error' }, { status: 500 });
  }
}
