import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyOtp } from '@/lib/otp';
import { hashPassword } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const { email, code, newPassword } = await request.json();

    if (!email || !code || !newPassword) {
      return NextResponse.json(
        { success: false, message: 'Email, kode OTP, dan password baru diperlukan' },
        { status: 400 }
      );
    }

    if (typeof newPassword !== 'string' || newPassword.length < 6) {
      return NextResponse.json(
        { success: false, message: 'Password baru minimal 6 karakter' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Verify OTP
    const result = await verifyOtp(normalizedEmail, code.trim(), 'RESET_PASSWORD');
    if (!result.valid) {
      return NextResponse.json({ success: false, message: result.reason }, { status: 400 });
    }

    // Check user exists
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user) {
      return NextResponse.json({ success: false, message: 'Akun tidak ditemukan' }, { status: 404 });
    }

    // Hash new password and update
    const hashedPassword = await hashPassword(newPassword);
    await prisma.user.update({
      where: { email: normalizedEmail },
      data: { password: hashedPassword },
    });

    return NextResponse.json({
      success: true,
      message: 'Password berhasil direset. Silakan login.',
    });
  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json(
      { success: false, message: 'Terjadi kesalahan. Coba lagi.' },
      { status: 500 }
    );
  }
}
