import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

// POST /api/payment/callback — Webhook callback dari Midtrans
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('[Midtrans Webhook] Received notification:', JSON.stringify(body));

    const {
      order_id,
      status_code,
      gross_amount,
      signature_key,
      transaction_status,
      payment_type,
      transaction_id,
    } = body;

    if (!order_id || !status_code || !gross_amount || !signature_key) {
      return NextResponse.json({ success: false, message: 'Invalid payload request' }, { status: 400 });
    }

    // ── 1. VERIFIKASI SIGNATURE KEY ──────────────────────────────────────────
    const serverKey = process.env.MIDTRANS_SERVER_KEY || '';
    const verifyString = `${order_id}${status_code}${gross_amount}${serverKey}`;
    const generatedSignature = crypto.createHash('sha512').update(verifyString).digest('hex');

    if (generatedSignature !== signature_key) {
      console.error('[Midtrans Webhook] Signature mismatch. Received:', signature_key, 'Generated:', generatedSignature);
      return NextResponse.json({ success: false, message: 'Invalid signature key' }, { status: 403 });
    }

    // ── 2. CARI DATA PEMBAYARAN DI DB ─────────────────────────────────────────
    const payment = await prisma.payment.findUnique({
      where: { orderId: order_id },
      include: { subscription: true },
    });

    if (!payment) {
      console.warn(`[Midtrans Webhook] Payment orderId ${order_id} not found in database.`);
      return NextResponse.json({ success: false, message: 'Payment record not found' }, { status: 404 });
    }

    // ── 3. PROSES STATUS TRANSAKSI MIDTRANS ──────────────────────────────────
    let dbPaymentStatus = 'PENDING';
    let shouldUpgradeSubscription = false;

    if (transaction_status === 'capture') {
      // Untuk Credit Card capture, pastikan fraud_status adalah 'accept'
      if (body.fraud_status === 'accept') {
        dbPaymentStatus = 'SUCCESS';
        shouldUpgradeSubscription = true;
      } else {
        dbPaymentStatus = 'FAILED';
      }
    } else if (transaction_status === 'settlement') {
      dbPaymentStatus = 'SUCCESS';
      shouldUpgradeSubscription = true;
    } else if (transaction_status === 'pending') {
      dbPaymentStatus = 'PENDING';
    } else if (transaction_status === 'deny') {
      dbPaymentStatus = 'FAILED';
    } else if (transaction_status === 'expire') {
      dbPaymentStatus = 'EXPIRED';
    } else if (transaction_status === 'cancel') {
      dbPaymentStatus = 'CANCELLED';
    }

    console.log(`[Midtrans Webhook] Updating payment ${order_id} status to ${dbPaymentStatus}. Upgrade? ${shouldUpgradeSubscription}`);

    // ── 4. UPDATE RECORD PEMBAYARAN ─────────────────────────────────────────
    const updatedPayment = await prisma.payment.update({
      where: { orderId: order_id },
      data: {
        status: dbPaymentStatus,
        paymentMethod: payment_type,
        midtransTransactionId: transaction_id,
        paidAt: dbPaymentStatus === 'SUCCESS' ? new Date() : null,
      },
    });

    // ── 5. UPDATE STATUS SUBSCRIPTION KE PREMIUM JIKA SUKSES ────────────────
    if (shouldUpgradeSubscription) {
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + 1); // Premium aktif 1 bulan

      await prisma.subscription.update({
        where: { id: payment.subscriptionId },
        data: {
          plan: 'PREMIUM',
          status: 'ACTIVE',
          expiresAt,
        },
      });

      console.log(`[Midtrans Webhook] Subscription upgraded to PREMIUM for subscriptionId ${payment.subscriptionId}. Expires at: ${expiresAt}`);
    }

    return NextResponse.json({ success: true, message: 'Notification processed successfully' });
  } catch (error: any) {
    console.error('[Midtrans Webhook] Error processing callback:', error);
    return NextResponse.json({ success: false, message: 'Internal server error', error: error.message }, { status: 500 });
  }
}
