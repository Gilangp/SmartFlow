import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { callHuggingFace } from '@/lib/huggingface';

export const dynamic = 'force-dynamic';

// Init AI
const genAI = new GoogleGenerativeAI(
  process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || ''
);

// Tone pool (dipisah biar reusable)
const TONES = [
  'lucu tapi nyelekit',
  'pedas dan jujur',
  'sarkas tapi relate',
  'dark humor ringan',
  'kayak temen yang nyindir halus tapi nyakitin',
];

// Helper: generate prompt
function buildRoastPrompt({
  totalIncome,
  totalExpense,
  balance,
  expenses,
  tone,
}: {
  totalIncome: number;
  totalExpense: number;
  balance: number;
  expenses: string[];
  tone: string;
}) {
  return `
Kamu adalah AI financial advisor yang JULID tapi pintar.

Tugas:
- Berikan roasting dengan gaya: ${tone}
- Fokus ke kebiasaan finansial user
- Harus relevan dari data
- Maksimal 2-3 baris (WAJIB singkat)

Data:
- Pemasukan: Rp ${totalIncome}
- Pengeluaran: Rp ${totalExpense}
- Sisa saldo: Rp ${balance}

Rincian:
${expenses.join('\n')}

Aturan:
- Jangan terlalu panjang
- Jangan generik
- Harus spesifik dari data
- Gunakan bahasa santai Indonesia

Output:
Langsung roasting (tanpa tanda kutip, tanpa penjelasan)
`;
}

// Helper: static fallback roast (safety net terakhir jika semua AI gagal)
function fallbackRoast(totalIncome: number, totalExpense: number, balance: number) {
  const overspending = [
    'Gaya hidup sultan, pemasukan rakyat jelata. Konsisten... bikin minus.',
    'Dompet menangis lihat mutasi rekeningmu. Udah miskin, maksa gaya.',
    'Pengeluaranmu lebih cepat dari kecepatan cahaya. Sabar, bentar lagi ngutang temen.',
    'Definisi "healing" yang kebablasan sampai bikin kantong butuh ICU.',
    'Sisa saldo: Rp ' + balance + '. Mending puasa aja mulai besok, serius deh.'
  ];

  const goodButBoring = [
    'Keuangan aman sih... tapi bukan karena hemat, kayaknya karena belum sempet keluar rumah aja.',
    'Saldo masih sisa, tumben? Pasti lagi sakit atau emang lagi ga ada temen ngajak main.',
    'Aman sih, tapi lihat tuh history-nya. Hemat atau pelit ke diri sendiri nih?',
    'Pemasukan lebih besar dari pengeluaran. Tumben waras?',
    'Sisa saldo Rp ' + balance + '. Lumayan lah buat modal numpang hidup sampai akhir bulan.'
  ];

  const broke = [
    'Saldo Rp ' + balance + ' mau dipakai buat apa? Beli cilok aja kurang.',
    'Mending cek lowongan kerja lagi. Saldo segitu nggak cukup buat pura-pura kaya.',
    'Tarik nafas... hembuskan... karena cuma itu yang gratis sekarang.',
    'Lihat saldo segitu mending langsung tidur aja. Nggak usah mikirin jajan.',
    'Saldo Rp ' + balance + '. ATM-mu pasti ngetawain kamu pas masukin pin tadi.'
  ];

  if (balance <= 10000) {
    return broke[Math.floor(Math.random() * broke.length)];
  }

  if (totalExpense > totalIncome) {
    return overspending[Math.floor(Math.random() * overspending.length)];
  }
  
  return goodButBoring[Math.floor(Math.random() * goodButBoring.length)];
}

