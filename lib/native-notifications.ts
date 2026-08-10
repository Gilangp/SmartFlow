import { Capacitor } from '@capacitor/core';
import { LocalNotifications, ScheduleOptions } from '@capacitor/local-notifications';

export interface NotificationScheduleParams {
  userName: string;
  morningEnabled: boolean;
  morningTime: string; // e.g. "08:00"
  afternoonEnabled: boolean;
  afternoonTime: string; // e.g. "13:00"
  eveningEnabled: boolean;
  eveningTime: string; // e.g. "20:00"
}

export async function requestNotificationPermission(): Promise<boolean> {
  try {
    if (Capacitor.isNativePlatform()) {
      const perm = await LocalNotifications.requestPermissions();
      return perm.display === 'granted';
    } else if (typeof window !== 'undefined' && 'Notification' in window) {
      const perm = await Notification.requestPermission();
      return perm === 'granted';
    }
  } catch (error) {
    console.warn('[Notifications] Error requesting permission:', error);
  }
  return false;
}

export async function scheduleNativeReminders(params: NotificationScheduleParams): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    console.log('[Notifications] Web platform detected. Native local notifications skipped.');
    return false;
  }

  try {
    // Check permission
    const permStatus = await LocalNotifications.checkPermissions();
    if (permStatus.display !== 'granted') {
      const requested = await LocalNotifications.requestPermissions();
      if (requested.display !== 'granted') return false;
    }

    // Cancel existing scheduled notifications to avoid duplicates
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length > 0) {
      await LocalNotifications.cancel(pending);
    }

    const name = params.userName || 'Anda';
    const notificationsToSchedule: ScheduleOptions['notifications'] = [];

    // 1. Morning Reminder
    if (params.morningEnabled) {
      const [h, m] = (params.morningTime || '08:00').split(':').map(Number);
      notificationsToSchedule.push({
        id: 101,
        title: 'Pengingat Pagi',
        body: `Selamat pagi, ${name}. Jangan lupa atur pengeluaran Anda hari ini.`,
        schedule: {
          on: { hour: h, minute: m },
          repeats: true,
          allowWhileIdle: true,
        },
        smallIcon: 'ic_stat_icon_config_sample',
        iconColor: '#6366f1',
      });
    }

    // 2. Afternoon Reminder
    if (params.afternoonEnabled) {
      const [h, m] = (params.afternoonTime || '13:00').split(':').map(Number);
      notificationsToSchedule.push({
        id: 102,
        title: 'Pengingat Siang',
        body: `Sudah makan siang, ${name}? Catat transaksi Anda di Finto.`,
        schedule: {
          on: { hour: h, minute: m },
          repeats: true,
          allowWhileIdle: true,
        },
        smallIcon: 'ic_stat_icon_config_sample',
        iconColor: '#6366f1',
      });
    }

    // 3. Evening Reminder
    if (params.eveningEnabled) {
      const [h, m] = (params.eveningTime || '20:00').split(':').map(Number);
      notificationsToSchedule.push({
        id: 103,
        title: 'Pengingat Malam',
        body: `Yuk catat pengeluaran hari ini sebelum beristirahat, ${name}.`,
        schedule: {
          on: { hour: h, minute: m },
          repeats: true,
          allowWhileIdle: true,
        },
        smallIcon: 'ic_stat_icon_config_sample',
        iconColor: '#6366f1',
      });
    }

    if (notificationsToSchedule.length > 0) {
      await LocalNotifications.schedule({ notifications: notificationsToSchedule });
      console.log(`[Notifications] ✅ Scheduled ${notificationsToSchedule.length} local reminders successfully.`);
    }

    return true;
  } catch (error) {
    console.error('[Notifications] Failed to schedule local reminders:', error);
    return false;
  }
}
