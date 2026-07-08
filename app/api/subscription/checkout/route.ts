import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // ── 1. AUTHENTICATION ──────────────────────────────────────────────────
    const token = extractTokenFromHeader(request.headers.get('Authorization') || '');
    if (!token) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ success: false, message: 'Invalid token' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: { subscription: true },
    });

    if (!user) {
      return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
    }

    // ── 2. CHECK EXISTING PREMIUM PLAN ─────────────────────────────────────
    if (user.subscription && user.subscription.plan === 'PREMIUM' && user.subscription.status === 'ACTIVE') {
      const now = new Date();
      if (!user.subscription.expiresAt || user.subscription.expiresAt > now) {
        return NextResponse.json({
          success: false,
          message: 'Anda sudah berlangganan paket Premium aktif.',
        }, { status: 400 });
      }
    }

    // ── 3. PREPARE SUBSCRIPTION & ORDER ID ──────────────────────────────────
    let subscription = user.subscription;
    if (!subscription) {
      subscription = await prisma.subscription.create({
        data: {
          userId: decoded.userId,
          plan: 'TRIAL',
          status: 'ACTIVE',
        },
      });
    }

    const orderId = `sf-prem-${decoded.userId.slice(-6)}-${Date.now()}`;
    const amount = 49000;

    // ── 4. CALL MIDTRANS SNAP API ──────────────────────────────────────────
    const serverKey = process.env.MIDTRANS_SERVER_KEY || '';
    const isProduction = process.env.MIDTRANS_IS_PRODUCTION === 'true';
    const midtransUrl = isProduction
      ? 'https://app.midtrans.com/snap/v1/transactions'
      : 'https://app.sandbox.midtrans.com/snap/v1/transactions';

    if (!serverKey || serverKey.includes('YOUR_SANDBOX_SERVER_KEY')) {
      return NextResponse.json({
        success: false,
        message: 'Kunci server Midtrans belum dikonfigurasi. Hubungi Admin.',
      }, { status: 500 });
    }

    const authHeader = Buffer.from(`${serverKey}:`).toString('base64');

    const midtransPayload = {
      transaction_details: {
        order_id: orderId,
        gross_amount: amount,
      },
      customer_details: {
        first_name: user.name,
        email: user.email,
      },
      item_details: [
        {
          id: 'PREMIUM_PLAN_1M',
          price: amount,
          quantity: 1,
          name: 'SmartFlow Premium - 1 Bulan',
        },
      ],
      // Optional: Limit payment methods if desired, otherwise default is all methods enabled in dashboard
    };

    const midtransResponse = await fetch(midtransUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Basic ${authHeader}`,
      },
      body: JSON.stringify(midtransPayload),
    });

    if (!midtransResponse.ok) {
      const errorText = await midtransResponse.text();
      console.error('Midtrans API Error response:', errorText);
      return NextResponse.json({
        success: false,
        message: 'Gagal membuat transaksi ke Midtrans. Coba lagi nanti.',
      }, { status: 502 });
    }

    const midtransData = await midtransResponse.json();

    // ── 5. RECORD PAYMENT IN DATABASE ──────────────────────────────────────
    await prisma.payment.create({
      data: {
        subscriptionId: subscription.id,
        orderId,
        amount,
        status: 'PENDING',
        paymentUrl: midtransData.redirect_url,
        snapToken: midtransData.token,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        orderId,
        snapToken: midtransData.token,
        redirectUrl: midtransData.redirect_url,
        clientKey: process.env.MIDTRANS_CLIENT_KEY,
        isProduction,
      },
    });
  } catch (error) {
    console.error('Checkout error:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}