export async function GET(request: NextRequest) {
  try {
    // =====================
    // AUTH
    // =====================
    const token = extractTokenFromHeader(
      request.headers.get('Authorization') || ''
    );

    if (!token) {
      return NextResponse.json(
        { success: false, message: 'No token provided' },
        { status: 401 }
      );
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json(
        { success: false, message: 'Invalid token' },
        { status: 401 }
      );
    }

    // =====================
    // USER
    // =====================
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: { pockets: true },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'User not found' },
        { status: 404 }
      );
    }

    // =====================
    // MAIN POCKET & TRANSACTIONS (7 DAYS)
    // =====================
    const mainWallet = user.pockets.find((p) => p.type === 'MAIN');
    if (!mainWallet) {
      return NextResponse.json(
        { success: false, message: 'Main pocket not found' },
        { status: 404 }
      );
    }
    const balance = Number(mainWallet.balance || 0);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const transactions = await prisma.transaction.findMany({
      where: {
        userId: user.id,
        pocketId: mainWallet.id,
        date: { gte: sevenDaysAgo },
      },
      include: { category: true },
      orderBy: { date: 'asc' },
    });

    if (!transactions.length) {
      return NextResponse.json({
        success: true,
        data: {
          message:
            '7 hari terakhir jatah harian kosong. Antara disiplin... atau denial finansial 😌',
        },
      });
    }

    // =====================
    // AGGREGATION
    // =====================
    let totalExpense = 0;
    let totalIncome = 0;

    const expenseList: string[] = [];

    for (const t of transactions) {
      const amount = Number(t.amount);

      if (t.type === 'EXPENSE') {
        totalExpense += amount;

        expenseList.push(
          `- ${t.category?.name || 'Lainnya'} (${t.category?.type === 'WANT' ? 'Keinginan' : 'Kebutuhan'}): Rp ${amount}`
        );
      }

      if (t.type.startsWith('INCOME')) {
        totalIncome += amount;
      }
    }

    // =====================
    // PROMPT
    // =====================
    const randomTone = TONES[Math.floor(Math.random() * TONES.length)];

    const prompt = buildRoastPrompt({
      totalIncome,
      totalExpense,
      balance,
      expenses: expenseList,
      tone: randomTone,
    });

    // =====================
    // AI CALL — BERTINGKAT
    // =====================

    // ── 1. GEMINI 2.0 FLASH (UTAMA) ──────────────────────────────────────────
    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      let text = response.text().trim();
      text = text.replace(/^["']|["']$/g, '');

      if (!text || text.length < 10) throw new Error('Gemini returned weak response');

      console.log('[ROAST] ✅ Berhasil via Gemini 2.0 Flash.');
      return NextResponse.json({ success: true, data: { message: text } });
    } catch (geminiError: any) {
      console.warn('[ROAST] Gemini gagal, beralih ke Hugging Face...', geminiError.message);
    }

    // ── 2. HUGGING FACE QWEN 2.5 (FALLBACK GRATIS) ───────────────────────────
    try {
      const hfText = await callHuggingFace(prompt, {
        maxNewTokens: 200,
        temperature: 0.75, // Suhu lebih tinggi agar roasting lebih kreatif & variatif
      });

      const cleaned = hfText.replace(/^["']|["']$/g, '').trim();

      if (cleaned && cleaned.length >= 10) {
        console.log('[ROAST] ✅ Berhasil via Hugging Face.');
        return NextResponse.json({ success: true, data: { message: cleaned } });
      }

      throw new Error('Hugging Face returned weak response');
    } catch (hfError: any) {
      console.warn('[ROAST] Hugging Face gagal, beralih ke static fallback...', hfError.message);
    }

    // ── 3. STATIC ROAST POOL (SAFETY NET TERAKHIR) ────────────────────────────
    console.log('[ROAST] Menggunakan static roast pool sebagai safety net.');
    return NextResponse.json({
      success: true,
      data: { message: fallbackRoast(totalIncome, totalExpense, balance) },
    });

  } catch (error) {
    console.error('ROAST ERROR:', error);

    return NextResponse.json(
      {
        success: false,
        message: 'Failed to generate roast',
        error: String(error),
      },
      { status: 500 }
    );
  }
}