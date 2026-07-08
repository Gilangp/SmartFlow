/**
 * Prisma Seed Script
 * Run with: npx prisma db seed
 * Populates database with exactly 3 sample users: Trial, Student, and Premium
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Kosongkan database & seeding 3 user utama...');

  // 1. Kosongkan semua tabel dari riwayat lama
  // await prisma.dailyPerformance.deleteMany();
  // await prisma.incomeRecord.deleteMany();
  // await prisma.transaction.deleteMany();
  // await prisma.category.deleteMany();
  // await prisma.pocket.deleteMany();
  // await prisma.payment.deleteMany();
  // await prisma.ktmVerification.deleteMany();
  // await prisma.subscription.deleteMany();
  // await prisma.otpCode.deleteMany();
  // await prisma.user.deleteMany();

  console.log('✓ Database berhasil dikosongkan.');

  const hashedPassword = await bcrypt.hash('password123', 10);

  // Template 2 dompet bawaan sistem (Dompet Utama & Tabungan)
  const defaultPockets = [
    {
      name: 'Dompet Utama',
      type: 'MAIN',
      balance: 0,
      allocation: 70,
      color: '#6366f1',
      icon: 'Wallet',
    },
    {
      name: 'Tabungan',
      type: 'SAVINGS',
      balance: 0,
      allocation: 30,
      color: '#10b981',
      icon: 'PiggyBank',
    },
  ];

  // 2. User 1: TRIAL USER
  const trialUser = await prisma.user.create({
    data: {
      name: 'Trial User',
      email: 'trial@smartflow.test',
      password: hashedPassword,
      paydayDate: 1,
      themePreference: 'light',
      pockets: {
        create: defaultPockets,
      },
      subscription: {
        create: {
          plan: 'TRIAL',
          status: 'ACTIVE',
          startedAt: new Date(),
          expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 hari
        },
      },
    },
  });
  console.log(`✓ Created TRIAL User: ${trialUser.email} (Plan: TRIAL, Pockets: 2)`);

  // 3. User 2: STUDENT USER
  const studentUser = await prisma.user.create({
    data: {
      name: 'Student User',
      email: 'student@smartflow.test',
      password: hashedPassword,
      paydayDate: 1,
      themePreference: 'light',
      pockets: {
        create: defaultPockets,
      },
      subscription: {
        create: {
          plan: 'STUDENT',
          status: 'ACTIVE',
          startedAt: new Date(),
          expiresAt: null, // Gratis selamanya
        },
      },
    },
  });
  console.log(`✓ Created STUDENT User: ${studentUser.email} (Plan: STUDENT, Pockets: 2)`);

  // 4. User 3: PREMIUM USER
  const premiumUser = await prisma.user.create({
    data: {
      name: 'Premium User',
      email: 'premium@smartflow.test',
      password: hashedPassword,
      paydayDate: 1,
      themePreference: 'dark',
      pockets: {
        create: defaultPockets,
      },
      subscription: {
        create: {
          plan: 'PREMIUM',
          status: 'ACTIVE',
          startedAt: new Date(),
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 hari
        },
      },
    },
  });
  console.log(`✓ Created PREMIUM User: ${premiumUser.email} (Plan: PREMIUM, Pockets: 2)`);

  console.log('');
  console.log('✨ Seeding selesai!');
  console.log('Semua akun menggunakan password yang sama: password123');
  console.log('Daftar Akun Demo:');
  console.log('  1. Trial   -> trial@smartflow.test   | Plan: TRIAL');
  console.log('  2. Student -> student@smartflow.test | Plan: STUDENT');
  console.log('  3. Premium -> premium@smartflow.test | Plan: PREMIUM');
}

main()
  .catch((e) => {
    console.error('❌ Seeding gagal:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

