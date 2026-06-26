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

      // Find Dompet Utama (MAIN pocket)
      const mainPocket = allPockets.find(p => p.type === 'MAIN');

      // Calculate total allocation from NON-MAIN pockets
      const otherPocketsAllocation = allPockets
        .filter(p => p.type !== 'MAIN')
        .reduce((sum, p) => sum + p.allocation, 0);

      // Main pocket auto-remainder = 100% - other pockets total
      const mainPocketAllocation = Math.max(0, 100 - otherPocketsAllocation);

      const totalEffectiveAllocation = otherPocketsAllocation + mainPocketAllocation;
      const transactions = [];

      if (totalEffectiveAllocation > 0) {
        for (const targetPocket of allPockets) {
          // Determine effective allocation for this pocket
          let effectiveAllocation = targetPocket.allocation;
          if (targetPocket.type === 'MAIN' && mainPocket) {
            effectiveAllocation = mainPocketAllocation;
          }

          if (effectiveAllocation > 0) {
            const allocationAmount = (amount * effectiveAllocation) / 100;

            // Create transaction
            const txn = await prisma.transaction.create({
              data: {
                userId: decoded.userId,
                pocketId: targetPocket.id,
                type,
                amount: allocationAmount,
                date: new Date(date),
                notes: notes || `${type === 'INCOME_ROUTINE' ? 'Pemasukan Rutin' : 'Pemasukan Tambahan'} ke ${targetPocket.name}`,
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
            notes: notes || `${type === 'INCOME_ROUTINE' ? 'Pemasukan Rutin' : 'Pemasukan Tambahan'} ke ${pocket.name}`,
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

    const where: any = {
      userId: decoded.userId,
      status: 'COMPLETED', // Only show completed transactions (exclude PENDING templates)
    };
    if (type === 'INCOME') {
      where.type = { in: ['INCOME_ROUTINE', 'INCOME_BONUS'] };
    } else if (type) {
      where.type = type;
    }

    const transactions = await prisma.transaction.findMany({
      where,
      include: { category: true, pocket: true },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }], // Sort by date then creation time
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
