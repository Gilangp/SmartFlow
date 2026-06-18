import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getUserSubscription } from '@/lib/subscription';

export async function GET(request: NextRequest) {
  try {
    const token = extractTokenFromHeader(request.headers.get('Authorization') || '');
    if (!token) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

    const decoded = verifyToken(token);
    if (!decoded) return NextResponse.json({ success: false, message: 'Invalid token' }, { status: 401 });

    // Cek limit export
    const sub = await getUserSubscription(decoded.userId);
    if (!sub.limits.canExportExcel) {
      return NextResponse.json({
        success: false,
        message: 'Fitur Export Laporan hanya tersedia untuk Paket Premium.'
      }, { status: 403 });
    }

    // Ambil data transaksi
    const transactions = await prisma.transaction.findMany({
      where: { userId: decoded.userId },
      include: {
        category: true,
        pocket: true,
      },
      orderBy: { date: 'desc' },
    });

    // Buat header CSV
    let csvData = 'Tanggal,Tipe,Nominal,Kategori,Kantong,Catatan\n';

    // Isi baris CSV
    transactions.forEach((tx) => {
      const tgl = tx.date.toISOString().split('T')[0];
      const tipe = tx.type === 'EXPENSE' ? 'Pengeluaran' : (tx.type === 'INCOME_ROUTINE' ? 'Pemasukan Rutin' : 'Pemasukan Bonus');
      const nominal = tx.amount.toString();
      const kategori = tx.category?.name || '-';
      const kantong = tx.pocket.name;
      // Escape quotes for CSV
      const catatan = tx.notes ? `"${tx.notes.replace(/"/g, '""')}"` : '-';

      csvData += `${tgl},${tipe},${nominal},${kategori},${kantong},${catatan}\n`;
    });

    const filename = `SmartFlow_Transactions_${new Date().toISOString().split('T')[0]}.csv`;

    return new NextResponse(csvData, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });

  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json({ success: false, message: 'Failed to export data' }, { status: 500 });
  }
}
