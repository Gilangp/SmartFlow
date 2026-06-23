import { prisma } from '@/lib/db';
import crypto from 'crypto';

const OTP_EXPIRY_MINUTES = 5;

// ============================================================================
// Generate a cryptographically secure 6-digit OTP
// ============================================================================
export function generateOtpCode(): string {
  // Use crypto for secure random number (000000 - 999999)
  const buffer = crypto.randomBytes(4);
  const num = buffer.readUInt32BE(0) % 1000000;
  return num.toString().padStart(6, '0');
}

// ============================================================================
// Save OTP to DB (replaces any previous OTP for same email+purpose)
// ============================================================================
export async function createOtp(email: string, purpose: 'REGISTER' | 'RESET_PASSWORD'): Promise<string> {
  const code = generateOtpCode();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  // Delete any previous unused OTPs for this email+purpose
  await prisma.otpCode.deleteMany({
    where: { email: email.toLowerCase(), purpose, usedAt: null },
  });

  // Create new OTP
  await prisma.otpCode.create({
    data: {
      email: email.toLowerCase(),
      code,
      purpose,
      expiresAt,
    },
  });

  // Run cleanup in background asynchronously to prevent database bloat
  cleanupExpiredOtps().catch((err) => console.error('Failed to run OTP cleanup:', err));

  return code;
}

// ============================================================================
// Verify OTP — returns true if valid, marks as used
// ============================================================================
export async function verifyOtp(
  email: string,
  code: string,
  purpose: 'REGISTER' | 'RESET_PASSWORD'
): Promise<{ valid: boolean; reason?: string }> {
  const otp = await prisma.otpCode.findFirst({
    where: {
      email: email.toLowerCase(),
      code,
      purpose,
      usedAt: null,
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!otp) {
    return { valid: false, reason: 'Kode OTP tidak valid' };
  }

  if (otp.expiresAt < new Date()) {
    return { valid: false, reason: 'Kode OTP sudah kedaluwarsa. Minta kode baru.' };
  }

  // Mark OTP as used
  await prisma.otpCode.update({
    where: { id: otp.id },
    data: { usedAt: new Date() },
  });

  return { valid: true };
}

// ============================================================================
// Check if a valid OTP exists (without consuming it) — for UX hints
// ============================================================================
export async function hasValidOtp(email: string, purpose: 'REGISTER' | 'RESET_PASSWORD'): Promise<boolean> {
  const otp = await prisma.otpCode.findFirst({
    where: {
      email: email.toLowerCase(),
      purpose,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
  });
  return !!otp;
}

// ============================================================================
// Cleanup expired OTPs (can be called periodically)
// ============================================================================
export async function cleanupExpiredOtps(): Promise<void> {
  await prisma.otpCode.deleteMany({
    where: {
      OR: [
        { expiresAt: { lt: new Date() } },
        { usedAt: { not: null } },
      ],
    },
  });
}
