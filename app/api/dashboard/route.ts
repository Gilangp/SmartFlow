import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
import { prisma } from '@/lib/db';
import {
  calculateDailyAllowance,
  calculateSpendingPercentage,
  determineSpendingStatus,
  getDaysLeftInMonth,
} from '@/lib/financial-calculations';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const token = extractTokenFromHeader(request.headers.get('Authorization') || '');

    if (!token) {
      return NextResponse.json(
        { success: false, message: 'No token provided' },
        { status: 401 }
      );
    }

    const decoded = verifyToken(token);

    if (!decoded) {
      return NextResponse.json(
        { success: false, message: 'Invalid token' },
        { status: 401 }
      );
    }

    // Get user and pockets
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: { pockets: true },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'User not found' },
        { status: 404 }
      );
    }

    // Get main wallet balance
    const mainWallet = user.pockets.find((p) => p.type === 'MAIN');
    const mainBalance = mainWallet?.balance.toNumber() || 0;

    // Get today's date boundary in WIB (Asia/Jakarta) timezone
    // This ensures the daily reset happens at midnight WIB, not midnight UTC (which is 7am WIB)
    const nowWIB = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }); // 'en-CA' gives YYYY-MM-DD format
    const today = new Date(nowWIB + 'T00:00:00.000+07:00');

    // Get all of today's transactions for the user
    const todayTransactions = await prisma.transaction.findMany({
      where: {
        userId: decoded.userId,
        date: {
          gte: today,
          lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
        },
      },
    });

    // Calculate total spent today (expenses)
    const totalSpent = todayTransactions
      .filter((t) => t.type === 'EXPENSE')
      .reduce((sum, t) => sum + t.amount.toNumber(), 0);

    // Calculate today's spending specifically for the MAIN pocket to find the starting balance of the day
    const totalMainSpentToday = todayTransactions
      .filter((t) => t.type === 'EXPENSE' && t.pocketId === mainWallet?.id)
      .reduce((sum, t) => sum + t.amount.toNumber(), 0);

    // Saldo Dompet Utama di awal hari sebelum dipotong pengeluaran hari ini (namun tetap bertambah jika ada pemasukan baru)
    const startOfDayMainBalance = mainBalance + totalMainSpentToday;

    // Calculate daily allowance using start of day balance (FR-DASH-01)
    const daysLeft = getDaysLeftInMonth(today);
    const dailyAllowance = calculateDailyAllowance(startOfDayMainBalance, 0, daysLeft);

    const percentageUsed = calculateSpendingPercentage(totalSpent, dailyAllowance);
    const status = determineSpendingStatus(percentageUsed);

    // Save/Update today's performance
    await prisma.dailyPerformance.upsert({
      where: {
        userId_date: {
          userId: decoded.userId,
          date: today,
        },
      },
      update: {
        dailyAllowance: dailyAllowance,
        totalSpent: totalSpent,
        percentageUsed: percentageUsed,
        status: status,
      },
      create: {
        userId: decoded.userId,
        date: today,
        dailyAllowance: dailyAllowance,
        totalSpent: totalSpent,
        percentageUsed: percentageUsed,
        status: status,
      },
    });

    // Check for yesterday's rollover surplus
    const yesterday = new Date(today.getTime());
    yesterday.setDate(yesterday.getDate() - 1);

    const yesterdayPerformance = await prisma.dailyPerformance.findUnique({
      where: {
        userId_date: {
          userId: decoded.userId,
          date: yesterday,
        },
      },
    });

    let rolloverSurplus = null;
    let rolloverPerformanceId = null;
    if (yesterdayPerformance && yesterdayPerformance.surplusTransferred === null) {
      const surplus = yesterdayPerformance.dailyAllowance.toNumber() - yesterdayPerformance.totalSpent.toNumber();
      if (surplus > 0) {
        rolloverSurplus = surplus;
        rolloverPerformanceId = yesterdayPerformance.id;
      }
    }

    // Get pocket summaries
    const pocketSummaries = user.pockets.map((p) => {
      const balance = p.balance.toNumber();
      let progressPercentage = undefined;

      if (p.targetAmount) {
        const target = p.targetAmount.toNumber();
        progressPercentage = target > 0 ? (balance / target) * 100 : 0;
      }

      return {
        id: p.id,
        name: p.name,
        type: p.type,
        balance,
        targetAmount: p.targetAmount?.toNumber(),
        status: p.status,
        progressPercentage,
      };
    });

    // Get recent transactions (only COMPLETED, sorted by date then creation time)
    const recentTransactions = await prisma.transaction.findMany({
      where: { userId: decoded.userId, status: 'COMPLETED' },
      include: { category: true, pocket: true },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      take: 10,
    });

    return NextResponse.json({
      success: true,
      message: 'Dashboard data retrieved',
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          themePreference: user.themePreference,
          paydayDate: user.paydayDate,
        },
        dailyMetrics: {
          date: today.toISOString().split('T')[0],
          dailyAllowance,
          totalSpent,
          percentageUsed: Math.round(percentageUsed * 100) / 100,
          status,
          remaining: Math.max(0, dailyAllowance - totalSpent),
          rolloverSurplus,
          rolloverPerformanceId,
          pocketSummary: pocketSummaries,
        },
        recentTransactions: recentTransactions.map((t) => ({
          id: t.id,
          type: t.type,
          amount: t.amount.toNumber(),
          category: t.category?.name,
          categoryType: t.category?.type,
          pocket: t.pocket.name,
          date: t.date.toISOString().split('T')[0],
          notes: t.notes,
          createdAt: t.createdAt.toISOString(),
        })),
      },
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to retrieve dashboard', error: String(error) },
      { status: 500 }
    );
  }
}
