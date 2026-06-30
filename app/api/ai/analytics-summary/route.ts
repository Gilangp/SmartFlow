import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { callHuggingFace, extractJsonFromHfOutput } from '@/lib/huggingface';

export const dynamic = 'force-dynamic';

const genAI = new GoogleGenerativeAI(
  process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || ''
);

function formatRp(num: number): string {
  if (num >= 1000000) return `Rp ${(num / 1000000).toFixed(1)}jt`;
  if (num >= 1000) return `Rp ${(num / 1000).toFixed(0)}rb`;
  return `Rp ${num.toLocaleString('id-ID')}`;
}

export async function GET(request: NextRequest) {
  try {
    const token = extractTokenFromHeader(request.headers.get('Authorization') || '');
    if (!token) {
      return NextResponse.json({ success: false, message: 'No token' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ success: false, message: 'Invalid token' }, { status: 401 });
    }

    const now = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(now.getDate() - 30);

    const transactions = await prisma.transaction.findMany({
      where: {
        userId: decoded.userId,
        date: { gte: thirtyDaysAgo },
      },
      include: { category: true },
      orderBy: { amount: 'desc' },
    });

    // Hitung agregasi dasar
    let totalIncome = 0;
    let totalExpense = 0;
    const catMap: Record<string, number> = {};

    for (const t of transactions) {
      const amount = Number(t.amount);
      if (t.type.startsWith('INCOME')) {
        totalIncome += amount;
      } else if (t.type === 'EXPENSE') {
        totalExpense += amount;
        const cat = t.category?.name || 'Lainnya';
        catMap[cat] = (catMap[cat] || 0) + amount;
      }
    }

    const netFlow = totalIncome - totalExpense;

    // Cari top category & largest single transaction
    const sortedCats = Object.entries(catMap).sort((a, b) => b[1] - a[1]);
    const topCategory = sortedCats.length > 0 ? sortedCats[0][0] : '-';
    const topCatAmount = sortedCats.length > 0 ? sortedCats[0][1] : 0;

    const largestExpenseTx = transactions.find((t) => t.type === 'EXPENSE');
    const largestTxName = largestExpenseTx ? (largestExpenseTx.notes || largestExpenseTx.category?.name || 'Pengeluaran') : '-';
    const largestTxAmount = largestExpenseTx ? Number(largestExpenseTx.amount) : 0;

    // Rule-based fallback (jika AI gagal atau belum ada cukup transaksi)
    const fallbackSummary = [
      netFlow >= 0
        ? `Cash flow sangat sehat! Total pemasukanmu (${formatRp(totalIncome)}) melebihi pengeluaran (${formatRp(totalExpense)}) dalam 30 hari terakhir.`
        : `Peringatan defisit likuiditas. Pengeluaranmu (${formatRp(totalExpense)}) telah melampaui pemasukan (${formatRp(totalIncome)}).`,
      topCategory !== '-'
        ? `Pengeluaran terbesar terkonsentrasi pada kategori "${topCategory}" (${formatRp(topCatAmount)}). Disarankan melakukan efisiensi pada sektor ini.`
        : `Belum tercatat pola pengeluaran kategori yang dominan bulan ini.`,
      largestTxName !== '-'
        ? `Pengeluaran tunggal terbesar adalah "${largestTxName}" sebesar ${formatRp(largestTxAmount)}.`
        : `Pengeluaran harian terpantau cukup merata tanpa lonjakan transaksi tunggal.`
    ];

    if (transactions.length < 3) {
      return NextResponse.json({ success: true, data: { summary: fallbackSummary, source: 'RULE_BASED' } });
    }

    // Bangun Prompt AI
    const prompt = `Kamu adalah AI Executive Financial Analyst tingkat tinggi di aplikasi Finto SmartFlow.
Berdasarkan data keuangan user selama 30 hari terakhir berikut:
- Total Pemasukan: Rp ${totalIncome}
- Total Pengeluaran: Rp ${totalExpense}
- Arus Kas Netto (Surplus/Defisit): Rp ${netFlow}
- Kategori Terboros: "${topCategory}" sebesar Rp ${topCatAmount}
- Transaksi Tunggal Terbesar: "${largestTxName}" sebesar Rp ${largestTxAmount}

Buatlah persis 3 poin analisis Executive Summary yang cerdas, tajam, objektif, dan memberi pandangan profesional (jangan kaku, gunakan bahasa Indonesia yang elegan namun mudah dipahami).
Poin 1: Evaluasi kondisi cash flow dan kesehatan likuiditas.
Poin 2: Analisis konsentrasi pengeluaran pada kategori terboros & sarannya.
Poin 3: Pandangan atas efisiensi transaksi tunggal terbesar atau kebiasaan finansial secara umum.
PENTING: JANGAN gunakan emoji sama sekali dalam teks output.

KEMBALIKAN HANYA DAN EKCLUSIF DALAM FORMAT JSON ARRAY berisi persis 3 string.
Contoh format output JSON yang sah:
[
  "Arus kas mencatatkan surplus sehat sebesar Rp X, menunjukkan kedisiplinan likuiditas yang sangat baik bulan ini.",
  "Sektor pengeluaran didominasi oleh kategori X sebesar Rp Y. Alokasikan batas anggaran bulanan agar tidak membebani tabungan.",
  "Transaksi tunggal X senilai Rp Y menjadi penyerap terbesar. Pastikan pengeluaran bernilai besar telah direncanakan dari dana khusus."
]
Jangan tulis teks markdown atau awalan apapun selain JSON array tersebut.`;

    // 1. Coba Gemini 2.0 Flash
    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
      const result = await model.generateContent(prompt);
      const rawText = result.response.text();
      const parsed = extractJsonFromHfOutput(rawText);

      if (Array.isArray(parsed) && parsed.length === 3 && typeof parsed[0] === 'string') {
        console.log('[ANALYTICS-AI] ✅ Berhasil via Gemini 2.0 Flash.');
        return NextResponse.json({ success: true, data: { summary: parsed, source: 'GEMINI' } });
      }
    } catch (err: any) {
      console.warn('[ANALYTICS-AI] Gemini gagal, coba Hugging Face...', err.message);
    }

    // 2. Coba Hugging Face Qwen 2.5
    try {
      const hfText = await callHuggingFace(prompt, { maxNewTokens: 350, temperature: 0.3 });
      const parsed = extractJsonFromHfOutput(hfText);

      if (Array.isArray(parsed) && parsed.length >= 2 && typeof parsed[0] === 'string') {
        console.log('[ANALYTICS-AI] ✅ Berhasil via Hugging Face.');
        return NextResponse.json({ success: true, data: { summary: parsed.slice(0, 3), source: 'HUGGINGFACE' } });
      }
    } catch (err: any) {
      console.warn('[ANALYTICS-AI] Hugging Face gagal, beralih ke fallback...', err.message);
    }

    // 3. Fallback
    return NextResponse.json({ success: true, data: { summary: fallbackSummary, source: 'FALLBACK' } });

  } catch (error) {
    console.error('ANALYTICS SUMMARY ERROR:', error);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}
