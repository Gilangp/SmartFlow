import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
import { prisma } from '@/lib/db';

// 🔹 Helper
function errorResponse(message: string, status: number) {
  return NextResponse.json({ success: false, message }, { status });
}

function getUserId(request: NextRequest): string | null {
  const token = extractTokenFromHeader(
    request.headers.get('Authorization') || ''
  );
  if (!token) return null;

  const decoded = verifyToken(token);
  if (!decoded || decoded.userId == null) return null;

  return String(decoded.userId);
}

// 🔹 Clamp percentage
function clampPercent(value: number) {
  return Math.max(0, Math.min(100, value));
}

export async function PATCH(request: NextRequest) {
  try {
    // 🔹 AUTH
    const userId = getUserId(request);
    if (!userId) {
      return errorResponse('Unauthorized', 401);
    }

    // 🔹 BODY
    const body = await request.json();
    const {
      name,
      paydayDate,
      themePreference,
      allocationEmergency,
      allocationSavings,
      allocationWishlist,
    } = body;

    const dataToUpdate: Record<string, any> = {};

    // 🔹 VALIDATION

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length < 2) {
        return errorResponse('Name must be at least 2 characters', 400);
      }
      dataToUpdate.name = name.trim();
    }

    if (paydayDate !== undefined) {
      const parsed = Number(paydayDate);
      if (isNaN(parsed) || parsed < 1 || parsed > 31) {
        return errorResponse('Payday must be between 1-31', 400);
      }
      dataToUpdate.paydayDate = parsed;
    }

    if (themePreference !== undefined) {
      if (!['light', 'dark'].includes(themePreference)) {
        return errorResponse('Invalid theme', 400);
      }
      dataToUpdate.themePreference = themePreference;
    }

    if (allocationEmergency !== undefined) {
      if (typeof allocationEmergency !== 'number') {
        return errorResponse('Invalid allocationEmergency', 400);
      }
      dataToUpdate.allocationEmergency = clampPercent(allocationEmergency).toString();
    }

    if (allocationSavings !== undefined) {
      if (typeof allocationSavings !== 'number') {
        return errorResponse('Invalid allocationSavings', 400);
      }
      dataToUpdate.allocationSavings = clampPercent(allocationSavings).toString();
    }

    if (allocationWishlist !== undefined) {
      if (typeof allocationWishlist !== 'number') {
        return errorResponse('Invalid allocationWishlist', 400);
      }
      dataToUpdate.allocationWishlist = clampPercent(allocationWishlist).toString();
    }

    // 🔥 VALIDASI TOTAL ALOKASI (INI PENTING BANGET)
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        allocationEmergency: true,
        allocationSavings: true,
        allocationWishlist: true,
      },
    });

    if (!currentUser) {
      return errorResponse('User not found', 404);
    }

    const totalAllocation =
      Number(dataToUpdate.allocationEmergency ?? currentUser.allocationEmergency ?? 0) +
      Number(dataToUpdate.allocationSavings ?? currentUser.allocationSavings ?? 0) +
      Number(dataToUpdate.allocationWishlist ?? currentUser.allocationWishlist ?? 0);

    if (totalAllocation > 100) {
      return errorResponse('Total allocation cannot exceed 100%', 400);
    }

    // 🔹 UPDATE
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: dataToUpdate,
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

    return NextResponse.json({
      success: true,
      message: 'Profile updated successfully',
      data: updatedUser,
    });
  } catch (error) {
    console.error('Update profile error:', error);

    return NextResponse.json(
      {
        success: false,
        message: 'Internal server error',
      },
      { status: 500 }
    );
  }
}