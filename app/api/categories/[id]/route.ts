import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
import { prisma } from '@/lib/db';

interface UpdateCategoryRequest {
  name?: string;
  type?: 'NEED' | 'WANT';
  pocketId?: string | null;
}

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

    const resolvedParams = await Promise.resolve(params);
    const categoryId = resolvedParams.id;

    const body: UpdateCategoryRequest = await request.json();

    // Verify ownership
    const category = await prisma.category.findUnique({
      where: { id: categoryId },
    });

    if (!category || category.userId !== decoded.userId) {
      return NextResponse.json(
        { success: false, message: 'Category not found' },
        { status: 404 }
      );
    }

    const updateData: {
      name?: string;
      type?: 'NEED' | 'WANT';
      pocketId?: string | null;
    } = {};

    if (body.name !== undefined && body.name !== category.name) {
      const existing = await prisma.category.findUnique({
        where: { userId_name: { userId: decoded.userId, name: body.name } },
      });
      if (existing) {
        return NextResponse.json(
          { success: false, message: 'Nama kategori sudah digunakan' },
          { status: 409 }
        );
      }
      updateData.name = body.name;
    } else if (body.name !== undefined) {
      updateData.name = body.name;
    }

    if (body.type !== undefined) updateData.type = body.type;
    if (body.pocketId !== undefined) {
      // Convert empty string "" to null to avoid database foreign key violation
      updateData.pocketId = body.pocketId ? body.pocketId : null;
    }

    const updated = await prisma.category.update({
      where: { id: categoryId },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      message: 'Category updated',
      data: {
        id: updated.id,
        name: updated.name,
        type: updated.type,
      },
    });
  } catch (error) {
    console.error('Update category error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to update category', error: String(error) },
      { status: 500 }
    );
  }
}

export async function DELETE(
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

    const resolvedParams = await Promise.resolve(params);
    const categoryId = resolvedParams.id;

    // Verify ownership
    const category = await prisma.category.findUnique({
      where: { id: categoryId },
    });

    if (!category || category.userId !== decoded.userId) {
      return NextResponse.json(
        { success: false, message: 'Category not found' },
        { status: 404 }
      );
    }

    // Check if category is used
    const transactionCount = await prisma.transaction.count({
      where: { categoryId: categoryId },
    });

    if (transactionCount > 0) {
      return NextResponse.json(
        { success: false, message: 'Cannot delete category with existing transactions' },
        { status: 409 }
      );
    }

    await prisma.category.delete({
      where: { id: categoryId },
    });

    return NextResponse.json({
      success: true,
      message: 'Category deleted',
    });
  } catch (error) {
    console.error('Delete category error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to delete category', error: String(error) },
      { status: 500 }
    );
  }
}
