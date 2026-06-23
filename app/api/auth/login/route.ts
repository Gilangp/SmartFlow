import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { comparePasswords, generateToken } from '@/lib/auth';
import { LoginRequest, AuthResponse } from '@/types';

// 🔹 Helper: standardized response
function errorResponse(message: string, status: number) {
  return NextResponse.json(
    { success: false, message },
    { status }
  );
}

export async function POST(
  request: NextRequest
): Promise<NextResponse<AuthResponse>> {
  try {
    // 🔹 Parse body
    const body: LoginRequest = await request.json();
    const { email, password } = body;

    // 🔹 Basic validation
    if (!email || !password) {
      return errorResponse('Email and password are required', 400);
    }

    // 🔹 Normalize email (IMPORTANT)
    const normalizedEmail = email.toLowerCase().trim();

    // 🔹 Find user
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    // 🔥 Jangan kasih tau mana yang salah (security)
    if (!user || !user.password) {
      return errorResponse('Invalid email or password', 401);
    }

    // 🔹 Compare password
    const isValidPassword = await comparePasswords(
      password,
      user.password
    );

    if (!isValidPassword) {
      return errorResponse('Invalid email or password', 401);
    }

    // 🔹 Generate token
    const token = generateToken(user.id, user.email);

    // 🔹 Optional: last login update (good practice)
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return NextResponse.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        themePreference: user.themePreference as 'light' | 'dark',
        paydayDate: user.paydayDate || undefined,
      },
    });
  } catch (error) {
    console.error('Login error:', error);

    return NextResponse.json(
      {
        success: false,
        message: 'Internal server error',
      },
      { status: 500 }
    );
  }
}