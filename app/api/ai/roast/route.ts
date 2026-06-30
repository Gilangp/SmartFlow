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
  dailyAllowance,
  daysLeftInMonth,
  todayExpense,
  yesterdayExpense,
  spendingAlert,
  expenses,
  tone,
}: {
  totalIncome: number;
  totalExpense: number;
  balance: number;
  dailyAllowance: number;
  daysLeftInMonth: number;
  todayExpense: number;
  yesterdayExpense: number;
  spendingAlert?: string;
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

Data Keuangan Terkini:
- Sisa Saldo Dompet Utama: Rp ${balance}
- Sisa Hari Bulan Ini: ${daysLeftInMonth} hari lagi
- Jatah Harian Ideal: Rp ${dailyAllowance}/hari
- Pengeluaran Hari Ini: Rp ${todayExpense} (Kemarin: Rp ${yesterdayExpense})
- Total Pemasukan 7 Hari: Rp ${totalIncome}
- Total Pengeluaran 7 Hari: Rp ${totalExpense}
${spendingAlert ? `\nPERINGATAN SISTEM: ${spendingAlert}\n(Gunakan info peringatan ini untuk menyindir kelakuan borosnya secara menohok!)` : ''}

Rincian Transaksi Pengeluaran Terakhir:
${expenses.slice(-15).join('\n')}

Aturan:
- Jangan terlalu panjang
- Jangan generik
- Harus spesifik menyindir dari data di atas (bandingkan saldo/jatah harian dengan jajanannya atau lonjakan hari ini)
- WAJIB gunakan bahasa santai Indonesia ala anak muda yang rapi tanpa typo
- DILARANG KERAS menggunakan bahasa Mandarin / China / Inggris ataupun huruf Hanzi/karakter asing
- JANGAN gunakan emoji sama sekali dalam output roasting

Output:
Langsung roasting dalam bahasa Indonesia (tanpa tanda kutip, tanpa penjelasan)
`.trim();
}

// Helper: static fallback roast (safety net terakhir jika semua AI gagal)
function fallbackRoast(totalIncome: number, totalExpense: number, balance: number, dailyAllowance: number) {
  const overspending = [
    'Gaya hidup sultan, pemasukan rakyat jelata. Konsisten... bikin minus.',
    'Dompet menangis lihat mutasi rekeningmu. Udah miskin, maksa gaya.',
    `Jatah harianmu cuma Rp ${dailyAllowance.toLocaleString('id-ID')}/hari. Jangan sok-sokan jajan elit kalau akhir bulan makan promag.`,
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
    `Sisa hari masih panjang tapi saldo tinggal Rp ${balance}. Selamat menikmati air putih dan puasa senin-kamis.`,
    'Saldo Rp ' + balance + '. ATM-mu pasti ngetawain kamu pas masukin pin tadi.'
  ];

  if (balance <= 15000) {
    return broke[Math.floor(Math.random() * broke.length)];
  }

  if (totalExpense > totalIncome || dailyAllowance < 25000) {
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
            '7 hari terakhir jatah harian kosong. Antara disiplin... atau denial finansial.',
        },
      });
    }

    // =====================
    // KALKULASI JATAH HARIAN & LONJAKAN HARI INI
    // =====================
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const currentDay = now.getDate();
    const daysLeftInMonth = Math.max(1, daysInMonth - currentDay + 1);
    const dailyAllowance = Math.round(balance / daysLeftInMonth);

    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);

    let totalExpense = 0;
    let totalIncome = 0;
    let todayExpense = 0;
    let yesterdayExpense = 0;

    const expenseList: string[] = [];

    for (const t of transactions) {
      const amount = Number(t.amount);
      const txDate = new Date(t.date);

      if (t.type === 'EXPENSE') {
        totalExpense += amount;

        if (txDate >= startOfToday) {
          todayExpense += amount;
        } else if (txDate >= startOfYesterday && txDate < startOfToday) {
          yesterdayExpense += amount;
        }

        expenseList.push(
          `- ${t.category?.name || 'Lainnya'} (${t.category?.type === 'WANT' ? 'Keinginan' : 'Kebutuhan'}): Rp ${amount}`
        );
      }

      if (t.type.startsWith('INCOME')) {
        totalIncome += amount;
      }
    }

    // Deteksi lonjakan boros (Opsi 4)
    let spendingAlert = '';
    if (todayExpense > dailyAllowance * 1.5 && dailyAllowance > 0) {
      spendingAlert = `[ALERT: Pengeluaran hari ini (Rp ${todayExpense}) sudah melebihi 150% dari jatah harian ideal (Rp ${dailyAllowance})!]`;
    } else if (todayExpense > yesterdayExpense * 2 && yesterdayExpense > 15000) {
      spendingAlert = `[ALERT: Lonjakan boros! Hari ini habis Rp ${todayExpense}, padahal kemarin cuma Rp ${yesterdayExpense}.]`;
    }

    // =====================
    // PROMPT
    // =====================
    const randomTone = TONES[Math.floor(Math.random() * TONES.length)];

    const prompt = buildRoastPrompt({
      totalIncome,
      totalExpense,
      balance,
      dailyAllowance,
      daysLeftInMonth,
      todayExpense,
      yesterdayExpense,
      spendingAlert,
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
      if (/[\u4E00-\u9FFF]/.test(text)) throw new Error('Gemini returned Chinese characters');

      console.log('[ROAST] ✅ Berhasil via Gemini 2.0 Flash.');
      return NextResponse.json({ success: true, data: { message: text } });
    } catch (geminiError: any) {
      console.warn('[ROAST] Gemini gagal, beralih ke Hugging Face...', geminiError.message);
    }

    // ── 2. HUGGING FACE ROUTER V1 (FALLBACK GRATIS) ──────────────────────────
    try {
      const hfText = await callHuggingFace(prompt, {
        maxNewTokens: 200,
        temperature: 0.65, // Suhu lebih rendah agar bahasa rapi & tidak typo
      });

      const cleaned = hfText.replace(/^["']|["']$/g, '').trim();

      if (cleaned && cleaned.length >= 10 && !/[\u4E00-\u9FFF]/.test(cleaned)) {
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
      data: { message: fallbackRoast(totalIncome, totalExpense, balance, dailyAllowance) },
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