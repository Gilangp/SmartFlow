import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

interface CreateTransactionRequest {
  type: 'INCOME_ROUTINE' | 'INCOME_BONUS' | 'EXPENSE';
  amount: number;
  categoryId?: string;
  pocketId: string;
  date: string;
  notes?: string;
}

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

    const body: CreateTransactionRequest = await request.json();
    const { type, amount, categoryId, pocketId, date, notes } = body;

    // Validate
    if (!type || !amount || !pocketId || !date) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields' },
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

    // Get pocket
    const pocket = await prisma.pocket.findUnique({
      where: { id: pocketId },
    });

    if (!pocket || pocket.userId !== decoded.userId) {
      return NextResponse.json(
        { success: false, message: 'Pocket not found' },
        { status: 404 }
      );
    }

    // Check if this is income
    const isIncome = type === 'INCOME_ROUTINE' || type === 'INCOME_BONUS';

    if (isIncome) {
      // Get all user pockets
      const allPockets = await prisma.pocket.findMany({
        where: { userId: decoded.userId },
      });

      const totalAllocation = allPockets.reduce((sum, p) => sum + p.allocation, 0);
      const transactions = [];

      if (totalAllocation > 0) {
        for (const targetPocket of allPockets) {
          if (targetPocket.allocation > 0) {
            const allocationAmount = (amount * targetPocket.allocation) / 100;
            
            // Create transaction
            const txn = await prisma.transaction.create({
              data: {
                userId: decoded.userId,
                pocketId: targetPocket.id,
                type,
                amount: allocationAmount,
                date: new Date(date),
                notes: notes || `${type === 'INCOME_ROUTINE' ? 'Pemasukan Rutin' : 'Bonus'} ke ${targetPocket.name}`,
              },
              include: { category: true, pocket: true },
            });

            transactions.push(txn);

            // Update pocket balance
            await prisma.pocket.update({
              where: { id: targetPocket.id },
              data: { balance: targetPocket.balance.plus(allocationAmount) },
            });
          }
        }
      } else {
        // Fallback: put everything into the selected pocket if no allocation is set up
        const txn = await prisma.transaction.create({
          data: {
            userId: decoded.userId,
            pocketId: pocket.id,
            type,
            amount,
            date: new Date(date),
            notes: notes || `${type === 'INCOME_ROUTINE' ? 'Pemasukan Rutin' : 'Bonus'} ke ${pocket.name}`,
          },
          include: { category: true, pocket: true },
        });
        transactions.push(txn);

        await prisma.pocket.update({
          where: { id: pocket.id },
          data: { balance: pocket.balance.plus(amount) },
        });
      }

      return NextResponse.json(
        {
          success: true,
          message: `Income distributed across ${transactions.length} pockets`,
          data: {
            distributedAmount: amount,
            pocketCount: transactions.length,
            transactions: transactions.map((t) => ({
              id: t.id,
              type: t.type,
              amount: t.amount.toNumber(),
              pocket: t.pocket.name,
              date: t.date.toISOString().split('T')[0],
            })),
          },
        },
        { status: 201 }
      );
    } else {
      // Non-income or no allocation: single transaction to selected pocket
      const transaction = await prisma.transaction.create({
        data: {
          userId: decoded.userId,
          pocketId,
          categoryId,
          type,
          amount,
          date: new Date(date),
          notes,
        },
        include: { category: true, pocket: true },
      });

      // Update pocket balance
      let newBalance = pocket.balance;
      
      if (type === 'EXPENSE') {
        if (pocket.balance.toNumber() < amount) {
          return NextResponse.json(
            { success: false, message: 'Saldo kantong tidak mencukupi untuk pengeluaran ini' },
            { status: 400 }
          );
        }
        newBalance = pocket.balance.minus(amount);
      } else if (type === 'INCOME_ROUTINE' || type === 'INCOME_BONUS') {
        newBalance = pocket.balance.plus(amount);
      }

      await prisma.pocket.update({
        where: { id: pocketId },
        data: { balance: newBalance },
      });

      return NextResponse.json(
        {
          success: true,
          message: 'Transaction created',
          data: {
            id: transaction.id,
            type: transaction.type,
            amount: transaction.amount.toNumber(),
            category: transaction.category?.name,
            pocket: transaction.pocket.name,
            date: transaction.date.toISOString().split('T')[0],
            notes: transaction.notes,
            createdAt: transaction.createdAt.toISOString(),
          },
        },
        { status: 201 }
      );
    }
  } catch (error) {
    console.error('Transaction creation error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to create transaction', error: String(error) },
      { status: 500 }
    );
  }
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

    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const type = searchParams.get('type');

    const where: any = { userId: decoded.userId };
    if (type) where.type = type;

    const transactions = await prisma.transaction.findMany({
      where,
      include: { category: true, pocket: true },
      orderBy: { date: 'desc' },
      take: limit,
      skip: offset,
    });

    return NextResponse.json({
      success: true,
      message: 'Transactions retrieved',
      data: transactions.map((t) => ({
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
    });
  } catch (error) {
    console.error('Get transactions error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to retrieve transactions', error: String(error) },
      { status: 500 }
    );
  }
}
