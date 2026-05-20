import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function PATCH(request: NextRequest) {
  try {
    const token = extractTokenFromHeader(request.headers.get('Authorization') || '');
    if (!token) {
      return NextResponse.json({ success: false, message: 'No token provided' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ success: false, message: 'Invalid token' }, { status: 401 });
    }

    const body = await request.json();
    const { name, paydayDate, themePreference, allocationEmergency, allocationSavings, allocationWishlist } = body;

    const dataToUpdate: any = {};
    if (name) dataToUpdate.name = name;
    if (paydayDate !== undefined) dataToUpdate.paydayDate = paydayDate;
    if (themePreference) dataToUpdate.themePreference = themePreference;
    if (allocationEmergency !== undefined) dataToUpdate.allocationEmergency = Math.max(0, Math.min(100, allocationEmergency));
    if (allocationSavings !== undefined) dataToUpdate.allocationSavings = Math.max(0, Math.min(100, allocationSavings));
    if (allocationWishlist !== undefined) dataToUpdate.allocationWishlist = Math.max(0, Math.min(100, allocationWishlist));

    const updatedUser = await prisma.user.update({
      where: { id: decoded.userId },
      data: dataToUpdate,
    });

    return NextResponse.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        themePreference: updatedUser.themePreference,
        paydayDate: updatedUser.paydayDate,
        allocationEmergency: updatedUser.allocationEmergency,
        allocationSavings: updatedUser.allocationSavings,
        allocationWishlist: updatedUser.allocationWishlist,
      },
    });
  } catch (error) {
    console.error('Update profile error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to update profile', error: String(error) },
      { status: 500 }
    );
  }
}
