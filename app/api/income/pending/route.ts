import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

interface GeneratePendingRequest {
  generateMissing?: boolean; // If true, auto-generate missing months
}

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

    // Get user profile
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    if (!user || !user.paydayDate) {
      return NextResponse.json(
        { success: true, data: [] }, // No payday set
        { status: 200 }
      );
    }

    // Get pending income records for current month + past 3 months
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();

    const monthsToCheck = [];
    for (let i = 3; i >= 0; i--) {
      const date = new Date(currentYear, currentMonth - i, 1);
      monthsToCheck.push({
        year: date.getFullYear(),
        month: date.getMonth(),
        firstDay: new Date(date.getFullYear(), date.getMonth(), 1),
        lastDay: new Date(date.getFullYear(), date.getMonth() + 1, 0),
      });
    }

    let pendingIncomeList = [];

    for (const monthInfo of monthsToCheck) {
      const expectedDate = new Date(monthInfo.year, monthInfo.month, user.paydayDate);

      // Check if there's already an INCOME_ROUTINE for this month
      const existingIncome = await prisma.transaction.findFirst({
        where: {
          userId: decoded.userId,
          type: 'INCOME_ROUTINE',
          date: {
            gte: monthInfo.firstDay,
            lte: monthInfo.lastDay,
          },
        },
      });

      if (!existingIncome) {
        // Check if there's already a PENDING record for this date
        let pendingRecord = await prisma.transaction.findFirst({
          where: {
            userId: decoded.userId,
            type: 'INCOME_ROUTINE',
            status: 'PENDING',
            date: expectedDate,
          },
        });

        // If no pending record exists, create one
        if (!pendingRecord) {
          // Get user's main pocket
          const mainPocket = await prisma.pocket.findFirst({
            where: {
              userId: decoded.userId,
              type: 'MAIN',
            },
          });

          if (mainPocket) {
            pendingRecord = await prisma.transaction.create({
              data: {
                userId: decoded.userId,
                pocketId: mainPocket.id,
                type: 'INCOME_ROUTINE',
                amount: 0, // Will be filled by user
                date: expectedDate,
                status: 'PENDING',
                notes: `Gajian bulan ${new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(expectedDate)}`,
              },
              include: { pocket: true, category: true },
            });
          }
        }

        if (pendingRecord) {
          pendingIncomeList.push({
            id: pendingRecord.id,
            expectedDate: pendingRecord.date,
            amount: Number(pendingRecord.amount),
            status: pendingRecord.status,
            month: monthInfo.month + 1,
            year: monthInfo.year,
            pocketId: pendingRecord.pocketId,
            notes: pendingRecord.notes,
          });
        }
      }
    }

    return NextResponse.json(
      { success: true, data: pendingIncomeList },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error getting pending income:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Confirm/update a pending income record
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { transactionId, amount, action } = body;

    // action: 'confirm' (mark as completed with amount) or 'reject' (mark as cancelled)
    if (!transactionId || !['confirm', 'reject'].includes(action)) {
      return NextResponse.json(
        { success: false, message: 'Invalid request' },
        { status: 400 }
      );
    }

    // Get transaction
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: { pocket: true },
    });

    if (!transaction || transaction.userId !== decoded.userId) {
      return NextResponse.json(
        { success: false, message: 'Transaction not found' },
        { status: 404 }
      );
    }

    if (transaction.type !== 'INCOME_ROUTINE' || transaction.status !== 'PENDING') {
      return NextResponse.json(
        { success: false, message: 'Invalid transaction status' },
        { status: 400 }
      );
    }

    if (action === 'confirm') {
      if (!amount || amount <= 0) {
        return NextResponse.json(
          { success: false, message: 'Amount is required and must be greater than 0' },
          { status: 400 }
        );
      }

      // Get user for allocation settings
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
      });

      if (!user) {
        return NextResponse.json(
          { success: false, message: 'User not found' },
          { status: 404 }
        );
      }

      // Get all user pockets
      const allPockets = await prisma.pocket.findMany({
        where: { userId: decoded.userId },
      });

      const totalAllocation = allPockets.reduce((sum, p) => sum + p.allocation, 0);

      if (totalAllocation > 0) {
        // Mark original pending transaction as cancelled/archived
        await prisma.transaction.update({
          where: { id: transactionId },
          data: { status: 'CANCELLED' },
        });

        const createdTransactions = [];

        for (const targetPocket of allPockets) {
          if (targetPocket.allocation > 0) {
            const allocationAmount = (amount * targetPocket.allocation) / 100;
            
            // Create transaction
            const newTxn = await prisma.transaction.create({
              data: {
                userId: decoded.userId,
                pocketId: targetPocket.id,
                type: 'INCOME_ROUTINE',
                amount: allocationAmount,
                date: transaction.date,
                status: 'COMPLETED',
                notes: transaction.notes || `Pemasukan Rutin ke ${targetPocket.name}`,
              },
              include: { pocket: true },
            });

            createdTransactions.push(newTxn);

            // Update pocket balance
            await prisma.pocket.update({
              where: { id: targetPocket.id },
              data: { balance: targetPocket.balance.plus(allocationAmount) },
            });
          }
        }

        return NextResponse.json(
          {
            success: true,
            message: `Income confirmed and distributed across ${createdTransactions.length} pockets`,
            data: {
              distributedAmount: amount,
              pocketCount: createdTransactions.length,
              transactions: createdTransactions.map((t) => ({
                id: t.id,
                type: t.type,
                amount: t.amount.toNumber(),
                pocket: t.pocket.name,
                date: t.date.toISOString().split('T')[0],
                status: t.status,
              })),
            },
          },
          { status: 200 }
        );
      } else {
        // No allocation: simple update
        const updated = await prisma.transaction.update({
          where: { id: transactionId },
          data: {
            amount: amount,
            status: 'COMPLETED',
          },
          include: { pocket: true, category: true },
        });

        // Update pocket balance
        const newBalance = transaction.pocket.balance.plus(amount);
        await prisma.pocket.update({
          where: { id: transaction.pocketId },
          data: { balance: newBalance },
        });

        return NextResponse.json(
          {
            success: true,
            message: 'Income confirmed',
            data: updated,
          },
          { status: 200 }
        );
      }
    } else {
      // Reject
      const updated = await prisma.transaction.update({
        where: { id: transactionId },
        data: { status: 'CANCELLED' },
        include: { pocket: true, category: true },
      });

      return NextResponse.json(
        {
          success: true,
          message: 'Income rejected',
          data: updated,
        },
        { status: 200 }
      );
    }
  } catch (error) {
    console.error('Error confirming pending income:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
