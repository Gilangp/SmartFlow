import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
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

    // Next.js 15+ changes params to a Promise, but let's handle both
    const resolvedParams = await Promise.resolve(params);
    const pocketId = resolvedParams.id;
    
    if (!pocketId) {
       return NextResponse.json(
        { success: false, message: 'Pocket ID is required' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { targetAmount, allocation } = body;

    if (targetAmount === undefined && allocation === undefined) {
      return NextResponse.json(
        { success: false, message: 'No data to update' },
        { status: 400 }
      );
    }

    // Verify pocket belongs to user
    const pocket = await prisma.pocket.findUnique({
      where: { id: pocketId }
    });

    if (!pocket || pocket.userId !== decoded.userId) {
      return NextResponse.json(
        { success: false, message: 'Pocket not found or unauthorized' },
        { status: 404 }
      );
    }

    if (targetAmount !== undefined && pocket.type !== 'EMERGENCY' && pocket.type !== 'WISHLIST' && pocket.type !== 'CUSTOM') {
      return NextResponse.json(
        { success: false, message: 'This pocket cannot have a target amount' },
        { status: 400 }
      );
    }

    const updatedPocket = await prisma.pocket.update({
      where: { id: pocketId },
      data: { 
        ...(targetAmount !== undefined && { targetAmount }),
        ...(allocation !== undefined && { allocation })
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Pocket updated successfully',
      data: {
        id: updatedPocket.id,
        name: updatedPocket.name,
        targetAmount: updatedPocket.targetAmount?.toNumber(),
        allocation: updatedPocket.allocation,
      }
    });

  } catch (error) {
    console.error('Update pocket target error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to update pocket', error: String(error) },
      { status: 500 }
    );
  }
}
