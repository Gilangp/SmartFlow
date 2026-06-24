import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { hashPassword, generateToken } from '@/lib/auth';
import { RegisterRequest, AuthResponse } from '@/types';
import { assignTrialSubscription, upgradeToStudent, isStudentEmail } from '@/lib/subscription';
import { verifyOtp } from '@/lib/otp';


// Set to true to require email OTP verification on register
const ENABLE_OTP = false;

// 🔹 Helper
function errorResponse(message: string, status: number) {
  return NextResponse.json({ success: false, message }, { status });
}

export async function POST(
  request: NextRequest
): Promise<NextResponse<AuthResponse>> {
  try {
    const body: RegisterRequest = await request.json();
    const { name, email, password, paydayDate, otpCode } = body;

    // 🔹 VALIDATION
    if (!name || !email || !password) {
      return errorResponse('Missing required fields', 400);
    }

    if (typeof name !== 'string' || name.trim().length < 2) {
      return errorResponse('Name must be at least 2 characters', 400);
    }

    if (typeof password !== 'string' || password.length < 6) {
      return errorResponse('Password must be at least 6 characters', 400);
    }

    const normalizedEmail = email.toLowerCase().trim();

    // 🔹 VERIFY OTP BEFORE ANYTHING (If OTP is enabled)
    if (ENABLE_OTP) {
      if (!otpCode) {
        return errorResponse('Kode OTP diperlukan', 400);
      }
      const otpResult = await verifyOtp(normalizedEmail, String(otpCode).trim(), 'REGISTER');
      if (!otpResult.valid) {
        return errorResponse(otpResult.reason || 'Kode OTP tidak valid', 400);
      }
    }

    // 🔹 CHECK EXISTING USER
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      return errorResponse('Email already registered', 409);
    }

    // 🔹 HASH PASSWORD
    const hashedPassword = await hashPassword(password);

    // 🔥 TRANSACTION (INI WAJIB)
    const result = await prisma.$transaction(async (tx) => {
      // Create user
      const user = await tx.user.create({
        data: {
          name: name.trim(),
          email: normalizedEmail,
          password: hashedPassword,
          paydayDate: paydayDate || 1,
          themePreference: 'light',
        },
      });

      // Create pockets (bulk insert)
      await tx.pocket.createMany({
        data: [
          {
            userId: user.id,
            name: 'Dompet Utama',
            type: 'MAIN',
            balance: 0,
            allocation: 70,
            color: '#6366f1',
            icon: 'Wallet',
          },
          {
            userId: user.id,
            name: 'Tabungan',
            type: 'SAVINGS',
            balance: 0,
            allocation: 30,
            color: '#10b981',
            icon: 'PiggyBank',
          },
        ],
      });

      return user;
    });

    // 🔹 AUTO-ASSIGN SUBSCRIPTION
    // Jika email .ac.id → langsung Student (gratis selamanya)
    // Selain itu → Trial 14 hari
    if (isStudentEmail(normalizedEmail)) {
      await upgradeToStudent(result.id);
    } else {
      await assignTrialSubscription(result.id);
    }


    // 🔹 TOKEN
    const token = generateToken(result.id, result.email);

    return NextResponse.json(
      {
        success: true,
        message: 'Registration successful',
        token,
        user: {
          id: result.id,
          name: result.name,
          email: result.email,
          themePreference: result.themePreference as 'light' | 'dark',
          paydayDate: result.paydayDate || undefined,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Registration error:', error);

    return NextResponse.json(
      {
        success: false,
        message: 'Internal server error',
      },
      { status: 500 }
    );
  }
}