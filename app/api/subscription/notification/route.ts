import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

// POST /api/subscription/notification - Webhook HTTP Notification dari Midtrans
export async function POST(request: NextRequest) {
  try {
    const notification = await request.json();

    const {
      order_id,
      status_code,
      gross_amount,
      signature_key,
      transaction_status,
      fraud_status,
    } = notification;

    if (!order_id || !status_code || !gross_amount || !signature_key) {
      return NextResponse.json({ success: false, message: 'Invalid payload' }, { status: 400 });
    }

    // 1. Verifikasi Signature Key Midtrans (SHA512: order_id + status_code + gross_amount + ServerKey)
    const serverKey = process.env.MIDTRANS_SERVER_KEY || '';
    const hashInput = `${order_id}${status_code}${gross_amount}${serverKey}`;
    const expectedSignature = crypto.createHash('sha512').update(hashInput).digest('hex');

    if (signature_key !== expectedSignature) {
      console.warn('[MIDTRANS WEBHOOK] Signature Key Mismatch!');
      return NextResponse.json({ success: false, message: 'Invalid signature key' }, { status: 403 });
    }

    // 2. Cari data pembayaran di DB
    const payment = await prisma.payment.findUnique({
      where: { orderId: order_id },
      include: { subscription: true },
    });

    if (!payment) {
      console.warn(`[MIDTRANS WEBHOOK] Order ID ${order_id} tidak ditemukan di database.`);
      return NextResponse.json({ success: false, message: 'Payment record not found' }, { status: 404 });
    }

    let paymentStatus = 'PENDING';
    let isSuccess = false;

    if (transaction_status === 'capture') {
      if (fraud_status === 'challenge') {
        paymentStatus = 'CHALLENGE';
      } else if (fraud_status === 'accept') {
        paymentStatus = 'SETTLEMENT';
        isSuccess = true;
      }
    } else if (transaction_status === 'settlement') {
      paymentStatus = 'SETTLEMENT';
      isSuccess = true;
    } else if (transaction_status === 'cancel' || transaction_status === 'deny') {
      paymentStatus = 'CANCELLED';
    } else if (transaction_status === 'expire') {
      paymentStatus = 'EXPIRED';
    } else if (transaction_status === 'pending') {
      paymentStatus = 'PENDING';
    }

    // 3. Update status pembayaran
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: paymentStatus,
        paymentMethod: notification.payment_type || payment.paymentMethod,
        midtransTransactionId: notification.transaction_id || payment.midtransTransactionId,
        paidAt: isSuccess ? new Date() : payment.paidAt,
      },
    });

    // 4. Jika sukses, upgrade langganan user ke PREMIUM untuk 30 hari ke depan
    if (isSuccess && payment.subscription) {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // +30 Hari

      await prisma.subscription.update({
        where: { id: payment.subscriptionId },
        data: {
          plan: 'PREMIUM',
          status: 'ACTIVE',
          startedAt: now,
          expiresAt: expiresAt,
        },
      });

      console.log(`[MIDTRANS WEBHOOK] ✅ Akun User ID ${payment.subscription.userId} berhasil di-upgrade ke PREMIUM hingga ${expiresAt.toISOString()}`);
    }

    return NextResponse.json({ success: true, message: 'Notification processed' });

  } catch (error: any) {
    console.error('Midtrans notification error:', error);
    return NextResponse.json({ success: false, message: 'Internal server error', error: error.message }, { status: 500 });
  }
}
