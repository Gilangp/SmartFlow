const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const users = await prisma.user.findMany({ include: { pockets: true } });
  for (const user of users) {
    if (user.pockets.length === 0) {
      console.log('User has NO pockets:', user.email);
    }
  }
  const transactions = await prisma.transaction.findMany({ include: { pocket: true } });
  for (const t of transactions) {
    if (!t.pocket) {
      console.log('Transaction has NO pocket:', t.id);
    }
  }
  console.log('Done checking.');
}
check().finally(() => prisma.$disconnect());
