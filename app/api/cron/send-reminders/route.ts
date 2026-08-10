import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import webpush from 'web-push';

export const dynamic = 'force-dynamic';

// Configure Web Push VAPID keys if set in environment
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY || '';
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || '';

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:support@smartflow.id',
    vapidPublicKey,
    vapidPrivateKey
  );
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    // Safety check if CRON_SECRET is set
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ success: false, message: 'Unauthorized cron trigger' }, { status: 401 });
    }

    const now = new Date();
    // Format WIB time string (HH:mm)
    const wibTimeStr = now.toLocaleTimeString('en-GB', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' });
    const todayWibStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }); // YYYY-MM-DD

    console.log(`[CRON REMINDERS] Executing at ${wibTimeStr} WIB (${todayWibStr})`);

    const activeSettings = await prisma.notificationSetting.findMany({
      where: {
        pushSubscriptionJson: { not: null },
      },
      include: {
        user: { select: { id: true, name: true } },
      },
    });

    let sentCount = 0;

    for (const setting of activeSettings) {
      if (!setting.pushSubscriptionJson) continue;

      let subscription: webpush.PushSubscription;
      try {
        subscription = JSON.parse(setting.pushSubscriptionJson);
      } catch {
        continue;
      }

      const userName = setting.user.name?.split(' ')[0] || 'Anda';
      let title = '';
      let body = '';

      // Determine which reminder slot matches current time WIB (with 15 min flexibility)
      const currentHour = parseInt(wibTimeStr.split(':')[0], 10);

      // 1. Morning slot (around 08:00 WIB)
      if (setting.morningReminderEnabled && currentHour >= 7 && currentHour <= 9) {
        title = 'Pengingat Pagi';
        body = `Selamat pagi, ${userName}. Jangan lupa atur pengeluaran Anda hari ini.`;
      }
      // 2. Afternoon slot (around 13:00 WIB)
      else if (setting.afternoonReminderEnabled && currentHour >= 12 && currentHour <= 14) {
        title = 'Pengingat Siang';
        body = `Sudah makan siang, ${userName}? Catat transaksi Anda di Finto.`;
      }
      // 3. Evening slot (around 20:00 WIB)
      else if (setting.eveningReminderEnabled && currentHour >= 19 && currentHour <= 21) {
        // Check if user already logged an expense today
        const startOfDay = new Date(`${todayWibStr}T00:00:00+07:00`);
        const endOfDay = new Date(`${todayWibStr}T23:59:59+07:00`);

        const todayExpenseCount = await prisma.transaction.count({
          where: {
            userId: setting.userId,
            type: 'EXPENSE',
            date: { gte: startOfDay, lte: endOfDay },
          },
        });

        if (todayExpenseCount === 0) {
          title = 'Pengingat Malam';
          body = `Yuk catat pengeluaran hari ini sebelum beristirahat, ${userName}.`;
        }
      }

      if (title && body && vapidPublicKey && vapidPrivateKey) {
        try {
          const payload = JSON.stringify({ title, body, icon: '/icons/icon-192x192.png' });
          await webpush.sendNotification(subscription, payload);
          sentCount++;
        } catch (err: any) {
          console.warn(`[CRON REMINDERS] Failed to send push to user ${setting.userId}:`, err.message);
          // If subscription is expired or invalid, clear it
          if (err.statusCode === 410 || err.statusCode === 404) {
            await prisma.notificationSetting.update({
              where: { id: setting.id },
              data: { pushSubscriptionJson: null },
            });
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Processed reminders at ${wibTimeStr} WIB. Sent ${sentCount} push notifications.`,
    });
  } catch (error) {
    console.error('CRON REMINDERS ERROR:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to process cron reminders', error: String(error) },
      { status: 500 }
    );
  }
}
