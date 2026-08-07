import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { routeAICall } from '@/lib/ai/router';
import { getDaysLeftInCycle } from '@/lib/financial-calculations';

export const dynamic = 'force-dynamic';

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

    const systemPrompt = `
Kamu adalah Finto AI, asisten dan konsultan keuangan cerdas yang ramah, jujur, dan membantu penggunamu mengelola uang dengan disiplin.

Informasi Profil Pengguna:
- Nama: ${user.name}
- Status Langganan: ${user.subscription?.plan || 'TRIAL'}
- Sisa Saldo Dompet Utama: Rp ${mainBalance.toLocaleString('id-ID')}
- Total Kekayaan Semua Kantong: Rp ${totalWealth.toLocaleString('id-ID')}
- Jatah Harian Ideal Saat Ini: Rp ${Math.round(dailyAllowance).toLocaleString('id-ID')}/hari (Sisa ${daysLeft} hari ke gajian)

Daftar Kantong Pengguna:
${pocketsSummary}

15 Transaksi Terakhir Pengguna:
${txnsSummary || 'Belum ada transaksi.'}

Petunjuk Respons:
- Gunakan Bahasa Indonesia yang ramah, santun, dan komunikatif.
- Berikan analisis keuangan yang akurat berdasarkan saldo kantong dan transaksi di atas.
- Ingatkan pengguna bahwa jatah harian dihitung murni dari saldo Dompet Utama.
- Jangan gunakan formatting berlebihan, berikan jawaban langsung, jelas, dan actionable.
`.trim();

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

    // Smart Fallback Response (saat provider eksternal rate-limited)
    const fallbackReply = `Halo ${user.name}! Berdasarkan catatan keuanganmu saat ini:
• Sisa Saldo Dompet Utama: Rp ${mainBalance.toLocaleString('id-ID')}
• Total Kekayaan Seluruh Kantong: Rp ${totalWealth.toLocaleString('id-ID')}
• Jatah Harian Ideal: Rp ${Math.round(dailyAllowance).toLocaleString('id-ID')}/hari (sisa ${daysLeft} hari ke gajian).

Disiplin jaga pengeluaran harianmu agar tidak melebihi Rp ${Math.round(dailyAllowance).toLocaleString('id-ID')}/hari ya!`;

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
