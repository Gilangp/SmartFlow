import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createOtp } from '@/lib/otp';
import { sendRegisterOtp } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    const { email, name } = await request.json();

    if (!email || !name) {
      return NextResponse.json({ success: false, message: 'Email dan nama diperlukan' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if email already registered
    const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existingUser) {
      return NextResponse.json({ success: false, message: 'Email sudah terdaftar' }, { status: 409 });
    }

    // Generate OTP and send email
    const code = await createOtp(normalizedEmail, 'REGISTER');
    await sendRegisterOtp(normalizedEmail, code, name.trim());

    return NextResponse.json({
      success: true,
      message: 'Kode OTP telah dikirim ke email kamu',
    });
  } catch (error) {
    console.error('Send register OTP error:', error);
    return NextResponse.json(
      { success: false, message: 'Terjadi kesalahan. Coba lagi.' },
      { status: 500 }
    );
  }
}
