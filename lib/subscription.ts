import { prisma } from '@/lib/db';

export type PlanName = 'TRIAL' | 'STUDENT' | 'PREMIUM';

export interface SubscriptionInfo {
  plan: PlanName;
  status: string;
  isActive: boolean;
  isExpired: boolean;
  expiresAt: Date | null;
  daysLeft: number | null;  // null = unlimited
  limits: PlanLimits;
}

export interface PlanLimits {
  maxTransactionsPerMonth: number | null; // null = unlimited
  canExportExcel: boolean;
  canScanReceipt: boolean;
  canUseAI: boolean;
  prioritySupport: boolean;
}

// ============================================================================
// Batas fitur per paket
// ============================================================================
export const PLAN_LIMITS: Record<PlanName, PlanLimits> = {
  TRIAL: {
    maxTransactionsPerMonth: 50,
    canExportExcel: false,
    canScanReceipt: false,    // trial tidak bisa scan struk
    canUseAI: true,
    prioritySupport: false,
  },
  STUDENT: {
    maxTransactionsPerMonth: 200,
    canExportExcel: false,
    canScanReceipt: true,     // mahasiswa bisa scan struk
    canUseAI: true,
    prioritySupport: false,
  },
  PREMIUM: {
    maxTransactionsPerMonth: null, // unlimited
    canExportExcel: true,
    canScanReceipt: true,     // premium bisa scan struk
    canUseAI: true,
    prioritySupport: true,
  },
};

// ============================================================================
// Ambil status langganan user
// ============================================================================
export async function getUserSubscription(userId: string): Promise<SubscriptionInfo> {
  const sub = await prisma.subscription.findUnique({
    where: { userId },
  });

  // Default jika belum ada subscription (user lama sebelum fitur ini)
  if (!sub) {
    return {
      plan: 'TRIAL',
      status: 'EXPIRED',
      isActive: false,
      isExpired: true,
      expiresAt: null,
      daysLeft: 0,
      limits: PLAN_LIMITS.TRIAL,
    };
  }

  const now = new Date();
  const isExpired = sub.expiresAt ? sub.expiresAt < now : false;
  const isActive = sub.status === 'ACTIVE' && !isExpired;

  let daysLeft: number | null = null;
  if (sub.expiresAt) {
    const diff = sub.expiresAt.getTime() - now.getTime();
    daysLeft = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }

  return {
    plan: sub.plan as PlanName,
    status: sub.status,
    isActive,
    isExpired,
    expiresAt: sub.expiresAt,
    daysLeft,
    limits: PLAN_LIMITS[sub.plan as PlanName] || PLAN_LIMITS.TRIAL,
  };
}

// ============================================================================
// Cek apakah email adalah email kampus (.ac.id)
// ============================================================================
export function isStudentEmail(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase() || '';
  return domain.endsWith('.ac.id');
}

// ============================================================================
// Assign Trial saat user baru daftar (dipanggil di register)
// ============================================================================
export async function assignTrialSubscription(userId: string): Promise<void> {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 14); // +14 hari

  await prisma.subscription.create({
    data: {
      userId,
      plan: 'TRIAL',
      status: 'ACTIVE',
      startedAt: new Date(),
      expiresAt,
    },
  });
}

// ============================================================================
// Upgrade ke Student (setelah verifikasi KTM atau email .ac.id)
// ============================================================================
export async function upgradeToStudent(userId: string): Promise<void> {
  await prisma.subscription.upsert({
    where: { userId },
    update: {
      plan: 'STUDENT',
      status: 'ACTIVE',
      expiresAt: null, // unlimited
    },
    create: {
      userId,
      plan: 'STUDENT',
      status: 'ACTIVE',
      startedAt: new Date(),
      expiresAt: null,
    },
  });
}

// ============================================================================
// Upgrade ke Premium setelah pembayaran berhasil
// ============================================================================
export async function upgradeToPremium(userId: string): Promise<void> {
  const expiresAt = new Date();
  expiresAt.setMonth(expiresAt.getMonth() + 1); // +1 bulan

  await prisma.subscription.upsert({
    where: { userId },
    update: {
      plan: 'PREMIUM',
      status: 'ACTIVE',
      expiresAt,
    },
    create: {
      userId,
      plan: 'PREMIUM',
      status: 'ACTIVE',
      startedAt: new Date(),
      expiresAt,
    },
  });
}
