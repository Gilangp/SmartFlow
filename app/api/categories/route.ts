import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
import { prisma } from '@/lib/db';

interface CreateCategoryRequest {
  name: string;
  type: 'NEED' | 'WANT';
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
    const { name, type } = body;

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
