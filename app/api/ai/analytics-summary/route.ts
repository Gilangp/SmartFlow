import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { routeAICall, extractJsonFromOutput } from '@/lib/ai/router';
import { buildAnalyticsSummaryPrompt } from '@/lib/ai/prompts';
import { startOfMonth, subMonths, endOfMonth } from 'date-fns';


export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Izinkan waktu eksekusi hingga 60 detik di Vercel/Next.js

const genAI = new GoogleGenerativeAI(
  process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || ''
);

function rp(n: number) {
  return `Rp ${Math.round(n).toLocaleString('id-ID')}`;
}

function parseAiAnalyticsSummary(output: string): string[] | null {
  if (!output || typeof output !== 'string') return null;

  // 1. Coba JSON parse terlebih dahulu
  const jsonParsed = extractJsonFromOutput(output);
  if (Array.isArray(jsonParsed) && jsonParsed.length > 0) {
    const validItems = jsonParsed.map(item => String(item).trim()).filter(s => s.length > 10);
    if (validItems.length > 0) return validItems.slice(0, 4);
  }

  // 2. Bersihkan markdown codeblock
  let cleanText = output
    .replace(/```[a-z]*\s*/gi, '')
    .replace(/```/g, '')
    .trim();

  // 3. Coba pisah berdasarkan bullet points atau nomor (•, -, *, 1., 2.)
  const bulletSplit = cleanText
    .split(/(?:\r?\n\s*|\A)(?:[•\-\*]|\d+[\.\)])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 15);

  if (bulletSplit.length > 0) {
    return bulletSplit.slice(0, 4);
  }

  // 4. Coba pisah berdasarkan ganti paragraf (\n\n)
  const paragraphSplit = cleanText
    .split(/\r?\n\s*\r?\n/)
    .map(s => s.trim())
    .filter(s => s.length > 15);

  if (paragraphSplit.length > 0) {
    return paragraphSplit.slice(0, 4);
  }

  if (cleanText.length > 15) {
    return [cleanText];
  }

  return null;
}

