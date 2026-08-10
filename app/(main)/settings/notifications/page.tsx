'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Bell, Sun, Sunset, Moon, AlertCircle, Calendar, Sparkles, Check, Loader2 } from 'lucide-react';
import { scheduleNativeReminders, requestNotificationPermission } from '@/lib/native-notifications';

interface NotificationSettingData {
  morningReminderEnabled: boolean;
  morningReminderTime: string;
  afternoonReminderEnabled: boolean;
  afternoonReminderTime: string;
  eveningReminderEnabled: boolean;
  eveningReminderTime: string;
  overbudgetAlertEnabled: boolean;
  paydayReminderEnabled: boolean;
  aiRoastDigestEnabled: boolean;
}

export default function NotificationSettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [settings, setSettings] = useState<NotificationSettingData>({
    morningReminderEnabled: true,
    morningReminderTime: '08:00',
    afternoonReminderEnabled: true,
    afternoonReminderTime: '13:00',
    eveningReminderEnabled: true,
    eveningReminderTime: '20:00',
    overbudgetAlertEnabled: true,
    paydayReminderEnabled: true,
    aiRoastDigestEnabled: true,
  });

  const getToken = useCallback(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('sf-token');
  }, []);

  useEffect(() => {
    const fetchSettings = async () => {
      const token = getToken();
      if (!token) {
        router.push('/login');
        return;
      }

      try {
        const res = await fetch('/api/notifications/settings', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.success && data.data) {
          setSettings(data.data);
        }
      } catch (err) {
        console.error('Failed to load notification settings:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, [getToken, router]);

  const handleSave = async (updatedSettings: NotificationSettingData) => {
    const token = getToken();
    if (!token) return;

    setSaving(true);
    try {
      // 1. Request Permission if toggling on
      const hasPerm = await requestNotificationPermission();

      // 2. Update Backend Settings
      const res = await fetch('/api/notifications/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updatedSettings),
      });

      const data = await res.json();
      if (data.success) {
        setSettings(data.data);

        // 3. Schedule Local Notifications for Native App
        await scheduleNativeReminders({
          userName: '',
          morningEnabled: updatedSettings.morningReminderEnabled,
          morningTime: updatedSettings.morningReminderTime,
          afternoonEnabled: updatedSettings.afternoonReminderEnabled,
          afternoonTime: updatedSettings.afternoonReminderTime,
          eveningEnabled: updatedSettings.eveningReminderEnabled,
          eveningTime: updatedSettings.eveningReminderTime,
        });

        setToastMessage('Pengaturan notifikasi berhasil disimpan');
        setTimeout(() => setToastMessage(null), 3000);
      }
    } catch (err) {
      console.error('Error saving notification settings:', err);
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = (key: keyof NotificationSettingData, value: any) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    handleSave(newSettings);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-white pb-12">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-emerald-600 text-white text-xs font-medium px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-top-3">
          <Check className="w-4 h-4" />
          {toastMessage}
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-gray-950/80 backdrop-blur-xl border-b border-gray-100 dark:border-gray-800">
        <div className="max-w-2xl mx-auto px-5 py-4 flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Pengaturan Notifikasi</h1>
            <p className="text-xs text-gray-400">Pengingat harian dan peringatan finansial</p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-5 py-6 space-y-6">
        
        {/* Section 1: Pengingat Harian (3 Slot) */}
        <section className="bg-gray-50 dark:bg-gray-900/60 rounded-2xl p-5 border border-gray-100 dark:border-gray-800/80 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Bell className="w-5 h-5 text-indigo-500" />
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Pengingat Harian (3 Slot Waktu)</h2>
          </div>

          {/* Slot Pagi */}
          <div className="flex items-center justify-between py-3 border-b border-gray-200/60 dark:border-gray-800">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                <Sun className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-900 dark:text-white">Pengingat Pagi</p>
                <p className="text-[11px] text-gray-400">Pengingat kesadaran anggaran hari ini</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="time"
                value={settings.morningReminderTime}
                onChange={(e) => updateSetting('morningReminderTime', e.target.value)}
                disabled={!settings.morningReminderEnabled}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs px-2.5 py-1 rounded-lg focus:outline-none focus:border-indigo-500 disabled:opacity-40 text-gray-800 dark:text-gray-200 font-mono"
              />
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.morningReminderEnabled}
                  onChange={(e) => updateSetting('morningReminderEnabled', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:after:border-gray-600 peer-checked:bg-indigo-600"></div>
              </label>
            </div>
          </div>

          {/* Slot Siang */}
          <div className="flex items-center justify-between py-3 border-b border-gray-200/60 dark:border-gray-800">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center">
                <Sunset className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-900 dark:text-white">Pengingat Siang</p>
                <p className="text-[11px] text-gray-400">Pengingat transaksi pos makan siang</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="time"
                value={settings.afternoonReminderTime}
                onChange={(e) => updateSetting('afternoonReminderTime', e.target.value)}
                disabled={!settings.afternoonReminderEnabled}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs px-2.5 py-1 rounded-lg focus:outline-none focus:border-indigo-500 disabled:opacity-40 text-gray-800 dark:text-gray-200 font-mono"
              />
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.afternoonReminderEnabled}
                  onChange={(e) => updateSetting('afternoonReminderEnabled', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:after:border-gray-600 peer-checked:bg-indigo-600"></div>
              </label>
            </div>
          </div>

          {/* Slot Malam */}
          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
                <Moon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-900 dark:text-white">Pengingat Malam</p>
                <p className="text-[11px] text-gray-400">Pencatatan transaksi penutup hari</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="time"
                value={settings.eveningReminderTime}
                onChange={(e) => updateSetting('eveningReminderTime', e.target.value)}
                disabled={!settings.eveningReminderEnabled}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs px-2.5 py-1 rounded-lg focus:outline-none focus:border-indigo-500 disabled:opacity-40 text-gray-800 dark:text-gray-200 font-mono"
              />
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.eveningReminderEnabled}
                  onChange={(e) => updateSetting('eveningReminderEnabled', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:after:border-gray-600 peer-checked:bg-indigo-600"></div>
              </label>
            </div>
          </div>
        </section>

        {/* Section 2: Alert Otomatis */}
        <section className="bg-gray-50 dark:bg-gray-900/60 rounded-2xl p-5 border border-gray-100 dark:border-gray-800/80 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-5 h-5 text-rose-500" />
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Peringatan Otomatis</h2>
          </div>

          {/* Overbudget Alert */}
          <div className="flex items-center justify-between py-3 border-b border-gray-200/60 dark:border-gray-800">
            <div>
              <p className="text-xs font-medium text-gray-900 dark:text-white">Peringatan Jatah Harian</p>
              <p className="text-[11px] text-gray-400">Peringatan jika pengeluaran hari ini mendekati batas ideal</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.overbudgetAlertEnabled}
                onChange={(e) => updateSetting('overbudgetAlertEnabled', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:after:border-gray-600 peer-checked:bg-indigo-600"></div>
            </label>
          </div>

          {/* Payday Reminder */}
          <div className="flex items-center justify-between py-3 border-b border-gray-200/60 dark:border-gray-800">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-400" />
              <div>
                <p className="text-xs font-medium text-gray-900 dark:text-white">Pengingat Siklus Gajian (H-1)</p>
                <p className="text-[11px] text-gray-400">Pengingat 1 hari sebelum tanggal siklus gajian baru</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.paydayReminderEnabled}
                onChange={(e) => updateSetting('paydayReminderEnabled', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:after:border-gray-600 peer-checked:bg-indigo-600"></div>
            </label>
          </div>

          {/* AI Roast Digest */}
          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <div>
                <p className="text-xs font-medium text-gray-900 dark:text-white">Ringkasan AI Roasting Mingguan</p>
                <p className="text-[11px] text-gray-400">Notifikasi ringkasan analisis keuangan setiap Minggu malam</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.aiRoastDigestEnabled}
                onChange={(e) => updateSetting('aiRoastDigestEnabled', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:after:border-gray-600 peer-checked:bg-indigo-600"></div>
            </label>
          </div>
        </section>

      </main>
    </div>
  );
}
