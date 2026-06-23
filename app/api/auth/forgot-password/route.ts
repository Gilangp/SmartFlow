import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createOtp } from '@/lib/otp';
import { sendResetPasswordOtp } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ success: false, message: 'Email diperlukan' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check user exists — but DON'T reveal if not found (security)
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (!user) {
      // Return success anyway to prevent email enumeration
      return NextResponse.json({
        success: true,
        message: 'Jika email terdaftar, kode OTP akan dikirim',
      });
    }

    // Generate OTP and send email
    const code = await createOtp(normalizedEmail, 'RESET_PASSWORD');
    await sendResetPasswordOtp(normalizedEmail, code);

    return NextResponse.json({
      success: true,
      message: 'Kode OTP telah dikirim ke email kamu',
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    return NextResponse.json(
      { success: false, message: 'Terjadi kesalahan. Coba lagi.' },
      { status: 500 }
    );
  }
}
