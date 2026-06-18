import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { startOfMonth, subMonths, endOfMonth, format } from 'date-fns';

export async function GET(request: NextRequest) {
  try {
    const token = extractTokenFromHeader(request.headers.get('Authorization') || '');
    if (!token) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

    const decoded = verifyToken(token);
    if (!decoded) return NextResponse.json({ success: false, message: 'Invalid token' }, { status: 401 });

    const now = new Date();
    // Tarik data 6 bulan terakhir
    const sixMonthsAgo = startOfMonth(subMonths(now, 5));

    const transactions = await prisma.transaction.findMany({
      where: {
        userId: decoded.userId,
        date: {
          gte: sixMonthsAgo,
          lte: endOfMonth(now),
        },
      },
      include: {
        category: true,
      },
      orderBy: { date: 'asc' },
    });

    // 1. Data per bulan (Income vs Expense)
    const monthlyData: Record<string, { month: string; income: number; expense: number }> = {};
    
    // 2. Data kategori (Hanya pengeluaran bulan ini)
    const currentMonthCategoryData: Record<string, number> = {};

    transactions.forEach((tx) => {
      const monthKey = format(tx.date, 'MMM yyyy'); // ex: "Jun 2026"
      
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { month: monthKey, income: 0, expense: 0 };
      }

      if (tx.type.startsWith('INCOME')) {
        monthlyData[monthKey].income += tx.amount;
      } else if (tx.type === 'EXPENSE') {
        monthlyData[monthKey].expense += tx.amount;
        
        // Cek jika bulan ini
        if (tx.date >= startOfMonth(now)) {
          const catName = tx.category?.name || 'Lainnya';
          currentMonthCategoryData[catName] = (currentMonthCategoryData[catName] || 0) + tx.amount;
        }
      }
    });

    const trendData = Object.values(monthlyData);
    
    // Format pie chart data
    const pieData = Object.entries(currentMonthCategoryData).map(([name, value]) => ({
      name,
      value
    })).sort((a, b) => b.value - a.value);

    return NextResponse.json({
      success: true,
      data: {
        trend: trendData,
        categories: pieData,
      },
    });
  } catch (error) {
    console.error('Analytics error:', error);
    return NextResponse.json({ success: false, message: 'Failed to fetch analytics' }, { status: 500 });
  }
}
