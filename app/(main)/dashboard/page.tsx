'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import AddTransactionModal from '@/components/AddTransactionModal';
import RolloverModal from '@/components/RolloverModal';
import { showInterstitial } from '@/lib/admob';
import { DashboardData } from '@/types';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';

function formatCurrency(amount: number): string {
  if (amount >= 1000000) return `Rp ${(amount / 1000000).toFixed(1)}jt`;
  if (amount >= 1000) return `Rp ${(amount / 1000).toFixed(0)}rb`;
  return `Rp ${amount.toLocaleString('id-ID')}`;
}

function formatCurrencyFull(amount: number): string {
  return `Rp ${amount.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

const statusConfig = {
  GREEN: { label: 'Aman', progressColor: 'bg-emerald-500' },
  YELLOW: { label: 'Hati-hati', progressColor: 'bg-amber-500' },
  RED: { label: 'Overbudget', progressColor: 'bg-rose-500' },
};

export default function DashboardPage() {
  const router = useRouter();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showRolloverModal, setShowRolloverModal] = useState(false);
  const [rolloverData, setRolloverData] = useState<{ id: string; surplus: number } | null>(null);
  const [aiRoast, setAiRoast] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  const runGuidedTour = useCallback(() => {
    const driverObj = driver({
      showProgress: true,
      nextBtnText: 'Lanjut →',
      prevBtnText: '← Kembali',
      doneBtnText: 'Selesai 🎉',
      steps: [
        {
          popover: {
            title: 'Selamat Datang di Finto! 🚀',
            description: 'Mari kita berkeliling sebentar untuk mengetahui cara mengelola keuangan mahasiswa secara cerdas.',
            side: 'bottom' as const,
            align: 'start' as const
          }
        },
        {
          element: '#tour-daily-allowance',
          popover: {
            title: 'Jatah Harian Pintar 💰',
            description: 'Ini adalah jatah harian kamu hari ini. Sistem menghitungnya otomatis agar pengeluaran kamu tetap terjaga sampai akhir siklus gajian.',
            side: 'bottom' as const,
            align: 'start' as const
          }
        },
        ...(document.querySelector('#tour-ai-roast') ? [{
          element: '#tour-ai-roast',
          popover: {
            title: 'AI Financial Roaster 🤖',
            description: 'Saran finansial julid tapi jujur dari AI! Dia akan menganalisis pengeluaran kamu selama 7 hari terakhir dan memberikan roasting pedas.',
            side: 'bottom' as const,
            align: 'start' as const
          }
        }] : []),
        {
          element: '#tour-add-transaction',
          popover: {
            title: 'Catat Transaksi Cepat 📝',
            description: 'Catat pengeluaran atau pemasukan baru kamu di sini secara cepat.',
            side: 'bottom' as const,
            align: 'start' as const
          }
        },
        {
          element: '#tour-pockets',
          popover: {
            title: 'Sistem 4 Kantong 🗂️',
            description: 'Keuangan kamu dibagi ke dalam 4 kantong: Utama, Darurat, Tabungan, dan Wishlist. Ini membantu alokasi keuangan yang lebih disiplin.',
            side: 'top' as const,
            align: 'start' as const
          }
        },
        {
          element: '#tour-transactions',
          popover: {
            title: 'Transaksi Terbaru 🕒',
            description: 'Semua daftar transaksi pengeluaran dan pemasukan terbaru kamu akan muncul di sini.',
            side: 'top' as const,
            align: 'start' as const
          }
        }
      ],
      onDestroyed: () => {
        localStorage.setItem('sf-tour-completed', 'true');
      }
    });

    driverObj.drive();
  }, []);

  const getToken = useCallback(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('sf-token');
  }, []);

  useEffect(() => {
    const storedTheme = (localStorage.getItem('sf-theme') || 'dark') as 'light' | 'dark';
    setTheme(storedTheme);
    document.documentElement.classList.toggle('dark', storedTheme === 'dark');
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('sf-theme', newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
  };

  const fetchDashboard = useCallback(async () => {
    const token = getToken();
    if (!token) { router.push('/auth/login'); return; }

    try {
      const res = await fetch('/api/dashboard', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setDashboard(data.data);
        if (data.data.dailyMetrics?.rolloverSurplus && data.data.dailyMetrics?.rolloverPerformanceId) {
          setRolloverData({
            id: data.data.dailyMetrics.rolloverPerformanceId,
            surplus: data.data.dailyMetrics.rolloverSurplus,
          });
          setShowRolloverModal(true);
        }
      } else {
        router.push('/auth/login');
      }
    } catch {
      router.push('/auth/login');
    } finally {
      setIsLoading(false);
    }
  }, [getToken, router]);

  useEffect(() => {
    fetchDashboard();
    
    const fetchAutoRoast = async () => {
      const token = getToken();
      if (!token) return;
      setAiLoading(true);
      try {
        const res = await fetch('/api/ai/roast', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.success) setAiRoast(data.data.message);
      } catch {
        // Silent fail
      } finally {
        setAiLoading(false);
      }
    };
    fetchAutoRoast();
  }, [fetchDashboard, getToken]);

  useEffect(() => {
    if (dashboard) {
      const tourCompleted = localStorage.getItem('sf-tour-completed');
      if (!tourCompleted) {
        const timer = setTimeout(() => {
          runGuidedTour();
        }, 1500);
        return () => clearTimeout(timer);
      }
    }
  }, [dashboard, runGuidedTour]);

  const fetchAiRoast = async () => {
    const token = getToken();
    if (!token || aiLoading) return;
    setAiLoading(true);
    try {
      const res = await fetch('/api/ai/roast', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) setAiRoast(data.data.message);
    } catch {
      // Silent fail
    } finally {
      setAiLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Memuat dashboard...</p>
        </div>
      </div>
    );
  }

  if (!dashboard) return null;

  const { dailyMetrics, user, recentTransactions } = dashboard;
  const status = statusConfig[dailyMetrics.status];
  const progressPercent = Math.min(dailyMetrics.percentageUsed, 100);

  const todayStr = new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-gray-950/80 backdrop-blur-xl border-b border-gray-100 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-5 py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400 dark:text-gray-600">{todayStr}</p>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                Hai, {user.name.split(' ')[0]}
              </h1>
            </div>
            <div className="flex items-center gap-2">
              {/* Theme Toggle with SVG Icon */}
              <button
                onClick={toggleTheme}
                className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all"
                aria-label="Toggle theme"
              >
                {theme === 'dark' ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                )}
              </button>

              {/* Help/Tour Button */}
              <button
                onClick={runGuidedTour}
                className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all"
                aria-label="Tampilkan Panduan"
                title="Panduan Pengguna"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
              
              <button
                onClick={fetchAiRoast}
                disabled={aiLoading}
                className="px-4 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-sm font-medium transition-all hover:bg-indigo-100 dark:hover:bg-indigo-500/20 disabled:opacity-50"
              >
                {aiLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-3 h-3 border border-indigo-600 border-t-transparent rounded-full animate-spin" />
                    Memuat
                  </span>
                ) : (
                  'Roast AI'
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-5 py-6">
        {/* AI Roast Card */}
        {aiRoast && (
          <div id="tour-ai-roast" className="mb-6 bg-indigo-50 dark:bg-indigo-500/5 rounded-2xl p-5 border-l-4 border-indigo-500">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-indigo-600 dark:text-indigo-400 text-sm font-bold">AI</span>
              </div>
              <div>
                <p className="text-xs text-indigo-500 dark:text-indigo-400 font-medium mb-1">AI Financial Roaster</p>
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                  &ldquo;{aiRoast}&rdquo;
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column: Metrics & Pockets */}
          <div className="lg:col-span-7 space-y-6">
            {/* Daily Allowance Card */}
            <div id="tour-daily-allowance" className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-indigo-800 p-6 shadow-xl">
              <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full blur-3xl" />
              <div className="absolute bottom-0 left-0 w-40 h-40 bg-indigo-400/10 rounded-full blur-3xl" />
              
              <div className="relative z-10">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <p className="text-indigo-200 text-xs font-medium tracking-wide mb-1">
                      Jatah Hari Ini
                    </p>
                    <p className="text-3xl font-bold text-white tracking-tight">
                      {formatCurrencyFull(dailyMetrics.dailyAllowance)}
                    </p>
                  </div>
                  <div className="px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/20">
                    <span className="text-xs font-medium text-white">{status.label}</span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="space-y-2 mb-5">
                  <div className="flex justify-between text-xs">
                    <span className="text-indigo-200">Penggunaan hari ini</span>
                    <span className="text-white font-medium">{Math.round(progressPercent)}%</span>
                  </div>
                  <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ease-out ${status.progressColor}`}
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white/10 rounded-xl p-3">
                    <p className="text-indigo-200 text-xs mb-0.5">Terpakai</p>
                    <p className="text-white font-semibold">{formatCurrency(dailyMetrics.totalSpent)}</p>
                  </div>
                  <div className="bg-white/10 rounded-xl p-3">
                    <p className="text-indigo-200 text-xs mb-0.5">Sisa</p>
                    <p className="text-white font-semibold">
                      {dailyMetrics.remaining < 0 ? '-' : ''}{formatCurrency(Math.abs(dailyMetrics.remaining))}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Add Transaction Button */}
            <button
              id="tour-add-transaction"
              onClick={() => setShowAddModal(true)}
              className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium text-sm shadow-lg shadow-indigo-600/20 transition-all active:scale-[0.98]"
            >
              + Catat Transaksi
            </button>

            {/* Pocket Cards */}
            <section id="tour-pockets">
              <div className="flex items-baseline justify-between mb-4">
                <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                  Kantong
                </h2>
                <button 
                  onClick={() => router.push('/pockets')}
                  className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition"
                >
                  Lihat semua
                </button>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                {dailyMetrics.pocketSummary.map((pocket) => (
                  <div
                    key={pocket.id}
                    onClick={() => router.push('/pockets')}
                    className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4 cursor-pointer transition-all hover:bg-gray-100 dark:hover:bg-gray-800 active:scale-[0.98] flex flex-col justify-between"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-500 uppercase tracking-wide">
                        {pocket.name}
                      </span>
                    </div>
                    <p className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                      {formatCurrency(pocket.balance)}
                    </p>
                    {pocket.targetAmount && (
                      <div className="space-y-1">
                        <div className="h-1 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-indigo-500 rounded-full transition-all"
                            style={{ width: `${Math.min(pocket.progressPercentage || 0, 100)}%` }}
                          />
                        </div>
                        <p className="text-[11px] text-gray-400">
                          {Math.round(pocket.progressPercentage || 0)}% dari target
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Right Column: Transactions */}
          <div className="lg:col-span-5 space-y-6">
            <section id="tour-transactions">
              <div className="flex items-baseline justify-between mb-4">
                <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                  Transaksi Terbaru
                </h2>
                <button 
                  onClick={() => router.push('/transactions')}
                  className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition"
                >
                  Lihat semua
                </button>
              </div>

              <div className="space-y-2">
                {recentTransactions.length === 0 ? (
                  <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-8 text-center">
                    <p className="text-sm text-gray-400">Belum ada transaksi</p>
                    <p className="text-xs text-gray-400 mt-1">Mulai catat pengeluaran pertamamu</p>
                  </div>
                ) : (
                  recentTransactions.slice(0, 5).map((tx) => (
                    <div
                      key={tx.id}
                      className="group flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors cursor-pointer"
                      onClick={() => router.push(`/transactions/${tx.id}`)}
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        tx.type === 'EXPENSE' 
                          ? 'bg-rose-50 dark:bg-rose-500/10' 
                          : 'bg-emerald-50 dark:bg-emerald-500/10'
                      }`}>
                        <span className={`text-base ${
                          tx.type === 'EXPENSE' 
                            ? 'text-rose-500' 
                            : 'text-emerald-500'
                        }`}>
                          {tx.type === 'EXPENSE' ? '↓' : '↑'}
                        </span>
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-gray-900 dark:text-white truncate">
                          {tx.category || (tx.type === 'EXPENSE' ? 'Pengeluaran' : 'Pemasukan')}
                        </p>
                        <div className="flex items-center gap-1 text-xs text-gray-400">
                          <span>{tx.pocket}</span>
                          <span>•</span>
                          <span>{new Date(tx.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</span>
                        </div>
                      </div>
                      
                      <p className={`font-medium text-sm flex-shrink-0 ${
                        tx.type.startsWith('INCOME') 
                          ? 'text-emerald-600 dark:text-emerald-400' 
                          : 'text-rose-600 dark:text-rose-400'
                      }`}>
                        {tx.type.startsWith('INCOME') ? '+' : '-'}{formatCurrency(tx.amount)}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        </div>
      </main>
      
      {showAddModal && (
        <AddTransactionModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            fetchDashboard();
            fetchAiRoast();
            showInterstitial();
          }}
        />
      )}

      {showRolloverModal && rolloverData && (
        <RolloverModal
          performanceId={rolloverData.id}
          surplus={rolloverData.surplus}
          onClose={() => setShowRolloverModal(false)}
          onSuccess={() => {
            setShowRolloverModal(false);
            fetchDashboard();
          }}
        />
      )}
    </div>
  );
}