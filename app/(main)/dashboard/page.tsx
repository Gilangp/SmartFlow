'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import AddExpenseModal from '@/components/AddExpenseModal';
import AddIncomeModal from '@/components/AddIncomeModal';
import RolloverModal from '@/components/RolloverModal';
import { showInterstitial } from '@/lib/admob';
import { DashboardData } from '@/types';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import { Sun, Moon, HelpCircle, Loader2, Coins, ChevronRight, TrendingDown, TrendingUp, Bell } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

function formatCurrency(amount: number): string {
  if (isNaN(amount) || amount === null || amount === undefined) return 'Rp 0';
  const hasFraction = amount % 1 !== 0;
  return `Rp ${amount.toLocaleString('id-ID', {
    minimumFractionDigits: 0,
    maximumFractionDigits: hasFraction ? 2 : 0,
  })}`;
}



const statusConfig = {
  GREEN: { 
    label: 'Aman', 
    progressColor: 'bg-emerald-400 shadow-lg shadow-emerald-400/60',
    cardBg: 'bg-gradient-to-br from-indigo-600 via-indigo-700 to-indigo-800 dark:from-slate-900 dark:via-indigo-950 dark:to-slate-900',
    cardBorder: 'border-2 border-emerald-400 dark:border-emerald-400',
    cardGlow: 'shadow-xl shadow-emerald-500/25 dark:shadow-emerald-500/15',
    badgeBg: 'bg-emerald-400/20 dark:bg-emerald-500/15 backdrop-blur-md',
    badgeBorder: 'border border-emerald-300 dark:border-emerald-400',
    badgeText: 'text-emerald-200 dark:text-emerald-300 font-semibold tracking-wide',
    badgeGlow: 'shadow-lg shadow-emerald-500/20'
  },
  YELLOW: { 
    label: 'Hati-hati', 
    progressColor: 'bg-amber-400 shadow-lg shadow-amber-400/80',
    cardBg: 'bg-gradient-to-br from-indigo-700 via-indigo-800 to-indigo-900 dark:from-slate-900 dark:via-indigo-950 dark:to-slate-900',
    cardBorder: 'border-2 border-amber-400 dark:border-amber-400',
    cardGlow: 'shadow-2xl shadow-amber-500/35 dark:shadow-amber-500/25 animate-pulse',
    badgeBg: 'bg-amber-500/25 dark:bg-amber-500/20 backdrop-blur-md',
    badgeBorder: 'border border-amber-300 dark:border-amber-400',
    badgeText: 'text-amber-200 dark:text-amber-300 font-bold tracking-wide',
    badgeGlow: 'shadow-lg shadow-amber-500/30 animate-pulse'
  },
  RED: { 
    label: 'Overbudget', 
    progressColor: 'bg-rose-500 shadow-lg shadow-rose-500/80',
    cardBg: 'bg-gradient-to-br from-indigo-800 via-slate-900 to-indigo-950 dark:from-slate-900 dark:via-indigo-950 dark:to-slate-900',
    cardBorder: 'border-2 border-rose-400 dark:border-rose-400',
    cardGlow: 'shadow-2xl shadow-rose-500/40 animate-pulse',
    badgeBg: 'bg-rose-500/30 dark:bg-rose-500/25 backdrop-blur-md',
    badgeBorder: 'border border-rose-300 dark:border-rose-400',
    badgeText: 'text-rose-200 font-extrabold tracking-wide',
    badgeGlow: 'shadow-xl shadow-rose-500/40 animate-pulse'
  },
};

