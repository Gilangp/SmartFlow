import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const token = extractTokenFromHeader(request.headers.get('Authorization') || '');
    if (!token) return NextResponse.json({ success: false, message: 'No token provided' }, { status: 401 });

    const decoded = verifyToken(token);
    if (!decoded) return NextResponse.json({ success: false, message: 'Invalid token' }, { status: 401 });

    let settings = await prisma.notificationSetting.findUnique({
      where: { userId: decoded.userId },
    });

    if (!settings) {
      settings = await prisma.notificationSetting.create({
        data: {
          userId: decoded.userId,
          morningReminderEnabled: true,
          morningReminderTime: '08:00',
          afternoonReminderEnabled: true,
          afternoonReminderTime: '13:00',
          eveningReminderEnabled: true,
          eveningReminderTime: '20:00',
          overbudgetAlertEnabled: true,
          paydayReminderEnabled: true,
          aiRoastDigestEnabled: true,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: settings,
    });
  } catch (error) {
    console.error('GET NOTIFICATION SETTINGS ERROR:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to load notification settings' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const token = extractTokenFromHeader(request.headers.get('Authorization') || '');
    if (!token) return NextResponse.json({ success: false, message: 'No token provided' }, { status: 401 });

    const decoded = verifyToken(token);
    if (!decoded) return NextResponse.json({ success: false, message: 'Invalid token' }, { status: 401 });

    const body = await request.json();

    const settings = await prisma.notificationSetting.upsert({
      where: { userId: decoded.userId },
      create: {
        userId: decoded.userId,
        morningReminderEnabled: body.morningReminderEnabled ?? true,
        morningReminderTime: body.morningReminderTime || '08:00',
        afternoonReminderEnabled: body.afternoonReminderEnabled ?? true,
        afternoonReminderTime: body.afternoonReminderTime || '13:00',
        eveningReminderEnabled: body.eveningReminderEnabled ?? true,
        eveningReminderTime: body.eveningReminderTime || '20:00',
        overbudgetAlertEnabled: body.overbudgetAlertEnabled ?? true,
        paydayReminderEnabled: body.paydayReminderEnabled ?? true,
        aiRoastDigestEnabled: body.aiRoastDigestEnabled ?? true,
        pushSubscriptionJson: body.pushSubscriptionJson !== undefined ? body.pushSubscriptionJson : undefined,
        fcmToken: body.fcmToken !== undefined ? body.fcmToken : undefined,
      },
      update: {
        morningReminderEnabled: body.morningReminderEnabled,
        morningReminderTime: body.morningReminderTime,
        afternoonReminderEnabled: body.afternoonReminderEnabled,
        afternoonReminderTime: body.afternoonReminderTime,
        eveningReminderEnabled: body.eveningReminderEnabled,
        eveningReminderTime: body.eveningReminderTime,
        overbudgetAlertEnabled: body.overbudgetAlertEnabled,
        paydayReminderEnabled: body.paydayReminderEnabled,
        aiRoastDigestEnabled: body.aiRoastDigestEnabled,
        pushSubscriptionJson: body.pushSubscriptionJson,
        fcmToken: body.fcmToken,
      },
    });

    return NextResponse.json({
      success: true,
      data: settings,
      message: 'Notification settings updated successfully',
    });
  } catch (error) {
    console.error('PUT NOTIFICATION SETTINGS ERROR:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to update notification settings' },
      { status: 500 }
    );
  }
}
