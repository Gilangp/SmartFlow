import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
import { prisma } from '@/lib/db';

// 🔹 Helper: error response
function errorResponse(message: string, status: number) {
  return NextResponse.json({ success: false, message }, { status });
}

// 🔹 Helper: auth handler (biar gak copy-paste terus)
function getUserIdFromRequest(request: NextRequest): string | null {
  const token = extractTokenFromHeader(
    request.headers.get('Authorization') || ''
  );

  if (!token) return null;

  const decoded = verifyToken(token);
  if (!decoded) return null;

  // Ensure we always return a string since Prisma's id is typed as string
  return String((decoded as { userId: string | number }).userId);
}

export async function GET(request: NextRequest) {
  try {
    // 🔹 AUTH
    const userId = getUserIdFromRequest(request);

    if (!userId) {
      return errorResponse('Unauthorized', 401);
    }

    // 🔹 GET USER (select biar lebih efisien)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        themePreference: true,
        paydayDate: true,
        allocationEmergency: true,
        allocationSavings: true,
        allocationWishlist: true,
      },
    });

    if (!user) {
      return errorResponse('User not found', 404);
    }

    return NextResponse.json({
      success: true,
      message: 'User retrieved',
      data: user,
    });
  } catch (error) {
    console.error('Get user error:', error);

    return NextResponse.json(
      {
        success: false,
        message: 'Internal server error',
      },
      { status: 500 }
    );
  }
}