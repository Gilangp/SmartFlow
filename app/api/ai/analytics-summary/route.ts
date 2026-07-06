import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { callHuggingFace, extractJsonFromHfOutput } from '@/lib/huggingface';
import { startOfMonth, subMonths, endOfMonth } from 'date-fns';

export const dynamic = 'force-dynamic';

const genAI = new GoogleGenerativeAI(
  process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || ''
);

function rp(n: number) {
  return `Rp ${Math.round(n).toLocaleString('id-ID')}`;
}

function isValidAiReport(summary: any, pointKeyNumbers: string[][]): boolean {
  if (!Array.isArray(summary) || summary.length < 4 || typeof summary[0] !== 'string') return false;
  
  // Periksa setiap poin (paragraf 1 sampai 4) agar minimal ada 1 angka representatif per paragraf
  for (let i = 0; i < 4; i++) {
    const text = String(summary[i] || '');
    if (!/Rp\s*\d+|\d+%/.test(text)) return false; // Setiap paragraf wajib punya nominal Rp atau persentase
    
    const candidates = pointKeyNumbers[i] || [];
    const validCandidates = candidates.filter(numStr => {
      if (!numStr) return false;
      const c = numStr.replace(/\s+/g, '').replace(/\./g, '');
      return c !== 'Rp0' && c !== '0%' && c !== '0';
    });
    if (validCandidates.length === 0) continue;

    let matchedInPoint = false;
    for (const numStr of validCandidates) {
      const cleanNum = numStr.replace(/\s+/g, '').replace(/\./g, '');
      const cleanText = text.replace(/\s+/g, '').replace(/\./g, '');
      if (cleanText.includes(cleanNum)) {
        matchedInPoint = true;
        break;
      }
    }
    if (!matchedInPoint) return false;
  }
  return true;
}

