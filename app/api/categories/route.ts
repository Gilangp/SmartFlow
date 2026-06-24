import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

interface CreateCategoryRequest {
  name: string;
  type: 'NEED' | 'WANT';
  pocketId?: string | null;
}

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

    const body: CreateCategoryRequest = await request.json();
    const { name, type, pocketId } = body;

    if (!name || !type) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check for duplicate
    const existing = await prisma.category.findUnique({
      where: { userId_name: { userId: decoded.userId, name } },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, message: 'Category already exists' },
        { status: 409 }
      );
    }

    const category = await prisma.category.create({
      data: {
        userId: decoded.userId,
        name,
        type,
        pocketId: pocketId || null,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Category created',
        data: {
          id: category.id,
          name: category.name,
          type: category.type,
          pocketId: category.pocketId,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Create category error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to create category', error: String(error) },
      { status: 500 }
    );
  }
}

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

    const categories = await prisma.category.findMany({
      where: { userId: decoded.userId },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({
      success: true,
      message: 'Categories retrieved',
      data: categories.map((c) => ({
        id: c.id,
        name: c.name,
        type: c.type,
        pocketId: c.pocketId,
      })),
    });
  } catch (error) {
    console.error('Get categories error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to retrieve categories', error: String(error) },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const token = extractTokenFromHeader(request.headers.get('Authorization') || '');
    if (!token) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

    const decoded = verifyToken(token);
    if (!decoded) return NextResponse.json({ success: false, message: 'Invalid token' }, { status: 401 });

    const body = await request.json();
    const { id, name, type, pocketId } = body;

    if (!id) return NextResponse.json({ success: false, message: 'Category ID is required' }, { status: 400 });

    const existing = await prisma.category.findUnique({ where: { id } });
    if (!existing || existing.userId !== decoded.userId) {
      return NextResponse.json({ success: false, message: 'Category not found' }, { status: 404 });
    }

    const updated = await prisma.category.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(type && { type }),
        ...(pocketId !== undefined && { pocketId }),
      }
    });

    return NextResponse.json({ success: true, message: 'Category updated', data: updated });
  } catch (error) {
    console.error('Update category error:', error);
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

    if (!id) return NextResponse.json({ success: false, message: 'Category ID required' }, { status: 400 });

    const existing = await prisma.category.findUnique({ where: { id } });
    if (!existing || existing.userId !== decoded.userId) {
      return NextResponse.json({ success: false, message: 'Category not found' }, { status: 404 });
    }

    await prisma.category.delete({ where: { id } });

    return NextResponse.json({ success: true, message: 'Category deleted' });
  } catch (error) {
    console.error('Delete category error:', error);
    return NextResponse.json({ success: false, message: 'Internal error' }, { status: 500 });
  }
}