function isValidAiReport(summary: any): boolean {
  if (!Array.isArray(summary) || summary.length === 0) return false;
  
  for (const item of summary) {
    const text = String(item || '').trim();
    if (text.length < 10) return false;
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

    const totalWealth = user.pockets.reduce((s, p) => s + Number(p.balance ?? 0), 0);
    const pocketAllocations = user.pockets
      .map(p => `${p.name}: ${p.allocation}%`)
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
    const liquidRunway     = burnRate > 0 ? Math.floor(totalWealth / burnRate) : 999;
    const runwayMonths     = burnRate > 0 ? Math.round((totalWealth / burnRate / 30) * 10) / 10 : 0;

    // Benchmark Savings Rate dikalibrasi untuk mahasiswa (tanpa income mandiri rutin):
    // ≥15% Sangat Sehat (Ideal Mahasiswa), 10-15% Cukup Sehat, <10% Rentan/Waspada.
    const savingRateLabel =
      savingRate >= 15 ? 'Sangat Sehat (Ideal Mahasiswa ≥15%)' :
      savingRate >= 10 ? 'Cukup Sehat (Standard Mahasiswa 10-15%)' :
      savingRate >= 0  ? 'Rentan / Rentang Waspada (<10%)' : 'Kritis / Defisit';

    const monthlyExpense = daysOfHistory < 30
      ? Math.round((expense90 / daysOfHistory) * 30)
      : Math.round(expense90 / Math.min(3, daysOfHistory / 30));

    // Untuk mahasiswa, target ketahanan kas/buffer yang realistis adalah 1× hingga 2× pengeluaran bulanan
    // (mengantisipasi telat kiriman uang saku atau darurat kecil), dinilai dari total saldo di seluruh kantong mereka.
    const targetBuffer2x = monthlyExpense * 2;
    const isBuffer2xMet  = totalWealth >= targetBuffer2x;
    const bufferGap2x    = Math.max(0, targetBuffer2x - totalWealth);

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
    const potentialSaving = Math.round(totalDiscretionary * 0.3);

    const top8Lines = top8Tx.map(tx => {
      const catType = tx.category?.type === 'WANT' ? 'Diskresioner' : 'Produktif';
      const note    = tx.notes ? ` | "${tx.notes}"` : '';
      const pocket  = (tx as any).pocket?.name || '-';
      return `[${tx.date.toISOString().split('T')[0]}][${pocket}] ${tx.category?.name || 'Lainnya'} (${catType}): ${rp(Number(tx.amount))}${note}`;
    }).join('\n');

    // — Poin 4: Komposisi Aset & Tren ────────────────────
    const expenseGrowth = expenseLastMonth > 0
      ? Math.round(((expenseThisMonth - expenseLastMonth) / expenseLastMonth) * 100)
      : null;
    const incomeGrowth = incomeLastMonth > 0
      ? Math.round(((incomeThisMonth - incomeLastMonth) / incomeLastMonth) * 100)
      : null;

    const actualPocketDistribution = user.pockets
      .map(p => {
        const pct = totalWealth > 0 ? Math.round((Number(p.balance) / totalWealth) * 100) : 0;
        return `${p.name}: ${rp(Number(p.balance))} (${pct}%)`;
      })
      .join(' | ');

    // ════════════════════════════════════════════════════
    // RULE-BASED FALLBACK (jika AI gagal, hasilnya masih
    // 100% akurat karena semua angka dari backend)
    // ════════════════════════════════════════════════════
    const wantCapFallbackText = wantCapRecs.length > 0
      ? `Meski sudah irit, kamu bisa lebih hemat dengan merem pengeluaran jajan:\n` + wantCapRecs.map(r => `• ${r.name}: turunkan dari ${rp(r.actual)} → ${rp(r.recommended)} (hemat ${rp(r.saving)}/bulan)`).join('\n')
      : 'Kamu sudah sangat disiplin karena tidak ada pengeluaran Keinginan berlebih periode ini.';

    const incomeNote = isIncomeAveraged ? ' (diperhitungkan dari rata-rata kiriman historis karena kiriman utama bulan ini belum masuk / bersifat sporadis)' : '';

    const fallbackSummary = [
      `Kondisi keuanganmu ${netFlow30 >= 0 ? `cukup sehat dengan sisa uang masuk bersih sebesar **${rp(netFlow30)}** bulan ini.` : `mengalami defisit sebesar **${rp(Math.abs(netFlow30))}** bulan ini.`} Kamu menghabiskan rata-rata **${rp(Math.round(burnRate))}** setiap hari, sehingga total uang **${rp(totalWealth)}** yang kamu miliki sekarang cukup untuk bertahan selama **${liquidRunway} hari** ke depan. ${isBuffer2xMet ? `Total saldomu sudah di zona aman karena melebihi target ideal 2× pengeluaran (${rp(targetBuffer2x)}).` : `Total saldomu masih kurang **${rp(bufferGap2x)}** untuk mencapai target saldo aman (${rp(targetBuffer2x)}). Pertahankan disiplin menabung dan sisihkan minimal **${rp(Math.round(bufferGap2x / 3))}/bulan** agar masa bertahanmu lebih panjang.`}`,

      `Pengeluaranmu saat ini didominasi **Kebutuhan pokok sebesar ${needRatio}%** (${rp(need30)}), sementara **Keinginan atau jajan sebesar ${wantRatio}%** (${rp(want30)}). ${wantCapFallbackText} Mulai terapkan batas jajan tersebut bulan depan agar pengeluaran lebih terkendali.`,

      `Selama sebulan ini, dari 8 transaksi terbesar: kamu melakukan **${productive.length} transaksi produktif/kewajiban** (${rp(totalProductive)}) dan **${discretionary.length} transaksi hura-hura/non-pokok** (${rp(totalDiscretionary)}). ${potentialSaving > 0 ? `Potensi penghematan 30% dari belanja non-pokok: **${rp(potentialSaving)}/bulan**.` : 'Kamu sudah sangat disiplin dalam memprioritaskan hal penting dibandingkan keinginan sesaat.'} Pertahankan kebiasaan belanja hanya untuk hal yang benar-benar bermanfaat.`,

      `Saat ini uangmu sebesar **${rp(totalWealth)}** tersebar di ${user.pockets.length} kantong aktif: **${actualPocketDistribution}**. Target alokasi yang kamu atur: ${pocketAllocations || 'Belum diatur'}. ${user.pockets.length <= 2 ? 'Pastikan pembagian saldo rutin dilakukan ke kantong tabungan khusus agar target saldo aman bisa segera tercapai.' : 'Dengan kantong yang sudah kamu atur, pastikan pembagian saldo dilakukan konsisten sesuai proporsi alokasinya!'}`,
    ];

    // ════════════════════════════════════════════════════
    // PROMPT: LLM = NARRATOR, BUKAN KALKULATOR
    // Semua angka sudah pasti benar dari backend
    // ════════════════════════════════════════════════════
    const prompt = buildAnalyticsSummaryPrompt({
      netFlow30,
      rp,
      savingRate,
      savingRateLabel,
      incomeNote,
      burnRate,
      liquidRunway,
      runwayMonths,
      totalWealth,
      targetBuffer2x,
      isBuffer2xMet,
      bufferGap2x,
      need30,
      needRatio,
      needDeviation,
      want30,
      wantRatio,
      wantDeviation,
      wantCapRecs,
      productiveLength: productive.length,
      totalProductive,
      discretionaryLength: discretionary.length,
      totalDiscretionary,
      potentialSaving,
      pocketsLength: user.pockets.length,
      actualPocketDistribution,
      pocketAllocations,
    });

    // ── STREAMING RESPONSE ARCHITECTURE ────────────────
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        // 1. Panggil 9Router / AI Gateway utama
        try {
          const aiRes = await routeAICall(
            [{ role: 'user', content: prompt }],
            { modelType: 'TEXT', temperature: 0.4, maxTokens: 600, timeoutMs: 45000 }
          );
          if (aiRes.success && aiRes.content) {
            const parsed = parseAiAnalyticsSummary(aiRes.content);
            if (Array.isArray(parsed) && isValidAiReport(parsed)) {
              console.log(`[ANALYTICS-AI] ✅ Streamed AI via ${aiRes.modelUsed} (${aiRes.tokenUsed}).`);
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ summary: parsed.slice(0, 4), source: aiRes.modelUsed })}\n\n`)
              );
              controller.close();
              return;
            }
          }
        } catch (err: any) {
          console.warn('[ANALYTICS-AI] Gateway error:', err.message);
        }

        // 2. Fallback ke Gemini 2.0 Flash
        try {
          const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
          const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.4, maxOutputTokens: 600 },
          });
          const rawText = result.response.text();
          const parsed = parseAiAnalyticsSummary(rawText);

          if (Array.isArray(parsed) && isValidAiReport(parsed)) {
            console.log('[ANALYTICS-AI] ✅ Streamed AI via Gemini 2.0 Flash.');
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ summary: parsed.slice(0, 4), source: 'GEMINI' })}\n\n`)
            );
            controller.close();
            return;
          }
        } catch (err: any) {
          console.warn('[ANALYTICS-AI] Gemini error:', err.message);
        }

        // 3. Hanya jika SEMUA AI gagal/error, baru kirimkan data kalkulasi backend sebagai cadangan
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ summary: fallbackSummary, source: 'BACKEND_FALLBACK' })}\n\n`)
        );
        controller.close();
      }
    });

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('ANALYTICS SUMMARY ERROR:', error);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}
