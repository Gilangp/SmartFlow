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
    let totalNeedExpense = 0;
    let totalWantExpense = 0;
    const catMap: Record<string, number> = {};
    const expenseTransactions = [];

    for (const t of transactions) {
      const amount = Number(t.amount);
      if (t.type.startsWith('INCOME')) {
        totalIncome += amount;
      } else if (t.type === 'EXPENSE') {
        totalExpense += amount;
        expenseTransactions.push(t);
        const cat = t.category?.name || 'Lainnya';
        catMap[cat] = (catMap[cat] || 0) + amount;

        if (t.category?.type === 'WANT') {
          totalWantExpense += amount;
        } else {
          // Default/NEED
          totalNeedExpense += amount;
        }
      }
    }

    const netFlow = totalIncome - totalExpense;
    const savingRate = totalIncome > 0 ? Math.round((netFlow / totalIncome) * 100) : 0;
    const wantPercentage = totalExpense > 0 ? Math.round((totalWantExpense / totalExpense) * 100) : 0;
    const needPercentage = totalExpense > 0 ? Math.round((totalNeedExpense / totalExpense) * 100) : 0;

    // Cari top category & largest single transaction
    const sortedCats = Object.entries(catMap).sort((a, b) => b[1] - a[1]);
    const topCategory = sortedCats.length > 0 ? sortedCats[0][0] : '-';
    const topCatAmount = sortedCats.length > 0 ? sortedCats[0][1] : 0;

    // Ambil 8 transaksi pengeluaran terbesar untuk dikirim ke AI beserta notesnya
    const top8Expenses = expenseTransactions
      .sort((a, b) => Number(b.amount) - Number(a.amount))
      .slice(0, 8);

    const largestExpensesText = top8Expenses.map(t => {
      const dateStr = t.date.toISOString().split('T')[0];
      const noteStr = t.notes ? ` (Catatan: "${t.notes}")` : '';
      return `- [Tanggal: ${dateStr}] ${t.category?.name || 'Lainnya'} (${t.category?.type === 'WANT' ? 'Keinginan' : 'Kebutuhan'}): Rp ${Number(t.amount)}${noteStr}`;
    }).join('\n');

    const largestExpenseTx = top8Expenses.length > 0 ? top8Expenses[0] : null;
    const largestTxName = largestExpenseTx ? (largestExpenseTx.notes || largestExpenseTx.category?.name || 'Pengeluaran') : '-';
    const largestTxAmount = largestExpenseTx ? Number(largestExpenseTx.amount) : 0;

    // Rule-based fallback (jika AI gagal atau belum ada cukup transaksi)
    const fallbackSummary = [
      netFlow >= 0
        ? `Cash flow sangat sehat! Total pemasukanmu (${formatRp(totalIncome)}) melebihi pengeluaran (${formatRp(totalExpense)}) dalam 30 hari terakhir dengan rasio menabung ${savingRate}%.`
        : `Peringatan defisit likuiditas. Pengeluaranmu (${formatRp(totalExpense)}) telah melampaui pemasukan (${formatRp(totalIncome)}) sebesar ${formatRp(Math.abs(netFlow))}.`,
      topCategory !== '-'
        ? `Pengeluaran terbesar terkonsentrasi pada kategori "${topCategory}" (${formatRp(topCatAmount)}) yang menyerap ${needPercentage}% kebutuhan dan ${wantPercentage}% keinginan.`
        : `Belum tercatat pola pengeluaran kategori yang dominan bulan ini.`,
      largestTxName !== '-'
        ? `Pengeluaran tunggal terbesar adalah "${largestTxName}" sebesar ${formatRp(largestTxAmount)}. Pastikan pengeluaran besar ini direncanakan dari pos anggaran khusus.`
        : `Pengeluaran harian terpantau cukup merata tanpa lonjakan transaksi tunggal.`
    ];

    if (transactions.length < 3) {
      return NextResponse.json({ success: true, data: { summary: fallbackSummary, source: 'RULE_BASED' } });
    }

    // Bangun Prompt AI
    const prompt = `Kamu adalah AI Executive Financial Analyst tingkat tinggi di aplikasi Finto SmartFlow.
Tugas Anda adalah melakukan audit finansial dan analisis kesehatan keuangan secara mendalam, objektif, dan profesional berdasarkan data keuangan user selama 30 hari terakhir berikut:

METRIK UTAMA:
- Total Pemasukan: Rp ${totalIncome}
- Total Pengeluaran: Rp ${totalExpense}
- Arus Kas Bersih (Net Flow): Rp ${netFlow}
- Rasio Tabungan (Savings Rate): ${savingRate}% dari pemasukan
- Pengeluaran Kebutuhan (Needs): Rp ${totalNeedExpense} (${needPercentage}% dari total pengeluaran)
- Pengeluaran Keinginan (Wants): Rp ${totalWantExpense} (${wantPercentage}% dari total pengeluaran)
- Kategori Terboros: "${topCategory}" dengan akumulasi Rp ${topCatAmount}

DAFTAR TRANSAKSI PENGELUARAN TERBESAR (Dengan Catatan):
${largestExpensesText || 'Tidak ada transaksi pengeluaran.'}

PANDUAN AUDIT FINANSIAL PROFESIONAL:
1. Poin 1 (Analisis Likuiditas & Rasio Tabungan):
   - Lakukan evaluasi cash flow secara ketat. Jika Net Flow negatif, identifikasi sebagai "Defisit Likuiditas" dan hitung tingkat kerentanan keuangan.
   - Evaluasi Savings Rate berdasarkan benchmark profesional: >= 20% (Sehat/Sangat Baik), 10-19% (Cukup/Rentan), < 10% (Lemah/Vulnerable), < 0% (Kritis). Berikan rekomendasi pembentukan Dana Darurat yang konkret dan realistis (misal target akumulasi 3-6 kali pengeluaran bulanan).
2. Poin 2 (Audit Alokasi Anggaran - Needs vs Wants):
   - Gunakan kerangka kerja penganggaran 50/30/20. Bandingkan rasio pengeluaran user (Needs ${needPercentage}% vs Wants ${wantPercentage}%) dengan rasio ideal (maksimal 50% Needs, 30% Wants, 20% Savings).
   - Soroti jika pengeluaran Keinginan (Wants) melampaui 30% atau jika kategori terboros ("${topCategory}") menyerap porsi anggaran yang tidak sehat. Berikan instruksi pembatasan anggaran atau teknik penganggaran amplop yang spesifik.
3. Poin 3 (Analisis Transaksi Terbesar & Rekomendasi Taktis):
   - Bedah daftar transaksi terbesar beserta CATATAN-nya secara detail. 
   - Klasifikasikan dengan tepat mana pengeluaran besar bersifat Investasi/Kewajiban Produktif (seperti: "bayar kos", "biaya kuliah/ukt", "obat/kesehatan", "angsuran") dan mana yang bersifat Konsumsi Diskresioner/Keinginan (seperti: "jajan", "kopi", "game", "gadget non-esensial").
   - Jika didominasi pengeluaran produktif/investasi, berikan validasi logis atas keputusan tersebut lalu sarankan cara mitigasi likuiditas. Jika didominasi konsumsi diskresioner, berikan kritik profesional konstruktif dan taktik menahan diri (misal aturan menunda pembelian 30 hari).

ATURAN OUTPUT:
- JANGAN gunakan emoji sama sekali dalam teks output.
- KEMBALIKAN HANYA DAN EKSKLUSIF DALAM FORMAT JSON ARRAY berisi persis 3 string.
- Jangan tulis teks markdown atau awalan/akhiran apapun selain JSON array tersebut.
- WAJIB memformat setiap nominal uang menggunakan titik sebagai pemisah ribuan (contoh: Rp 50.000, Rp 1.500.000, dst). JANGAN menulis angka tanpa pemisah (seperti Rp 50000 atau Rp 1500000).

Contoh format output JSON yang sah:
[
  "Analisis likuiditas mendeteksi defisit arus kas sebesar Rp 750.000 dengan rasio tabungan minus 15%, menunjukkan kerentanan tinggi terhadap pengeluaran darurat sehingga pembentukan dana cadangan minimal 3 bulan pengeluaran menjadi prioritas utama.",
  "Proporsi pengeluaran keinginan (Wants) mencapai 42% yang melampaui batas aman 30%, dipicu oleh akumulasi kategori Belanja sebesar Rp 1.200.000. Perlu dilakukan restrukturisasi anggaran dengan memangkas pos non-esensial dan menerapkan limitasi harian.",
  "Transaksi terbesar tunggal tercatat pada pos produktif yaitu UKT Kuliah senilai Rp 5.000.000, namun terdapat celah efisiensi pada transaksi konsumtif ngopi sore sebesar Rp 150.000 yang dapat dialokasikan kembali untuk memperkuat likuiditas."
]`;

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