export default function DashboardPage() {
  const router = useRouter();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [addModalType, setAddModalType] = useState<'EXPENSE' | 'INCOME_ROUTINE' | null>(null);
  const [showRolloverModal, setShowRolloverModal] = useState(false);
  const [rolloverData, setRolloverData] = useState<{ id: string; surplus: number } | null>(null);
  const [aiRoast, setAiRoast] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  const runGuidedTour = useCallback(() => {
    const driverObj = driver({
      showProgress: true,
      nextBtnText: 'Lanjut',
      prevBtnText: 'Kembali',
      doneBtnText: 'Selesai',
      steps: [
        {
          popover: {
            title: 'Selamat Datang di Finto!',
            description: 'Mari kita berkeliling sebentar untuk mengetahui cara mengelola keuangan mahasiswa secara cerdas.',
            side: 'bottom' as const,
            align: 'start' as const
          }
        },
        {
          element: '#tour-daily-allowance',
          popover: {
            title: 'Jatah Harian Pintar',
            description: 'Ini adalah jatah harian kamu hari ini. Sistem menghitungnya otomatis agar pengeluaran kamu tetap terjaga sampai akhir siklus gajian.',
            side: 'bottom' as const,
            align: 'start' as const
          }
        },
        ...(document.querySelector('#tour-ai-roast') ? [{
          element: '#tour-ai-roast',
          popover: {
            title: 'AI Financial Roaster',
            description: 'Saran finansial julid tapi jujur dari AI! Dia akan menganalisis pengeluaran kamu selama 7 hari terakhir dan memberikan roasting pedas.',
            side: 'bottom' as const,
            align: 'start' as const
          }
        }] : []),
        {
          element: '#tour-add-transaction',
          popover: {
            title: 'Catat Transaksi Cepat',
            description: 'Catat pengeluaran atau pemasukan baru kamu di sini secara cepat.',
            side: 'bottom' as const,
            align: 'start' as const
          }
        },
        {
          element: '#tour-pockets',
          popover: {
            title: 'Sistem Kantong Cerdas',
            description: 'Keuangan kamu dibagi ke dalam 2 kantong bawaan (Dompet Utama dan Tabungan) serta bebas kamu tambah sendiri dengan kantong kustom sesuai kebutuhanmu.',
            side: 'top' as const,
            align: 'start' as const
          }
        },
        {
          element: '#tour-transactions',
          popover: {
            title: 'Transaksi Terbaru',
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
    if (!token) { router.push('/login'); return; }

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
        router.push('/login');
      }
    } catch {
      router.push('/login');
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
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mx-auto mb-3" />
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
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-gray-950/80 backdrop-blur-xl border-b border-gray-100 dark:border-gray-800 pt-safe">
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
                  <Sun className="w-4 h-4" />
                ) : (
                  <Moon className="w-4 h-4" />
                )}
              </button>

              {/* Notification Settings Button (Spacious on Desktop, Icon on Mobile) */}
              <button
                onClick={() => router.push('/settings/notifications')}
                className="h-9 px-2.5 sm:px-3.5 rounded-xl bg-indigo-50/80 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-all flex items-center gap-2 shadow-sm"
                aria-label="Pengaturan Notifikasi"
                title="Pengaturan Notifikasi"
              >
                <Bell className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span className="hidden md:inline text-xs font-semibold tracking-wide">Pengingat & Notifikasi</span>
              </button>

              {/* Help/Tour Button */}
              <button
                onClick={runGuidedTour}
                className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all"
                aria-label="Tampilkan Panduan"
                title="Panduan Pengguna"
              >
                <HelpCircle className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-5 py-6">

        {/* AI Roast Card */}
        <div id="tour-ai-roast" className="mb-6 bg-indigo-50 dark:bg-indigo-500/5 rounded-2xl p-5 border-l-4 border-indigo-500">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-indigo-600 dark:text-indigo-400 text-sm font-bold">AI</span>
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                <p className="text-xs text-indigo-500 dark:text-indigo-400 font-medium">AI Financial Roaster</p>
                <button
                  onClick={fetchAiRoast}
                  disabled={aiLoading}
                  className="px-3 py-1.5 rounded-lg bg-indigo-100 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-medium transition-all hover:bg-indigo-200 dark:hover:bg-indigo-500/20 disabled:opacity-50 flex items-center gap-2"
                >
                  {aiLoading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Memuat
                    </>
                  ) : (
                    aiRoast ? 'Roast Ulang' : 'Roast AI'
                  )}
                </button>
              </div>
              <div className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mt-1">
                {aiRoast ? (
                  <div className="prose dark:prose-invert max-w-none text-sm font-normal text-gray-700 dark:text-gray-300 leading-relaxed">
                    <ReactMarkdown>{aiRoast}</ReactMarkdown>
                  </div>
                ) : aiLoading ? (
                  <span className="text-gray-500 dark:text-gray-400 italic">Sedang menganalisis keuanganmu...</span>
                ) : (
                  <span className="text-gray-500 dark:text-gray-400 italic">Klik tombol untuk melihat analisis AI.</span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column: Metrics & Pockets */}
          <div className="lg:col-span-7 space-y-6">
            {/* Daily Allowance Card (Badge Besar) */}
            <div id="tour-daily-allowance" className={`relative overflow-hidden rounded-2xl p-6 transition-all duration-500 ${status.cardBg} ${status.cardBorder} ${status.cardGlow}`}>
              
              <div className="relative z-10">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <p className="text-indigo-200 text-xs font-medium tracking-wide mb-1">
                      Jatah Hari Ini
                    </p>
                    <p className="text-3xl font-bold text-white tracking-tight">
                      {formatCurrency(dailyMetrics.dailyAllowance)}
                    </p>
                  </div>
                  <div className={`px-3 py-1.5 rounded-full backdrop-blur-md border transition-all ${status.badgeBg} ${status.badgeBorder} ${status.badgeGlow}`}>
                    <span className={`text-xs ${status.badgeText}`}>{status.label}</span>
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

            {/* Action Buttons */}
            <div id="tour-add-transaction" className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setAddModalType('EXPENSE')}
                className="py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium text-sm shadow-md shadow-indigo-600/15 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <TrendingDown className="w-4 h-4" />
                Catat Pengeluaran
              </button>
              <button
                onClick={() => setAddModalType('INCOME_ROUTINE')}
                className="py-3.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 rounded-xl font-medium text-sm backdrop-blur-sm transition-all active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <TrendingUp className="w-4 h-4 text-emerald-500" />
                Catat Pemasukan
              </button>
            </div>

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
                {[...dailyMetrics.pocketSummary]
                  .sort((a, b) => {
                    const order = ['MAIN', 'SAVINGS', 'EMERGENCY', 'WISHLIST', 'CUSTOM'];
                    return order.indexOf(a.type) - order.indexOf(b.type);
                  })
                  .slice(0, 4)
                  .map((pocket) => (
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
                  recentTransactions.slice(0, 5).map((tx) => {
                    const isTransferOut = tx.type === 'TRANSFER' && (tx.notes?.toLowerCase().includes('transfer to') || tx.notes?.toLowerCase().includes('transfer ke'));
                    const isTransferIn = tx.type === 'TRANSFER' && (tx.notes?.toLowerCase().includes('received from') || tx.notes?.toLowerCase().includes('transfer dari'));
                    
                    const isExpenseStyle = tx.type === 'EXPENSE' || isTransferOut;
                    const isIncomeStyle = tx.type.startsWith('INCOME') || isTransferIn;
                    
                    let title = tx.category || (tx.type === 'EXPENSE' ? 'Pengeluaran' : 'Pemasukan');
                    if (tx.type === 'TRANSFER') {
                      title = isTransferOut ? 'Transfer Keluar' : isTransferIn ? 'Transfer Masuk' : 'Transfer';
                    }

                    const icon = isExpenseStyle ? '↓' : isIncomeStyle ? '↑' : '⇄';
                    const sign = isIncomeStyle ? '+' : isExpenseStyle ? '-' : '';

                    return (
                      <div
                        key={tx.id}
                        className="group flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors cursor-pointer"
                        onClick={() => router.push('/transactions')}
                      >
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                          isExpenseStyle
                            ? 'bg-rose-50 dark:bg-rose-500/10' 
                            : tx.type === 'TRANSFER' && !isTransferIn && !isTransferOut
                            ? 'bg-indigo-50 dark:bg-indigo-500/10'
                            : 'bg-emerald-50 dark:bg-emerald-500/10'
                        }`}>
                          <span className={`text-base ${
                            isExpenseStyle
                              ? 'text-rose-500' 
                              : tx.type === 'TRANSFER' && !isTransferIn && !isTransferOut
                              ? 'text-indigo-500'
                              : 'text-emerald-500'
                          }`}>
                            {icon}
                          </span>
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-gray-900 dark:text-white truncate">
                            {title}
                          </p>
                          <div className="flex items-center gap-1 text-xs text-gray-400 flex-nowrap overflow-hidden">
                            <span className="truncate">{tx.pocket}</span>
                            <span className="flex-shrink-0">•</span>
                            <span className="flex-shrink-0">{new Date(tx.date).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                            {tx.createdAt && (
                              <>
                                <span className="flex-shrink-0">•</span>
                                <span className="flex-shrink-0">{new Date(tx.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
                              </>
                            )}
                          </div>
                        </div>
                        
                        <p className={`font-medium text-sm flex-shrink-0 ${
                          isIncomeStyle 
                            ? 'text-emerald-600 dark:text-emerald-400' 
                            : isExpenseStyle
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-indigo-600 dark:text-indigo-400'
                        }`}>
                          {sign}{formatCurrency(tx.amount)}
                        </p>
                      </div>
                    );
                  })
                )}
              </div>
            </section>
          </div>
        </div>
      </main>
      
      {addModalType === 'EXPENSE' && (
        <AddExpenseModal
          onClose={() => setAddModalType(null)}
          onSuccess={() => {
            setAddModalType(null);
            fetchDashboard();
            fetchAiRoast();
            showInterstitial();
          }}
        />
      )}

      {addModalType === 'INCOME_ROUTINE' && (
        <AddIncomeModal
          onClose={() => setAddModalType(null)}
          onSuccess={() => {
            setAddModalType(null);
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
          pockets={dailyMetrics.pocketSummary}
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