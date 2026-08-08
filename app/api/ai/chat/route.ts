import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { routeAICall } from '@/lib/ai/router';
import { buildChatSystemPrompt } from '@/lib/ai/prompts';
import { getDaysLeftInCycle } from '@/lib/financial-calculations';
import { getUserSubscription } from '@/lib/subscription';

export const dynamic = 'force-dynamic';

// 🛡️ In-memory Store untuk membatasi Kuota Chat AI harian per User (Hemat Biaya API Developer)
const dailyChatStore = new Map<string, { date: string; count: number }>();

function checkAndIncrementAiChatLimit(userId: string, maxPerDay: number): { allowed: boolean; remaining: number } {
  const todayStr = new Date().toISOString().split('T')[0];
  const userRecord = dailyChatStore.get(userId);

  if (!userRecord || userRecord.date !== todayStr) {
    dailyChatStore.set(userId, { date: todayStr, count: 1 });
    return { allowed: true, remaining: maxPerDay - 1 };
  }

  if (userRecord.count >= maxPerDay) {
    return { allowed: false, remaining: 0 };
  }

  userRecord.count += 1;
  dailyChatStore.set(userId, userRecord);
  return { allowed: true, remaining: maxPerDay - userRecord.count };
}

function generateSmartChatFallback(
  userMsg: string,
  userName: string,
  mainBalance: number,
  totalWealth: number,
  dailyAllowance: number,
  daysLeft: number,
  pockets: Array<{ name: string; type: string; balance: any; allocation: number }>
): string {
  const lowerMsg = userMsg.toLowerCase().trim();
  const rp = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`;

  // 1. INTENT: SAPAAN SINGKAT / GREETING
  if (/^(halo|hai|hi|hey|pagi|siang|sore|malam|tes|test|ping|ok|okay|siap)$/i.test(lowerMsg)) {
    return `Halo ${userName}! Saya siap membantu. Kamu bisa menanyakan hal spesifik seperti:\n- *"Berikan saran penghematan minggu ini"*\n- *"Bagaimana alokasi kantong saya?"*\n- *"Berapa jatah harian ideal saya?"*`;
  }

  // 2. INTENT: POCKET / DOMPET / ALOKASI SINKRONISASI
  if (/dompet|kantong|alokasi|pos|atur|pengaturan/i.test(lowerMsg)) {
    const pocketListStr = pockets
      .map(p => `- **${p.name}**: ${rp(Number(p.balance))} (Target Alokasi: ${p.allocation}%)`)
      .join('\n');

    return `Tentu ${userName}! Berdasarkan kondisi kantongmu saat ini:\n\n${pocketListStr}\n- **Total Kekayaan**: ${rp(totalWealth)}\n- **Jatah Harian Ideal**: ${rp(dailyAllowance)}/hari (sisa ${daysLeft} hari ke gajian).\n\n**Saran Pengaturan Kantong Finto yang Ideal**:\n1. **Dompet Utama (Operasional Harian)**: Saldo saat ini ${rp(mainBalance)}. Gunakan khusus untuk makan & transportasi harian dengan batas belanja **${rp(dailyAllowance)}/hari**.\n2. **Kantong Pegangan / Kas Kecil**: Gunakan untuk pengeluaran darurat tunai atau transaksi dadakan kecil agar saldo Dompet Utama tidak terganggu.\n3. **Kantong Tabungan / Impian**: Saat ada uang saku/gajian masuk, sisihkan minimal **15-20% di awal** langsung ke kantong ini sebelum dipakai belanja!`;
  }

  // 3. INTENT: MENABUNG / HEMAT / TIPS / RENCANA / MINGGU INI / ANGGARAN
  if (/hemat|nabung|menabung|investasi|simpan|tips|trik|rencana|minggu|anggaran|target/i.test(lowerMsg)) {
    return `Halo ${userName}! Berikut rencana penghematan & strategi harian untuk posisi keuanganmu:\n\n1. **Patokan Anggaran Harian**: Jatah harian idealmu adalah **${rp(dailyAllowance)}/hari** dari Dompet Utama (${rp(mainBalance)}). Jika belanja harian di bawah angka ini, sisanya otomatis menjadi tabungan tambahan.\n2. **Prioritas Pengeluaran Mingguan**:\n   - **Wajib**: Makan & transportasi harian.\n   - **Ditunda/Dikurangi**: Kopi kekinian, jajan konsumtif, dan *food delivery*.\n3. **Aturan 24 Jam**: Untuk barang di luar kebutuhan wajib, tunda pembelian selama 24 jam untuk mencegah belanja impulsif.`;
  }

  // 4. INTENT: BOROS / KONTROL PENGELUARAN / TRANSAKSI
  if (/boros|bocor|boncos|kemarin|transaksi|habis|belanja|makan|kopi|jajan/i.test(lowerMsg)) {
    return `Halo ${userName}, mari kita evaluasi pengeluaranmu:\n\n- **Sisa Saldo Dompet Utama**: ${rp(mainBalance)}\n- **Jatah Harian Safe**: ${rp(dailyAllowance)}/hari (untuk ${daysLeft} hari ke gajian).\n\nJika ada lonjakan pengeluaran sebelumnya, prioritaskan 3 hari ke depan untuk hemat pada pos Keinginan (seperti kopi kafe atau jajan non-pokok) agar ritme harianmu kembali aman di kisaran ${rp(dailyAllowance)}/hari!`;
  }

  // 5. DEFAULT INTENT
  return `Halo ${userName}! Berdasarkan catatan keuanganmu saat ini:\n- **Dompet Utama**: ${rp(mainBalance)}\n- **Total Kekayaan**: ${rp(totalWealth)}\n- **Jatah Harian Ideal**: ${rp(dailyAllowance)}/hari (sisa ${daysLeft} hari ke gajian).\n\nAda yang bisa saya bantu lebih detail mengenai alokasi kantong, strategi hemat, atau audit pengeluaranmu?`;
}

export async function POST(request: NextRequest) {
  try {
    const token = extractTokenFromHeader(request.headers.get('Authorization') || '');
    if (!token) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

    const decoded = verifyToken(token);
    if (!decoded) return NextResponse.json({ success: false, message: 'Invalid token' }, { status: 401 });

    const body = await request.json();
    const { message, conversationHistory = [] } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ success: false, message: 'Pesan wajib diisi' }, { status: 400 });
    }

    // Retrieve user details and pockets
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: { pockets: true, subscription: true },
    });

    if (!user) return NextResponse.json({ success: false, message: 'User tidak ditemukan' }, { status: 404 });

    // Pengecekan Batas Kuota AI Chat Harian per Paket Subskripsi
    const sub = await getUserSubscription(user.id);
    const maxChats = sub.limits.maxAiChatsPerDay;

    if (maxChats !== null) {
      const { allowed } = checkAndIncrementAiChatLimit(user.id, maxChats);
      if (!allowed) {
        return NextResponse.json({
          success: true,
          content: `Halo ${user.name}! Kamu telah mencapai kuota maksimal **${maxChats} pesan AI Chat per hari** untuk paket **${sub.plan}** demi menjaga kestabilan sistem.\n\n${
            sub.plan === 'TRIAL'
              ? '*Upload KTM untuk naik ke Paket Student (50 chat/hari), atau Upgrade Premium untuk Chat Tanpa Batas!*'
              : '*Upgrade ke Paket Premium untuk menikmati akses AI Chat tanpa batas!*'
          }`,
        });
      }
    }

    const mainPocket = user.pockets.find(p => p.type === 'MAIN');
    const mainBalance = Number(mainPocket?.balance || 0);
    const totalWealth = user.pockets.reduce((sum, p) => sum + Number(p.balance || 0), 0);

    // Calculate days left & daily allowance
    const now = new Date();
    const daysLeft = getDaysLeftInCycle(now, user.paydayDate, false);
    const dailyAllowance = mainBalance / Math.max(daysLeft, 1);

    // Get recent transactions for context
    const recentTxns = await prisma.transaction.findMany({
      where: { userId: user.id, status: 'COMPLETED' },
      include: { category: true, pocket: true },
      orderBy: { date: 'desc' },
      take: 15,
    });

    const pocketsSummary = user.pockets
      .map(p => `- ${p.name} (${p.type}): Rp ${Number(p.balance).toLocaleString('id-ID')} (Alokasi: ${p.allocation}%)`)
      .join('\n');

    const txnsSummary = recentTxns
      .map(t => `- [${t.date.toISOString().split('T')[0]}] [${t.pocket.name}] ${t.type === 'EXPENSE' ? 'Pengeluaran' : 'Pemasukan'} Rp ${Number(t.amount).toLocaleString('id-ID')} (${t.category?.name || 'Tanpa Kategori'}) - Notes: ${t.notes || '-'}`)
      .join('\n');

    const firstName = user.name ? user.name.split(' ')[0] : 'Sobat';

    const systemPrompt = buildChatSystemPrompt({
      userName: firstName,
      plan: user.subscription?.plan || 'TRIAL',
      mainBalance,
      totalWealth,
      dailyAllowance,
      daysLeft,
      pocketsSummary,
      txnsSummary,
    });

    const formattedMessages = [
      { role: 'system' as const, content: systemPrompt },
      ...conversationHistory.map((h: any) => ({
        role: h.role === 'user' ? ('user' as const) : ('assistant' as const),
        content: String(h.content),
      })),
      { role: 'user' as const, content: message },
    ];

    const aiRes = await routeAICall(formattedMessages, { modelType: 'TEXT', temperature: 0.4, maxTokens: 3000 });

    if (aiRes.success && aiRes.content) {
      return NextResponse.json({
        success: true,
        data: {
          reply: aiRes.content,
          modelUsed: aiRes.modelUsed,
          tokenUsed: aiRes.tokenUsed,
        },
      });
    }

    // Smart Intent-Aware Fallback Response (jika provider AI eksternal sedang rate-limited / slow)
    const fallbackReply = generateSmartChatFallback(
      message,
      firstName,
      mainBalance,
      totalWealth,
      dailyAllowance,
      daysLeft,
      user.pockets
    );

    return NextResponse.json({
      success: true,
      data: {
        reply: fallbackReply,
        modelUsed: 'finto-financial-engine',
        tokenUsed: 'PRIMARY',
      },
    });

  } catch (error: any) {
    console.error('AI Chat Error:', error);
    return NextResponse.json({
      success: false,
      message: 'Terjadi kesalahan internal pada layanan AI Chat.',
      error: error.message,
    }, { status: 500 });
  }
}
