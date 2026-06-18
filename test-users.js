require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const prisma = new PrismaClient();
const JWT_SECRET = process.env.NEXTAUTH_SECRET || 'your-secret-key-change-in-production';

async function testAll() {
  const users = await prisma.user.findMany();
  for (const user of users) {
    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });
    const res = await fetch('http://localhost:3000/api/dashboard', { headers: { Authorization: 'Bearer ' + token }});
    if (res.status === 500) {
      console.log('FAIL for user:', user.email);
      console.log(await res.text());
    } else {
      console.log('SUCCESS for user:', user.email);
    }
  }
  console.log('Done.');
}
testAll().finally(() => prisma.$disconnect());
