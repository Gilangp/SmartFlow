const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('password123', 10);
  
  // 1. User Trial (Trial expires in 7 days)
  const user1 = await prisma.user.upsert({
    where: { email: 'trial@finto.app' },
    update: {},
    create: {
      name: 'Budi (Trial)',
      email: 'trial@finto.app',
      password: passwordHash,
      subscription: {
        create: {
          plan: 'TRIAL',
          status: 'ACTIVE',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // +7 days
        }
      }
    }
  });

  // 2. User Student (Lifetime)
  const user2 = await prisma.user.upsert({
    where: { email: 'student@finto.app' },
    update: {},
    create: {
      name: 'Siti (Student)',
      email: 'student@finto.app',
      password: passwordHash,
      subscription: {
        create: {
          plan: 'STUDENT',
          status: 'ACTIVE',
        }
      }
    }
  });

  // 3. User Premium (Lifetime for demo)
  const user3 = await prisma.user.upsert({
    where: { email: 'premium@finto.app' },
    update: {},
    create: {
      name: 'Rudi (Premium)',
      email: 'premium@finto.app',
      password: passwordHash,
      subscription: {
        create: {
          plan: 'PREMIUM',
          status: 'ACTIVE',
        }
      }
    }
  });

  // Also create Main Pocket for each user since it's required for dashboard
  const users = [user1, user2, user3];
  for (const user of users) {
    const mainPocketCount = await prisma.pocket.count({ where: { userId: user.id, type: 'MAIN' } });
    if (mainPocketCount === 0) {
      await prisma.pocket.create({
        data: {
          userId: user.id,
          name: 'Dompet Utama',
          type: 'MAIN',
          balance: 0
        }
      });
    }
  }

  console.log('✅ Demo accounts created successfully:');
  console.log('--------------------------------------------------');
  console.log('1. Akun Trial      : trial@finto.app / password123');
  console.log('2. Akun Mahasiswa  : student@finto.app / password123');
  console.log('3. Akun Premium    : premium@finto.app / password123');
  console.log('--------------------------------------------------');
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
