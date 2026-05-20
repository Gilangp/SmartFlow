/**
 * Prisma Seed Script
 * Run with: npx prisma db seed
 * Populates database with sample data for development
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Clear existing data
  await prisma.dailyPerformance.deleteMany();
  await prisma.incomeRecord.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.category.deleteMany();
  await prisma.pocket.deleteMany();
  await prisma.user.deleteMany();

  // Create sample user
  const hashedPassword = await bcrypt.hash('password123', 10);
  const user = await prisma.user.create({
    data: {
      name: 'Budi Santoso',
      email: 'budi@smartflow.test',
      password: hashedPassword,
      paydayDate: 1,
      themePreference: 'light',
    },
  });

  console.log(`✓ Created user: ${user.email}`);

  // Create default pockets
  const mainPocket = await prisma.pocket.create({
    data: {
      userId: user.id,
      name: 'Dompet Utama',
      type: 'MAIN',
      balance: 500000,
    },
  });

  const emergencyPocket = await prisma.pocket.create({
    data: {
      userId: user.id,
      name: 'Dana Darurat',
      type: 'EMERGENCY',
      balance: 100000,
      targetAmount: 1000000,
    },
  });

  const savingsPocket = await prisma.pocket.create({
    data: {
      userId: user.id,
      name: 'Tabungan Aset',
      type: 'SAVINGS',
      balance: 2000000,
    },
  });

  const wishlistPocket = await prisma.pocket.create({
    data: {
      userId: user.id,
      name: 'Wishlist',
      type: 'WISHLIST',
      balance: 500000,
      targetAmount: 3000000,
    },
  });

  console.log('✓ Created 4 pockets');

  // Create sample categories
  const categories = [
    { name: 'Makanan', type: 'WANT' },
    { name: 'Kos', type: 'NEED' },
    { name: 'Transportasi', type: 'NEED' },
    { name: 'Hobi', type: 'WANT' },
    { name: 'Belanja', type: 'WANT' },
    { name: 'Internet', type: 'NEED' },
  ];

  const createdCategories = [];
  for (const cat of categories) {
    const category = await prisma.category.create({
      data: {
        userId: user.id,
        name: cat.name,
        type: cat.type,
      },
    });
    createdCategories.push(category);
  }

  console.log(`✓ Created ${createdCategories.length} categories`);

  // Create sample transactions
  const today = new Date();
  const transactions = [
    {
      userId: user.id,
      type: 'INCOME_ROUTINE',
      amount: 5000000,
      pocketId: mainPocket.id,
      categoryId: null,
      date: new Date(today.getFullYear(), today.getMonth(), 1),
      notes: 'Kiriman dari orang tua',
    },
    {
      userId: user.id,
      type: 'EXPENSE',
      amount: 50000,
      categoryId: createdCategories[0].id, // Makanan
      pocketId: mainPocket.id,
      date: today,
      notes: 'Makan siang di kantin',
    },
    {
      userId: user.id,
      type: 'EXPENSE',
      amount: 20000,
      categoryId: createdCategories[2].id, // Transportasi
      pocketId: mainPocket.id,
      date: today,
      notes: 'Naik ojek',
    },
    {
      userId: user.id,
      type: 'EXPENSE',
      amount: 100000,
      categoryId: createdCategories[4].id, // Belanja
      pocketId: mainPocket.id,
      date: new Date(today.getTime() - 24 * 60 * 60 * 1000),
      notes: 'Belanja kebutuhan',
    },
  ];

  for (const tx of transactions) {
    await prisma.transaction.create({
      data: tx,
    });
  }

  console.log(`✓ Created ${transactions.length} sample transactions`);

  console.log('✨ Seeding complete!');
  console.log('');
  console.log('Demo Account:');
  console.log('  Email: budi@smartflow.test');
  console.log('  Password: password123');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
