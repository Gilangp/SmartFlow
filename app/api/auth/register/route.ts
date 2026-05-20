import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { hashPassword, generateToken } from '@/lib/auth';
import { RegisterRequest, AuthResponse } from '@/types';

export async function POST(request: NextRequest): Promise<NextResponse<AuthResponse>> {
  try {
    const body: RegisterRequest = await request.json();
    const { name, email, password, paydayDate } = body;

    // Validate input
    if (!name || !email || !password) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { success: false, message: 'Email already registered' },
        { status: 409 }
      );
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create user
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        paydayDate: paydayDate || 1,
        themePreference: 'light',
      },
    });

    // Create default pockets (FR-PKT-01 through FR-PKT-04)
    const pocketTypes = [
      { name: 'Dompet Utama', type: 'MAIN' },
      { name: 'Dana Darurat', type: 'EMERGENCY', targetAmount: 500000 },
      { name: 'Tabungan Aset', type: 'SAVINGS' },
      { name: 'Wishlist', type: 'WISHLIST', targetAmount: 0 },
    ];

    for (const pocket of pocketTypes) {
      await prisma.pocket.create({
        data: {
          userId: user.id,
          name: pocket.name,
          type: pocket.type as any,
          balance: 0,
          targetAmount: pocket.targetAmount || null,
        },
      });
    }

    // Generate token
    const token = generateToken(user.id, user.email);

    return NextResponse.json(
      {
        success: true,
        message: 'Registration successful',
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          themePreference: user.themePreference as 'light' | 'dark',
          paydayDate: user.paydayDate || undefined,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { success: false, message: 'Registration failed', error: String(error) },
      { status: 500 }
    );
  }
}