export async function GET(request: NextRequest) {
  try {
    const token = extractTokenFromHeader(request.headers.get('Authorization') || '');
    if (!token) return NextResponse.json({ success: false, message: 'No token' }, { status: 401 });

    const decoded = verifyToken(token);
    if (!decoded) return NextResponse.json({ success: false, message: 'Invalid token' }, { status: 401 });

    const now = new Date();
    const startThisMonth = startOfMonth(now);
    const startLastMonth = startOfMonth(subMonths(now, 1));
    const endLastMonth   = endOfMonth(subMonths(now, 1));
    const thirtyDaysAgo  = new Date(now); thirtyDaysAgo.setDate(now.getDate() - 30);
    const ninetyDaysAgo  = new Date(now); ninetyDaysAgo.setDate(now.getDate() - 90);

    // ── User + semua kantong ────────────────────────────────────────────────
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: { pockets: true },
    });
    if (!user) return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });

    const mainPocket      = user.pockets.find(p => p.type === 'MAIN');
    const emergencyPocket = user.pockets.find(p => p.type === 'EMERGENCY');
    const savingsPocket   = user.pockets.find(p => p.type === 'SAVINGS');
    const wishlistPocket  = user.pockets.find(p => p.type === 'WISHLIST');
    const customPockets   = user.pockets.filter(p => p.type === 'CUSTOM');

    const balanceMain      = Number(mainPocket?.balance ?? 0);
    const balanceEmergency = Number(emergencyPocket?.balance ?? 0);
    const balanceSavings   = Number(savingsPocket?.balance ?? 0);
    const balanceWishlist  = Number(wishlistPocket?.balance ?? 0);
    const balanceCustom    = customPockets.reduce((s, p) => s + Number(p.balance ?? 0), 0);
    const totalWealth      = user.pockets.reduce((s, p) => s + Number(p.balance ?? 0), 0);
    const liquidAsset      = balanceMain + balanceEmergency;
    const emergencyTarget  = Number(emergencyPocket?.targetAmount ?? 0);
    const wishlistTarget   = Number(wishlistPocket?.targetAmount ?? 0);
    const pocketAllocations = user.pockets
      .filter(p => p.allocation > 0)
      .map(p => `${p.name} (${p.allocation}%)`)
      .join(', ');

    // ── Transaksi 60 hari ──────────────────────────────────────────────────
    const allTx = await prisma.transaction.findMany({
      where: {
        userId: decoded.userId,
        date: { gte: ninetyDaysAgo, lte: endOfMonth(now) },
      },
      include: {
        category: true,
        pocket: { select: { name: true } },
      },
      orderBy: { date: 'asc' },
    });

    if (allTx.length < 3) {
      return NextResponse.json({ success: true, data: { summary: [
        'Data transaksi masih terlalu sedikit untuk dianalisis. Catat minimal 3 transaksi terlebih dahulu.',
        'Catat seluruh pengeluaran dan pemasukan harian beserta kategori yang tepat agar analisis dapat dilakukan.',
        'Semakin lengkap data transaksi, semakin akurat laporan keuangan yang dapat dihasilkan.',
        'Mulai catat transaksi sekarang untuk mendapatkan laporan audit keuangan personal yang komprehensif.',
      ], source: 'INSUFFICIENT_DATA' } });
    }

    // ── Agregasi ────────────────────────────────────────────────────────────
    let income30 = 0, expense30 = 0, want30 = 0, need30 = 0;
    let incomeLastMonth = 0, expenseLastMonth = 0;
    let incomeThisMonth = 0, expenseThisMonth = 0;

    const wantCatMap: Record<string, number> = {};
    const needCatMap: Record<string, number> = {};
    const expenseRows: typeof allTx = [];

    // ── Catatan Sistem Windowing Paralel ──────────────────────────────────
    // Dalam loop di bawah ini, dua sistem windowing berjalan secara paralel:
    // 1. Rolling 30 Hari (thirtyDaysAgo): Digunakan untuk analisis arus kas aktual, burn rate,
    //    dan rasio 50/30/20 karena kebiasaan finansial personal dihitung bergulir (rolling).
    // 2. Kalender Bulan (startLastMonth/endLastMonth & startThisMonth): Digunakan eksklusif
    //    untuk komparasi pertumbuhan bulan-ke-bulan (expenseGrowth & incomeGrowth) ala laporan akuntansi.
    let expense90 = 0;
    let income90 = 0;

    for (const tx of allTx) {
      const amt    = Number(tx.amount);
      const txDate = new Date(tx.date);
      const isInc  = tx.type.startsWith('INCOME');
      const isExp  = tx.type === 'EXPENSE';

      if (isExp) expense90 += amt;
      if (isInc) income90 += amt;

      if (txDate >= thirtyDaysAgo) {
        if (isInc) income30  += amt;
        if (isExp) {
          expense30 += amt;
          const catType = tx.category?.type ?? null;
          const catName = tx.category?.name || 'Lainnya';
          if (catType === 'WANT') { want30 += amt; wantCatMap[catName] = (wantCatMap[catName] || 0) + amt; }
          else                    { need30 += amt; needCatMap[catName] = (needCatMap[catName] || 0) + amt; }
          expenseRows.push(tx);
        }
      }
      if (txDate >= startLastMonth && txDate <= endLastMonth) {
        if (isInc) incomeLastMonth  += amt;
        if (isExp) expenseLastMonth += amt;
      }
      if (txDate >= startThisMonth) {
        if (isInc) incomeThisMonth  += amt;
        if (isExp) expenseThisMonth += amt;
      }
    }

    // ════════════════════════════════════════════════════
    // PRE-COMPUTE SEMUA KALKULASI DI BACKEND
    // LLM hanya bertugas menyusun narasi dari angka ini
    // ════════════════════════════════════════════════════

    // — Poin 1: Likuiditas & Resiliensi (Skala Mahasiswa) —————————————————
    const oldestTxDate = allTx.length > 0 ? new Date(allTx[0].date) : now;
    const daysOfHistory = Math.max(1, Math.ceil((now.getTime() - oldestTxDate.getTime()) / (1000 * 60 * 60 * 24)));
    
    // Untuk mahasiswa dengan pola kiriman uang saku non-bulanan (per semester/tidak tentu tiap bulan),
    // jika income30 kurang dari 50% rata-rata bulanan historis (misal cuma ada cashback/refund kecil atau kiriman belum masuk),
    // gunakan rata-rata bulanan historis (monthlyIncomeAvg) agar savingRate tidak menyesatkan.
    const monthlyIncomeAvg = daysOfHistory < 30
      ? Math.round((income90 / daysOfHistory) * 30)
      : Math.round(income90 / Math.min(3, daysOfHistory / 30));
    const isIncomeAveraged = income30 < monthlyIncomeAvg * 0.5 && monthlyIncomeAvg > 0;
    const effectiveIncome  = isIncomeAveraged ? monthlyIncomeAvg : income30;
    const netFlow30        = effectiveIncome - expense30;
    const savingRate       = effectiveIncome > 0 ? Math.round((netFlow30 / effectiveIncome) * 100) : 0;
    const burnRate         = expense30 > 0 ? expense30 / 30 : 0;
    const liquidRunway     = burnRate > 0 ? Math.floor(liquidAsset / burnRate) : 999;

    // Benchmark Savings Rate dikalibrasi untuk mahasiswa (tanpa income mandiri rutin):
    // ≥15% Sangat Sehat (Ideal Mahasiswa), 10-15% Cukup Sehat, <10% Rentan/Waspada.
    const savingRateLabel =
      savingRate >= 15 ? 'Sangat Sehat (Ideal Mahasiswa ≥15%)' :
      savingRate >= 10 ? 'Cukup Sehat (Standard Mahasiswa 10-15%)' :
      savingRate >= 0  ? 'Rentan / Rentang Waspada (<10%)' : 'Kritis / Defisit';

    const monthlyExpense = daysOfHistory < 30
      ? Math.round((expense90 / daysOfHistory) * 30)
      : Math.round(expense90 / Math.min(3, daysOfHistory / 30));

    // Untuk mahasiswa, standar dana darurat yang realistis dan actionable adalah 1× hingga 2× pengeluaran bulanan
    // (mengantisipasi telat kiriman uang saku atau darurat kecil seperti laptop rusak/sakit), bukan 3-6× ala pekerja korporat.
    const emergencyTarget1x    = monthlyExpense * 1;
    const emergencyTarget2x    = monthlyExpense * 2;
    const emergencyGap1x       = Math.max(0, emergencyTarget1x - balanceEmergency);
    const emergencyGap2x       = Math.max(0, emergencyTarget2x - balanceEmergency);
    const isEmergency2xMet     = balanceEmergency >= emergencyTarget2x;
    const emergencyStatusText  = isEmergency2xMet
      ? `sudah tercapai dan melebihi target ideal mahasiswa 2× (${rp(emergencyTarget2x)})`
      : balanceEmergency >= emergencyTarget1x
        ? `sudah aman di level 1× (${rp(emergencyTarget1x)}), tinggal sedikit lagi ke target ideal 2× (${rp(emergencyTarget2x)})`
        : `masih kurang ${rp(emergencyGap1x)} dari target minimum 1× (${rp(emergencyTarget1x)}) (target ideal 2×: ${rp(emergencyTarget2x)})`;
    const emergencyCoverMonths = burnRate > 0 ? Math.round((balanceEmergency / burnRate / 30) * 10) / 10 : 0;

    // — Poin 2: Alokasi Anggaran (50/30/20) ─────────────
    const needRatio  = expense30 > 0 ? Math.round((need30 / expense30) * 100) : 0;
    const wantRatio  = expense30 > 0 ? Math.round((want30 / expense30) * 100) : 0;
    const savingsAlloc = effectiveIncome > 0 ? Math.round(((effectiveIncome - expense30) / effectiveIncome) * 100) : 0;

    const needDeviation  = needRatio - 50;   // positif = melebihi ideal
    const wantDeviation  = wantRatio - 30;   // positif = melebihi ideal

    const sortedWant = Object.entries(wantCatMap).sort(([, a], [, b]) => b - a);
    const top3Want   = sortedWant.slice(0, 3);
    const top3Need   = Object.entries(needCatMap).sort(([, a], [, b]) => b - a).slice(0, 3);

    // Rekomendasi cap anggaran: turunkan top WANT 20%
    const wantCapRecs = top3Want.map(([name, total]) => ({
      name,
      actual: total,
      recommended: Math.round(total * 0.8),
      saving: Math.round(total * 0.2),
    }));

    // — Poin 3: Bedah Transaksi Diskresioner ─────────────
    const top8Tx = expenseRows
      .sort((a, b) => Number(b.amount) - Number(a.amount))
      .slice(0, 8);

    const productive    = top8Tx.filter(t => t.category?.type !== 'WANT');
    const discretionary = top8Tx.filter(t => t.category?.type === 'WANT');
    const totalDiscretionary = discretionary.reduce((s, t) => s + Number(t.amount), 0);
    const totalProductive    = productive.reduce((s, t) => s + Number(t.amount), 0);
    // Catatan Heuristik: 30% dari total pengeluaran diskresioner (WANT) diasumsikan sebagai
    // estimasi potensi penghematan internal (internal heuristic assumption), bukan benchmark baku industri.
    const potentialSaving = Math.round(totalDiscretionary * 0.3);

    const top8Lines = top8Tx.map(tx => {
      const catType = tx.category?.type === 'WANT' ? 'Diskresioner' : 'Produktif';
      const note    = tx.notes ? ` | "${tx.notes}"` : '';
      const pocket  = (tx as any).pocket?.name || '-';
      return `[${tx.date.toISOString().split('T')[0]}][${pocket}] ${tx.category?.name || 'Lainnya'} (${catType}): ${rp(Number(tx.amount))}${note}`;
    }).join('\n');

    // — Poin 4: Komposisi Aset & Tren ────────────────────
    const emergencyProgress = emergencyTarget > 0
      ? Math.round((balanceEmergency / emergencyTarget) * 100)
      : null;
    const wishlistProgress = wishlistTarget > 0
      ? Math.round((balanceWishlist / wishlistTarget) * 100)
      : null;

    const expenseGrowth = expenseLastMonth > 0
      ? Math.round(((expenseThisMonth - expenseLastMonth) / expenseLastMonth) * 100)
      : null;
    const incomeGrowth = incomeLastMonth > 0
      ? Math.round(((incomeThisMonth - incomeLastMonth) / incomeLastMonth) * 100)
      : null;

    const wealthDistribution = totalWealth > 0 ? {
      main:      Math.round((balanceMain / totalWealth) * 100),
      emergency: Math.round((balanceEmergency / totalWealth) * 100),
      savings:   Math.round((balanceSavings / totalWealth) * 100),
      wishlist:  Math.round((balanceWishlist / totalWealth) * 100),
    } : { main: 0, emergency: 0, savings: 0, wishlist: 0 };

    // ════════════════════════════════════════════════════
    // RULE-BASED FALLBACK (jika AI gagal, hasilnya masih
    // 100% akurat karena semua angka dari backend)
    // ════════════════════════════════════════════════════
    const wantCapFallbackText = wantCapRecs.length > 0
      ? `Kategori WANT terboros & rekomendasi cap anggaran:\n` + wantCapRecs.map(r => `  • ${r.name}: turunkan dari ${rp(r.actual)} → ${rp(r.recommended)} (hemat ${rp(r.saving)}/bulan)`).join('\n')
      : 'Tidak ada pengeluaran WANT tercatat dalam periode ini.';

    const incomeNote = isIncomeAveraged ? ' (diperhitungkan dari rata-rata kiriman historis karena kiriman utama bulan ini belum masuk / bersifat sporadis)' : '';

    const fallbackSummary = [
      `[LIKUIDITAS] Net Flow 30 hari: ${netFlow30 >= 0 ? '+' : ''}${rp(netFlow30)}. Savings Rate kamu ${savingRate}%${incomeNote} — klasifikasi: ${savingRateLabel}. Burn Rate harian ${rp(burnRate)}, Liquid Runway ${liquidRunway} hari. Dana Darurat saat ini ${rp(balanceEmergency)} mencukupi ${emergencyCoverMonths} bulan pengeluaran; ${emergencyStatusText}. ${!isEmergency2xMet ? `Rekomendasi: alokasikan minimal ${rp(Math.round(emergencyGap2x / 3))} per bulan selama 3 bulan ke depan untuk mencapai target ideal mahasiswa 2× pengeluaran bulanan.` : 'Rekomendasi: pertahankan disiplin dana darurat ini dan pertimbangkan alokasi surplus ke kantong Wishlist atau Tabungan.'}`,

      `[ALOKASI ANGGARAN] Rasio aktual: Kebutuhan ${needRatio}% (ideal ≤50%, deviasi ${needDeviation >= 0 ? '+' : ''}${needDeviation}%), Keinginan ${wantRatio}% (ideal ≤30%, deviasi ${wantDeviation >= 0 ? '+' : ''}${wantDeviation}%).\n${wantCapFallbackText}`,

      `[AUDIT TRANSAKSI] Dari 8 transaksi terbesar: ${productive.length} transaksi produktif/kewajiban (${rp(totalProductive)}) dan ${discretionary.length} transaksi diskresioner (${rp(totalDiscretionary)}). Potensi penghematan 30% dari pos diskresioner: ${rp(potentialSaving)}/bulan. ${discretionary[0] ? `Transaksi diskresioner terbesar: ${discretionary[0].category?.name || 'Lainnya'} sebesar ${rp(Number(discretionary[0].amount))}.` : ''}`,

      `[KOMPOSISI KANTONG & ALOKASI] Total kekayaan bersihmu ${rp(totalWealth)} dengan distribusi aktual: Dompet Utama ${wealthDistribution.main}%, Dana Darurat ${wealthDistribution.emergency}%, Tabungan ${wealthDistribution.savings}%, dan Wishlist ${wealthDistribution.wishlist}%. Target persentase alokasi amplop yang kamu set di Finto adalah: ${pocketAllocations || 'Belum diatur'}. ${balanceEmergency >= emergencyTarget2x ? 'Dana daruratmu sudah berada di zona aman mahasiswa (≥2× pengeluaran bulanan), pertahankan disiplin alokasi kantongmu!' : `Agar keuangan mahasiswamu makin aman dari telat kiriman atau darurat mendadak, prioritaskan menyisihkan uang ke Dana Darurat hingga mencapai target ideal 2× pengeluaran bulanan (${rp(emergencyTarget2x)}).`}`,
    ];

    // ════════════════════════════════════════════════════
    // PROMPT: LLM = NARRATOR, BUKAN KALKULATOR
    // Semua angka sudah pasti benar dari backend
    // ════════════════════════════════════════════════════
    const prompt = `Anda adalah Asisten Keuangan Pribadi (Finto Financial Mentor & Buddy) untuk Mahasiswa Indonesia. Tugas Anda HANYA menyusun narasi dalam Bahasa Indonesia yang hangat, ramah, dan kasual santuy dari data yang sudah dikalkulasi oleh sistem. DILARANG menghitung ulang, mengestimasi, atau mengarang angka sendiri. Gunakan HANYA angka yang tersedia di bawah ini.

=== DATA TERVERIFIKASI DARI SISTEM ===

[POIN 1 — LIKUIDITAS & RESILIENSI (SKALA MAHASISWA)]
- Net Flow 30 hari: ${netFlow30 >= 0 ? '+' : ''}${rp(netFlow30)}
- Savings Rate: ${savingRate}% → Klasifikasi: ${savingRateLabel}${incomeNote}
- Burn Rate harian: ${rp(Math.round(burnRate))}
- Liquid Runway: ${liquidRunway} hari
- Dana Darurat saat ini: ${rp(balanceEmergency)} (setara ${emergencyCoverMonths} bulan pengeluaran)
- Target minimum mahasiswa 1× pengeluaran bulanan (darurat kecil): ${rp(emergencyTarget1x)} → Status: ${balanceEmergency >= emergencyTarget1x ? 'Sudah aman' : `Gap ${rp(emergencyGap1x)}`}
- Target ideal mahasiswa 2× pengeluaran bulanan (antisipasi telat kiriman): ${rp(emergencyTarget2x)} → Status: ${isEmergency2xMet ? 'Sudah tercapai' : `Gap ${rp(emergencyGap2x)}`}
- Kontribusi bulanan yang direkomendasikan (tutup gap 2× dalam 3 bulan ke depan): ${!isEmergency2xMet ? rp(Math.round(emergencyGap2x / 3)) : '0 (Target 2× sudah aman)'}

[POIN 2 — ALOKASI ANGGARAN]
- Kebutuhan (NEED): ${rp(need30)} = ${needRatio}% dari total pengeluaran (ideal ≤50%, deviasi ${needDeviation >= 0 ? '+' : ''}${needDeviation}poin)
- Keinginan (WANT): ${rp(want30)} = ${wantRatio}% dari total pengeluaran (ideal ≤30%, deviasi ${wantDeviation >= 0 ? '+' : ''}${wantDeviation}poin)
- Alokasi tabungan aktual: ${savingsAlloc}% dari pemasukan (ideal mahasiswa ≥10-15%)
- Top 3 WANT terboros:${top3Want.length > 0 ? '\n' + top3Want.map(([n, v]) => `  • ${n}: ${rp(v)}`).join('\n') : ' Tidak ada'}
- Top 3 NEED terbesar:${top3Need.length > 0 ? '\n' + top3Need.map(([n, v]) => `  • ${n}: ${rp(v)}`).join('\n') : ' Tidak ada'}
- Rekomendasi cap anggaran WANT:${wantCapRecs.length > 0 ? '\n' + wantCapRecs.map(r => `  • ${r.name}: kurangi dari ${rp(r.actual)} → ${rp(r.recommended)} (hemat ${rp(r.saving)}/bulan)`).join('\n') : ' Tidak ada pengeluaran WANT'}

[POIN 3 — AUDIT TRANSAKSI DISKRESIONER]
Jumlah transaksi produktif/kewajiban: ${productive.length} (total ${rp(totalProductive)})
Jumlah transaksi diskresioner: ${discretionary.length} (total ${rp(totalDiscretionary)})
Potensi penghematan (30% dari diskresioner): ${rp(potentialSaving)}/bulan
Detail 8 transaksi terbesar:
${top8Lines}

[POIN 4 — KOMPOSISI KANTONG & ALOKASI DINAMIS]
- Total kekayaan bersih: ${rp(totalWealth)}
- Distribusi saldo aktual di kantong: Dompet Utama ${wealthDistribution.main}% | Dana Darurat ${wealthDistribution.emergency}% | Tabungan ${wealthDistribution.savings}% | Wishlist ${wealthDistribution.wishlist}%
- Target persentase alokasi amplop yang kamu set sendiri di Finto: ${pocketAllocations || 'Belum diatur (masih 0%)'}
${emergencyProgress !== null ? `- Dana Darurat: ${rp(balanceEmergency)} / target ${rp(emergencyTarget)} = ${emergencyProgress}%` : `- Dana Darurat: ${rp(balanceEmergency)} (target belum ditetapkan)`}
${wishlistProgress !== null ? `- Wishlist: ${rp(balanceWishlist)} / target ${rp(wishlistTarget)} = ${wishlistProgress}%` : `- Wishlist: ${rp(balanceWishlist)} (target belum ditetapkan)`}
${expenseGrowth !== null ? `- Tren pengeluaran bulan ini vs bulan lalu: ${expenseGrowth > 0 ? '+' : ''}${expenseGrowth}% (${rp(expenseLastMonth)} → ${rp(expenseThisMonth)})` : ''}
${incomeGrowth !== null ? `- Tren pemasukan bulan ini vs bulan lalu: ${incomeGrowth > 0 ? '+' : ''}${incomeGrowth}% (${rp(incomeLastMonth)} → ${rp(incomeThisMonth)})` : ''}

=== INSTRUKSI NARASI ===
Tulis tepat 4 paragraf analisis (satu per poin). Setiap paragraf:
1. Buka dengan temuan utama menggunakan angka yang tersedia di atas
2. Berikan konteks/interpretasi berdasarkan benchmark yang disebutkan (terutama skala mahasiswa dan alokasi kantong Finto)
3. Tutup dengan 1 rekomendasi tindakan konkret menggunakan angka yang sudah ada

ATURAN KERAS:
- HANYA gunakan angka dari data di atas — DILARANG menghitung atau mengarang angka baru
- Gaya bahasa: Hangat, ramah, dan kasual santuy ala teman mentor finansial (gunakan sapaan 'kamu', mengalir natural, tidak kaku/klinis, mudah dipahami mahasiswa). Hindari emoji berlebihan agar tetap rapi dan profesional namun nyaman dibaca.
- Untuk Poin 4, bandingkan komposisi saldo aktual di kantong-kantongmu dengan target persentase alokasi amplop yang sudah kamu atur sendiri di Finto! Evaluasi apakah distribusimu sudah disiplin atau saldo masih terlalu menumpuk di Dompet Utama.
- Format nominal: Rp 1.500.000 (titik sebagai pemisah ribuan)
- Output: JSON array berisi 4 string. Tidak ada teks di luar array JSON.
OUTPUT:`;

    // ── AI Call ─────────────────────────────────────────────────────────────
    const pointKeyNumbers = [
      [rp(netFlow30), rp(balanceEmergency), rp(Math.round(burnRate)), `${savingRate}%`, rp(emergencyTarget2x)], // Poin 1: Likuiditas
      [`${needRatio}%`, `${wantRatio}%`, rp(need30), rp(want30)],                         // Poin 2: Alokasi 50/30/20
      [rp(totalProductive), rp(totalDiscretionary), rp(potentialSaving)],                // Poin 3: Audit Transaksi
      [rp(totalWealth), `${wealthDistribution.main}%`, `${wealthDistribution.emergency}%`] // Poin 4: Komposisi Aset
    ];

    // 1. Gemini
    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.4 }, // suhu rendah = lebih presisi, kurang hallucination
      });
      const rawText = result.response.text();
      const parsed = extractJsonFromHfOutput(rawText);

      if (Array.isArray(parsed) && isValidAiReport(parsed, pointKeyNumbers)) {
        console.log('[ANALYTICS-AI] ✅ Berhasil via Gemini 2.0 Flash.');
        return NextResponse.json({ success: true, data: { summary: parsed.slice(0, 4), source: 'GEMINI' } });
      }
      console.warn('[ANALYTICS-AI] Gemini output tidak valid atau halusinasi angka.');
    } catch (err: any) {
      console.warn('[ANALYTICS-AI] Gemini gagal, coba Hugging Face...', err.message);
    }

    // 2. Hugging Face
    try {
      const hfText = await callHuggingFace(prompt, { maxNewTokens: 600, temperature: 0.4 });
      const parsed = extractJsonFromHfOutput(hfText);

      if (Array.isArray(parsed) && isValidAiReport(parsed, pointKeyNumbers)) {
        console.log('[ANALYTICS-AI] ✅ Berhasil via Hugging Face.');
        return NextResponse.json({ success: true, data: { summary: parsed.slice(0, 4), source: 'HUGGINGFACE' } });
      }
      console.warn('[ANALYTICS-AI] Hugging Face output tidak valid atau halusinasi angka.');
    } catch (err: any) {
      console.warn('[ANALYTICS-AI] Hugging Face gagal, beralih ke fallback...', err.message);
    }

    // 3. Rule-based fallback — 100% akurat, semua angka dari backend
    return NextResponse.json({ success: true, data: { summary: fallbackSummary, source: 'FALLBACK' } });

  } catch (error) {
    console.error('ANALYTICS SUMMARY ERROR:', error);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}
