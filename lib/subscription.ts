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
  wasPremiumExpired?: boolean; // True jika langganan Premium sudah berakhir & ter-demosi
}

export interface PlanLimits {
  maxTransactionsPerMonth: number | null; // null = unlimited
  maxAiChatsPerDay: number | null;        // null = unlimited
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
    maxAiChatsPerDay: 10,       // Max 10 chat AI per hari untuk Trial (Hemat biaya pengembang!)
    canExportExcel: false,
    canScanReceipt: false,    // trial tidak bisa scan struk
    canUseAI: true,
    prioritySupport: false,
  },
  STUDENT: {
    maxTransactionsPerMonth: 200,
    maxAiChatsPerDay: 50,       // Max 50 chat AI per hari untuk Mahasiswa
    canExportExcel: false,
    canScanReceipt: true,     // mahasiswa bisa scan struk
    canUseAI: true,
    prioritySupport: false,
  },
  PREMIUM: {
    maxTransactionsPerMonth: null, // unlimited
    maxAiChatsPerDay: null,       // unlimited chat AI untuk Premium
    canExportExcel: true,
    canScanReceipt: true,     // premium bisa scan struk
    canUseAI: true,
    prioritySupport: true,
  },
};

// ============================================================================
// Ambil status langganan user (Dengan Opsi A: Graceful Fallback jika Premium Habis)
// ============================================================================
export async function getUserSubscription(userId: string): Promise<SubscriptionInfo> {
  const sub = await prisma.subscription.findUnique({
    where: { userId },
    include: {
      user: {
        include: {
          ktmVerification: true,
        },
      },
    },
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
  let isExpired = sub.expiresAt ? sub.expiresAt < now : false;
  let currentPlan = sub.plan as PlanName;
  let currentStatus = sub.status;
  let wasPremiumExpired = false;

  // 🔹 OPSI A: Jika Paket PREMIUM sudah berakhir (expiresAt < now)
  if (sub.plan === 'PREMIUM' && isExpired) {
    wasPremiumExpired = true;

    // Cek apakah pengguna punya verifikasi KTM yang APPROVED atau email .ac.id
    const hasApprovedKtm = sub.user?.ktmVerification?.status === 'APPROVED';
    const hasStudentEmail = isStudentEmail(sub.user?.email || '');

    if (hasApprovedKtm || hasStudentEmail) {
      // 🎓 Mahasiswa: Otomatis kembali ke Paket STUDENT (Gratis Selamanya)
      currentPlan = 'STUDENT';
      currentStatus = 'ACTIVE';
      isExpired = false;
    } else {
      // 👤 Umum: Otomatis kembali ke Paket TRIAL (Expired)
      currentPlan = 'TRIAL';
      currentStatus = 'EXPIRED';
      isExpired = true;
    }
  }

  const isActive = currentStatus === 'ACTIVE' && !isExpired;

  let daysLeft: number | null = null;
  if (sub.expiresAt && !isExpired) {
    const diff = sub.expiresAt.getTime() - now.getTime();
    daysLeft = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }

  return {
    plan: currentPlan,
    status: currentStatus,
    isActive,
    isExpired,
    expiresAt: sub.expiresAt,
    daysLeft,
    limits: PLAN_LIMITS[currentPlan] || PLAN_LIMITS.TRIAL,
    wasPremiumExpired,
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
