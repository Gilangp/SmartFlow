import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getDaysLeftInCycle } from '@/lib/financial-calculations';
import { routeAICall } from '@/lib/ai/router';


export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const genAI = new GoogleGenerativeAI(
  process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || ''
);

import { buildRoastPrompt } from '@/lib/ai/prompts';

function sanitizeRoastText(text: string): string {
  let cleaned = text.trim().replace(/^["'`]|["'`]$/g, '');
  if (!cleaned) return cleaned;

  // Jika teks tidak diakhiri tanda titik, seru, atau tanya
  if (!/[.!?]$/.test(cleaned)) {
    const words = cleaned.split(/\s+/);
    const lastWord = words[words.length - 1] || '';
    // Jika kata terakhir terpotong di tengah (kurang dari 3 huruf), buang kata terpotong tersebut
    if (lastWord.length <= 3 && words.length > 4) {
      words.pop();
      cleaned = words.join(' ') + '.';
    } else {
      cleaned = cleaned + '.';
    }
  }
  return cleaned;
}

// ─── VALIDATION & STATIC FALLBACK ─────────────────────────────────────────────
function isValidRoast(text: string): boolean {
  if (!text || text.length < 90) return false;
  const sentenceCount = (text.match(/[.!?]/g) || []).length;
  if (sentenceCount < 2) return false;

  // Dilarang karakter asing: Mandarin, Arab, Jepang, Korea, Sirilik, atau Emoji
  const foreignScriptOrEmoji = /[\u0600-\u06FF|\u0400-\u04FF|\u3040-\u30FF|\uAC00-\uD7AF|\u4E00-\u9FFF]|\p{Emoji_Presentation}/u;
  if (foreignScriptOrEmoji.test(text)) return false;
  // Dilarang awalan bahasa Inggris atau kata pengantar yang umum keluar dari LLM
  const englishOrIntro = /^(here is|sure,|as an ai|based on|basically|literally|btw|fyi|anyway)/i;
  if (englishOrIntro.test(text)) return false;
  return true;
}

function fallbackRoast(
  userName: string,
  balance: number,
  dailyAllowance: number,
  todayExpense: number,
  wantRatio: number,
  topWantCategories: string[]
): string {
  const topCat = topWantCategories.length > 0 ? topWantCategories[0] : 'jajan konsumtif';
  const rp = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`;

  if (balance <= 50000 || dailyAllowance < 15000) {
    return `${userName}, dompet kamu lagi dalam mode hemat nih dengan saldo ${rp(balance)}. Jatah harian tersisa ${rp(dailyAllowance)}/hari untuk bertahan sampai gajian. Yuk rem tipis-tipis dulu pengeluaran Keinginan biar tetep aman sampai akhir bulan.`;
  }
  if (todayExpense > dailyAllowance * 1.5 && dailyAllowance > 0) {
    return `Pengeluaran kamu hari ini tembus ${rp(todayExpense)}, padahal jatah harian ideal kamu di kisaran ${rp(dailyAllowance)}/hari. Ada bocor halus yang bikin dompet agak ketarik hari ini. Besok coba lebih chill dan utamakan kebutuhan pokok aja ya.`;
  }
  if (wantRatio > 50) {
    return `${userName}, sekitar ${wantRatio}% pengeluaran kamu bulan ini lari ke pos Keinginan, terutama di ${topCat}. Angka ini agak melebihi alokasi sehat 30% buat kantong mahasiswa. Coba geser sebagian jajan ke tabungan biar arus kas kamu makin seimbang.`;
  }
  return `Kondisi keuangan kamu hari ini terpantau aman banget, ${userName}! Saldo Dompet Utama masih ada ${rp(balance)} dengan jatah harian ${rp(dailyAllowance)}/hari. Pertahankan ritme ini biar dompet tetep tenang dan siap hadapi akhir pekan.`;
}

export async function GET(request: NextRequest) {
  try {
    // ── AUTH ────────────────────────────────────────────────────────────────
    const token = extractTokenFromHeader(request.headers.get('Authorization') || '');
    if (!token) return NextResponse.json({ success: false, message: 'No token provided' }, { status: 401 });

    const decoded = verifyToken(token);
    if (!decoded) return NextResponse.json({ success: false, message: 'Invalid token' }, { status: 401 });

    // ── USER + ALL POCKETS ──────────────────────────────────────────────────
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: { pockets: true },
    });
    if (!user) return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });

    const mainWallet = user.pockets.find((p) => p.type === 'MAIN');
    if (!mainWallet) return NextResponse.json({ success: false, message: 'Main pocket not found' }, { status: 404 });

    const balance = Number(mainWallet.balance || 0);
    const totalWealth = user.pockets.reduce((sum, p) => sum + Number(p.balance || 0), 0);

    // ── TRANSACTIONS: 30 HARI SEMUA KANTONG ────────────────────────────────
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const transactions = await prisma.transaction.findMany({
      where: {
        userId: user.id,
        date: { gte: thirtyDaysAgo },
        // Semua kantong — bukan hanya MAIN
      },
      include: {
        category: true,
        pocket: { select: { name: true } },
      },
      orderBy: { date: 'asc' },
    });

    if (!transactions.length) {
      return NextResponse.json({
        success: true,
        data: { message: '30 hari terakhir kosong transaksi. Antara super disiplin, atau belum dicatat aja nih?' },
      });
    }

    // ── KALKULASI JATAH HARIAN ──────────────────────────────────────────────
    const now = new Date();
    let hasReceivedEarlySalary = false;
    const paydayDate = user.paydayDate;

    if (paydayDate && paydayDate > 1) {
      const currentDay = now.getDate();
      if (currentDay < paydayDate) {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const todayEnd = new Date(now.getFullYear(), now.getMonth(), currentDay + 1);
        const earlyIncome = await prisma.transaction.findFirst({
          where: { userId: user.id, type: 'INCOME_ROUTINE', status: 'COMPLETED', date: { gte: startOfMonth, lt: todayEnd } },
        });
        if (earlyIncome) hasReceivedEarlySalary = true;
      }
    }

    const daysLeftInMonth = getDaysLeftInCycle(now, paydayDate, hasReceivedEarlySalary);
    const dailyAllowance = balance / Math.max(daysLeftInMonth, 1);

    // Helper untuk konsistensi zona waktu WIB (Asia/Jakarta)
    const getWibDateStr = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
    const todayStr = getWibDateStr(now);
    const yesterdayDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayStr = getWibDateStr(yesterdayDate);

    // ── AGREGASI DATA ────────────────────────────────────────────────────────
    let todayExpense = 0;
    let yesterdayExpense = 0;
    let last7DayExpense = 0;
    let last30DayExpense = 0;
    let last30DayIncome = 0;
    let wantSpend30Days = 0;
    let needSpend30Days = 0;

    const wantCategoryMap: Record<string, number> = {};
    const expenseList: string[] = [];

    for (const t of transactions) {
      const amount = Number(t.amount);
      const txDate = new Date(t.date);
      const txDateStr = getWibDateStr(txDate);

      if (t.type === 'EXPENSE') {
        last30DayExpense += amount;

        if (txDateStr === todayStr) todayExpense += amount;
        if (txDateStr === yesterdayStr) yesterdayExpense += amount;
        if (txDate >= sevenDaysAgo) last7DayExpense += amount;

        const catType = t.category?.type;
        const catName = t.category?.name || 'Lainnya';
        const pocketName = (t as any).pocket?.name || 'Kantong';

        if (catType === 'WANT') {
          wantSpend30Days += amount;
          wantCategoryMap[catName] = (wantCategoryMap[catName] || 0) + amount;
        } else {
          needSpend30Days += amount;
        }

        const notesStr = t.notes ? ` (Catatan: "${t.notes}")` : '';
        expenseList.push(
          `- [${txDateStr}] [Kantong: ${pocketName}] ${catName} (${catType === 'WANT' ? 'Keinginan' : 'Kebutuhan'}): Rp ${amount.toLocaleString('id-ID')}${notesStr}`
        );
      }

      if (t.type.startsWith('INCOME')) {
        last30DayIncome += amount;
      }
    }

    const avgDailySpend7Days = last7DayExpense / 7;

    // Top 3 kategori WANT terboros
    const topWantCategories = Object.entries(wantCategoryMap)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([name, total]) => `${name} (Rp ${total.toLocaleString('id-ID')})`);

    // ── SPENDING ALERT ───────────────────────────────────────────────────────
    let spendingAlert = '';
    const wantRatio = last30DayExpense > 0 ? Math.round((wantSpend30Days / last30DayExpense) * 100) : 0;

    if (todayExpense > dailyAllowance * 1.5 && dailyAllowance > 0) {
      spendingAlert = `Pengeluaran hari ini (Rp ${todayExpense.toLocaleString('id-ID')}) melampaui 150% jatah harian ideal (Rp ${Math.round(dailyAllowance).toLocaleString('id-ID')})!`;
    } else if (todayExpense > yesterdayExpense * 2 && yesterdayExpense > 15000) {
      spendingAlert = `Lonjakan pengeluaran drastis! Hari ini Rp ${todayExpense.toLocaleString('id-ID')}, kemarin hanya Rp ${yesterdayExpense.toLocaleString('id-ID')}.`;
    } else if (wantRatio > 60) {
      spendingAlert = `${wantRatio}% pengeluaran 30 hari terakhir masuk kategori Keinginan (belanja konsumtif/non-esensial) — rasio yang cukup mengkhawatirkan.`;
    } else if (avgDailySpend7Days > dailyAllowance * 1.2 && dailyAllowance > 0) {
      spendingAlert = `Rata-rata pengeluaran harian 7 hari terakhir (Rp ${Math.round(avgDailySpend7Days).toLocaleString('id-ID')}) sudah 20% di atas jatah harian ideal.`;
    }

    // ── TONE SELECTION ───────────────────────────────────────────────────────
    const isGoodSpendingStatus = todayExpense <= dailyAllowance * 0.8 && balance > 50000 && wantRatio <= 40;
    const isBrokeStatus = balance <= 50000 || dailyAllowance < 15000;

    let selectedTone: string;
    if (isBrokeStatus) {
      const tones = [
        'jujur, prihatin, tapi tetap memotivasi dengan saran konkret',
        'teman curhat yang ikut khawatir tapi memberikan langkah nyata untuk survive',
        'serius dan tegas tapi hangat — karena kondisi memang butuh perhatian nyata',
      ];
      selectedTone = tones[Math.floor(Math.random() * tones.length)];
    } else if (isGoodSpendingStatus) {
      const tones = [
        'bangga dan apresiasi — tapi selipkan peringatan spesifik dari tren data',
        'suportif, namun tetap mengingatkan potensi kebocoran dari kebiasaan tertentu',
        'senang melihat kedisiplinan, tapi minta user tidak lengah karena masih ada risiko dari pola tertentu',
      ];
      selectedTone = tones[Math.floor(Math.random() * tones.length)];
    } else {
      const tones = [
        'blak-blakan dan spesifik — sebut langsung kategori atau kebiasaan boros yang nyata dari data',
        'tegas dan lugas tapi tetap peduli — roast dengan fakta, bukan asumsi',
        'sarkas tajam ala teman akrab yang sudah cukup sabar melihat pengeluaran konsumtifmu',
        'langsung to the point tanpa basa-basi, karena data bicara sendiri',
      ];
      selectedTone = tones[Math.floor(Math.random() * tones.length)];
    }

    const todayDateStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
    const userName = user.name?.split(' ')[0] || 'bro';

    const prompt = buildRoastPrompt({
      userName,
      balance,
      totalWealth,
      dailyAllowance,
      avgDailySpend7Days,
      wantRatio,
      topWantCategories,
      spendingAlert,
      expenses: expenseList,
      tone: selectedTone,
      todayDateStr,
    });

    // ── AI CALL — BERTINGKAT ─────────────────────────────────────────────────

    // 1. DEEPSEEK-V4-FLASH VIA AI GATEWAY (UTAMA)
    try {
      const aiRes = await routeAICall(
        [{ role: 'user', content: prompt }],
        { modelType: 'TEXT', temperature: 0.5, maxTokens: 220, timeoutMs: 25000 }
      );
      if (aiRes.success && aiRes.content) {
        let text = sanitizeRoastText(aiRes.content);
        if (isValidRoast(text)) {
          console.log(`[ROAST] ✅ Berhasil via ${aiRes.modelUsed} (${aiRes.tokenUsed}).`);
          return NextResponse.json({ success: true, data: { message: text } });
        }
      }
      throw new Error('AI Gateway output failed quality validation');
    } catch (gatewayErr: any) {
      console.warn('[ROAST] AI Gateway gagal atau tidak valid, beralih ke Gemini 2.0 Flash...', gatewayErr.message);
    }

    // 2. GEMINI 2.0 FLASH (FALLBACK)
    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.5, maxOutputTokens: 220 },
      });
      const response = await result.response;
      let text = sanitizeRoastText(response.text());

      if (isValidRoast(text)) {
        console.log('[ROAST] ✅ Berhasil via Gemini 2.0 Flash.');
        return NextResponse.json({ success: true, data: { message: text } });
      }
      throw new Error('Gemini output failed quality validation');
    } catch (geminiError: any) {
      console.warn('[ROAST] Gemini gagal atau tidak valid, beralih ke static fallback...', geminiError.message);
    }

    // 3. STATIC FALLBACK (SAFETY NET - PERSONALIZED)
    console.log('[ROAST] Menggunakan static roast pool sebagai safety net.');
    return NextResponse.json({
      success: true,
      data: { message: fallbackRoast(userName, balance, dailyAllowance, todayExpense, wantRatio, topWantCategories) },
    });

  } catch (error) {
    console.error('ROAST ERROR:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to generate roast', error: String(error) },
      { status: 500 }
    );
  }
}