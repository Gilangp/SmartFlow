import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { routeAICall } from '@/lib/ai/router';
import { buildChatSystemPrompt } from '@/lib/ai/prompts';
import { getDaysLeftInCycle } from '@/lib/financial-calculations';

export const dynamic = 'force-dynamic';

function generateSmartChatFallback(
  userMsg: string,
  userName: string,
  mainBalance: number,
  totalWealth: number,
  dailyAllowance: number,
  daysLeft: number,
  pockets: Array<{ name: string; type: string; balance: any; allocation: number }>
): string {
  const lowerMsg = userMsg.toLowerCase();
  const rp = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`;

  // 1. INTENT: POCKET / DOMPET / ALOKASI SINKRONISASI
  if (/dompet|kantong|alokasi|pos|atur|pengaturan/i.test(lowerMsg)) {
    const pocketListStr = pockets
      .map(p => `- **${p.name}**: ${rp(Number(p.balance))} (Target Alokasi: ${p.allocation}%)`)
      .join('\n');

    return `Tentu ${userName}! Berdasarkan kondisi kantongmu saat ini:

${pocketListStr}
- **Total Kekayaan**: ${rp(totalWealth)}
- **Jatah Harian Ideal**: ${rp(dailyAllowance)}/hari (sisa ${daysLeft} hari ke gajian).

💡 **Saran Pengaturan Kantong Finto yang Ideal**:
1. **Dompet Utama (Operasional Harian)**: Saldo saat ini ${rp(mainBalance)}. Gunakan khusus untuk makan & transportasi harian. Jaga batas belanja harian di angka **${rp(dailyAllowance)}/hari**.
2. **Kantong Pegangan / Kas Kecil**: Gunakan untuk pengeluaran darurat tunai atau transaksi dadakan kecil agar saldo Dompet Utama tidak terganggu.
3. **Kantong Tabungan / Impian**: Saat uang saku/gajian berikutnya masuk, sisihkan minimal **15-20% di awal** langsung ke kantong ini secara konsisten sebelum dipakai belanja!`;
  }

  // 2. INTENT: MENABUNG / HEMAT / TIPS
  if (/hemat|nabung|menabung|investasi|simpan|tips|trik/i.test(lowerMsg)) {
    return `Halo ${userName}! Berikut strategi hemat & menabung yang tepat untuk posisi keuanganmu:

1. **Jaga Batas Harian**: Jatah harian idealmu adalah **${rp(dailyAllowance)}/hari** dari Dompet Utama (${rp(mainBalance)}). Jika hari ini belanja di bawah batas tersebut, selisihnya otomatis menambah tabunganmu!
2. **Aturan 24 Jam**: Saat mau beli barang di luar kebutuhan pokok (Keinginan), tunda 24 jam. Seringkali keinginan impulsif itu hilang besoknya.
3. **Otomatisasi Alokasi**: Setiap kali ada pemasukan masuk, langsung alokasikan minimal 15% ke kantong Tabungan sebelum digunakan untuk operasional.`;
  }

  // 3. INTENT: BOROS / KONTROL PENGELUARAN
  if (/boros|bocor|boncos|kemarin|transaksi|habis/i.test(lowerMsg)) {
    return `Halo ${userName}, mari kita evaluasi pengeluaranmu:

- **Sisa Saldo Dompet Utama**: ${rp(mainBalance)}
- **Jatah Harian Safe**: ${rp(dailyAllowance)}/hari (untuk ${daysLeft} hari ke depan).

Jika ada lonjakan pengeluaran sebelumnya, prioritaskan 3 hari ke depan untuk *zero-spend* pada pos Keinginan (seperti kopi kafe, jajan non-pokok, atau nongkrong) agar ritme harianmu kembali seimbang di angka ${rp(dailyAllowance)}/hari!`;
  }

  // 4. DEFAULT INTENT
  return `Halo ${userName}! Berdasarkan catatan keuanganmu saat ini:
• **Dompet Utama**: ${rp(mainBalance)}
• **Total Kekayaan**: ${rp(totalWealth)}
• **Jatah Harian Ideal**: ${rp(dailyAllowance)}/hari (sisa ${daysLeft} hari ke gajian).

Ada yang bisa saya bantu lebih detail mengenai alokasi kantong, strategi hemat, atau audit transaksi harianmu hari ini?`;
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

    const systemPrompt = buildChatSystemPrompt({
      userName: user.name,
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

    const aiRes = await routeAICall(formattedMessages, { modelType: 'TEXT', temperature: 0.4 });

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
      user.name || 'Sobat',
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
