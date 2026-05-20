import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || '');

export async function GET(request: NextRequest) {
  try {
    const token = extractTokenFromHeader(request.headers.get('Authorization') || '');
    if (!token) {
      return NextResponse.json({ success: false, message: 'No token provided' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ success: false, message: 'Invalid token' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: {
        pockets: true,
      },
    });

    if (!user) {
      return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
    }

    // Get last 7 days transactions
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const transactions = await prisma.transaction.findMany({
      where: {
        userId: user.id,
        date: { gte: sevenDaysAgo },
      },
      include: { category: true },
      orderBy: { date: 'asc' },
    });

    if (transactions.length === 0) {
      return NextResponse.json({
        success: true,
        data: { message: "Wah, 7 hari terakhir kamu belum catat pengeluaran apa-apa. Takut ketahuan miskin atau emang rajin puasa?" }
      });
    }

    // Prepare data for AI
    let totalExpense = 0;
    let totalIncome = 0;
    const expenseList = transactions
      .filter((t) => t.type === 'EXPENSE')
      .map((t) => {
        totalExpense += Number(t.amount);
        return `- ${t.category?.name || 'Lainnya'} (${t.category?.type === 'WANT' ? 'Keinginan' : 'Kebutuhan'}): Rp ${t.amount}`;
      });

    transactions
      .filter((t) => t.type.startsWith('INCOME'))
      .forEach((t) => {
        totalIncome += Number(t.amount);
      });

    const mainWallet = user.pockets.find(p => p.type === 'MAIN');
    
    const tones = [
      'lucu dan menghibur',
      'pedes dan nyelekit',
      'sarcastic dan menyindir',
      'dark humor tapi ngakak',
      'cerita kocak tapi dalam',
    ];
    
    const randomTone = tones[Math.floor(Math.random() * tones.length)];
    
    const prompt = `
Sebagai asisten keuangan yang julid dan blak-blakan, berikan roasting ${randomTone} tentang perilaku keuangan orang ini.

PENTING: Roasting HANYA 2-3 baris! Singkat, padat, dan mengena!
Bahasanya santai, kekinian, harus nyelekit tapi tetap relevan dengan kondisi finansialnya.

Data Keuangan 7 Hari Terakhir:
- Pemasukan: Rp ${totalIncome}
- Pengeluaran: Rp ${totalExpense}
- Sisa Saldo Dompet Utama: Rp ${mainWallet?.balance.toString() || 0}

Rincian Pengeluaran:
${expenseList.join('\n')}

Tulis roasting singkat (2-3 baris) sekarang, jangan panjang!
`;

    // Try to get response from Gemini
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      return NextResponse.json({
        success: true,
        data: { message: text }
      });
    } catch (aiError) {
      console.error('AI API Error:', aiError);
      return NextResponse.json({
        success: true,
        data: { message: "API AI lagi ngambek atau key-nya belum diset. Yang pasti, jangan boros hari ini!" }
      });
    }

  } catch (error) {
    console.error('AI Roaster error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to generate roast', error: String(error) },
      { status: 500 }
    );
  }
}
