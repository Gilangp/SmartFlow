'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import BottomNav from '@/components/BottomNav';
import AddTransactionModal from '@/components/AddTransactionModal';
import { DashboardData } from '@/types';

function formatCurrency(amount: number): string {
  if (amount >= 1000000) return `Rp ${(amount / 1000000).toFixed(1)}jt`;
  if (amount >= 1000) return `Rp ${(amount / 1000).toFixed(0)}rb`;
  return `Rp ${amount.toLocaleString('id-ID')}`;
}

function formatCurrencyFull(amount: number): string {
  return `Rp ${amount.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const pocketIcons: Record<string, string> = {
  MAIN: '💳',
  EMERGENCY: '🛡️',
  SAVINGS: '📈',
  WISHLIST: '🎯',
};

const pocketGradients: Record<string, string> = {
  MAIN: 'pocket-main',
  EMERGENCY: 'pocket-emergency',
  SAVINGS: 'pocket-savings',
  WISHLIST: 'pocket-wishlist',
};

const statusConfig = {
  GREEN: { color: 'text-emerald-400', bg: 'bg-emerald-500', label: 'Aman', emoji: '✅', ring: 'ring-emerald-500/30' },
  YELLOW: { color: 'text-amber-400', bg: 'bg-amber-500', label: 'Hati-hati', emoji: '⚠️', ring: 'ring-amber-500/30' },
  RED: { color: 'text-rose-400', bg: 'bg-rose-500', label: 'Overbudget!', emoji: '🚨', ring: 'ring-rose-500/30' },
};

export default function DashboardPage() {
  const router = useRouter();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [aiRoast, setAiRoast] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

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
    // Auto-fetch AI roast on page load
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
        else setAiRoast('AI lagi istirahat. Coba lagi nanti! 😴');
      } catch {
        setAiRoast('Gagal memuat AI Roaster. Periksa koneksi kamu.');
      } finally {
        setAiLoading(false);
      }
    };
    fetchAutoRoast();
  }, [fetchDashboard, getToken]);

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
      else setAiRoast('AI lagi istirahat. Coba lagi nanti! 😴');
    } catch {
      setAiRoast('Gagal memuat AI Roaster. Periksa koneksi kamu.');
    } finally {
      setAiLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400 text-sm">Memuat dashboard...</p>
        </div>
      </div>
    );
  }

  if (!dashboard) return null;

  const { dailyMetrics, user, recentTransactions } = dashboard;
  const status = statusConfig[dailyMetrics.status];
  const pocketSummary = dailyMetrics.pocketSummary;

  const todayStr = new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="page-shell">
      {/* Header */}
      <header className="page-header">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 dark:text-slate-500">{todayStr}</p>
            <h1 className="text-lg font-bold text-surface-900 dark:text-white">
              Hei, {user.name.split(' ')[0]}! 👋
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className="w-9 h-9 rounded-xl bg-surface-100 dark:bg-surface-800 flex items-center justify-center text-surface-600 dark:text-slate-300 hover:bg-surface-200 dark:hover:bg-surface-700 transition-all"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
          </div>
        </div>
      </header>

      <main className="page-content space-y-5">
        {/* ── AI Financial Roaster ──────────────────── */}
        <section className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-accent-500 to-rose-500 rounded-lg flex items-center justify-center text-sm">
                🤖
              </div>
              <div>
                <h2 className="text-sm font-bold text-surface-900 dark:text-white">AI Financial Roaster</h2>
                <p className="text-xs text-slate-400">Analisis jujur kebiasaan belanjamu</p>
              </div>
            </div>
            <button
              id="btn-ai-roast"
              onClick={fetchAiRoast}
              disabled={aiLoading}
              className="px-3 py-1.5 bg-accent-600/10 hover:bg-accent-600/20 text-accent-500 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
            >
              {aiLoading ? 'Loading...' : 'Roast Me!'}
            </button>
          </div>
          <div className="min-h-[60px] flex items-center">
            {aiLoading ? (
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <div className="w-4 h-4 border border-accent-500 border-t-transparent rounded-full animate-spin" />
                AI sedang menganalisis pola belanjamu...
              </div>
            ) : aiRoast ? (
              <p className="text-sm text-surface-700 dark:text-slate-300 leading-relaxed italic">
                "{aiRoast}"
              </p>
            ) : (
              <p className="text-sm text-slate-400 leading-relaxed">
                Klik <strong className="text-accent-400">Roast Me!</strong> untuk mendapatkan analisis AI tentang kebiasaan belanjamu 7 hari terakhir. Siap-siap kena semprot! 🌶️
              </p>
            )}
          </div>
        </section>

        {/* ── Daily Allowance Hero Card ─────────────── */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary-600 via-primary-700 to-accent-700 p-6 text-white shadow-2xl glow-primary">
          {/* Background pattern */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-white blur-3xl transform translate-x-1/2 -translate-y-1/2" />
            <div className="absolute bottom-0 left-0 w-40 h-40 rounded-full bg-white blur-2xl transform -translate-x-1/2 translate-y-1/2" />
          </div>

          <div className="relative z-10">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-primary-200 text-xs font-medium uppercase tracking-wider mb-1">Jatah Boleh Jajan Hari Ini</p>
                <div className="text-4xl font-black tabular-nums animate-fade-in">
                  {formatCurrencyFull(dailyMetrics.dailyAllowance)}
                </div>
              </div>
              <div className={`px-3 py-1.5 rounded-xl bg-white/15 backdrop-blur-sm border border-white/20 flex items-center gap-1.5`}>
                <span className="text-sm">{status.emoji}</span>
                <span className="text-xs font-bold">{status.label}</span>
              </div>
            </div>

            {/* Progress bar */}
            <div className="mb-4">
              <div className="flex justify-between text-xs text-primary-200 mb-1.5">
                <span>Terpakai hari ini</span>
                <span className="font-semibold">{Math.round(dailyMetrics.percentageUsed)}%</span>
              </div>
              <div className="h-2.5 bg-white/20 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    dailyMetrics.status === 'RED' ? 'bg-rose-400' :
                    dailyMetrics.status === 'YELLOW' ? 'bg-amber-400' :
                    'bg-emerald-400'
                  }`}
                  style={{ width: `${Math.min(dailyMetrics.percentageUsed, 100)}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-3 border border-white/10">
                <p className="text-primary-200 text-xs mb-0.5">Sudah terpakai</p>
                <p className="font-bold tabular-nums">{formatCurrency(dailyMetrics.totalSpent)}</p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-3 border border-white/10">
                <p className="text-primary-200 text-xs mb-0.5">Sisa hari ini</p>
                <p className={`font-bold tabular-nums ${dailyMetrics.remaining < 0 ? 'text-rose-300' : ''}`}>
                  {dailyMetrics.remaining < 0 ? '-' : ''}{formatCurrency(Math.abs(dailyMetrics.remaining))}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Quick Action FAB ───────────────────────── */}
        <button
          id="btn-add-transaction"
          onClick={() => setShowAddModal(true)}
          className="w-full py-4 bg-gradient-to-r from-primary-600 to-accent-600 hover:from-primary-500 hover:to-accent-500 text-white rounded-2xl font-bold text-sm shadow-xl hover:shadow-glow-primary transition-all duration-200 active:scale-95 flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          Tambah Transaksi
        </button>

        {/* ── 4 Pocket Summary ──────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-surface-900 dark:text-white">Kantong Finansial</h2>
            <button onClick={() => router.push('/pockets')} className="text-xs text-primary-500 font-medium hover:text-primary-400">
              Lihat semua →
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {pocketSummary.map((pocket) => (
              <div
                key={pocket.id}
                className={`${pocketGradients[pocket.type]} rounded-2xl p-4 text-white relative overflow-hidden cursor-pointer hover:scale-[1.02] transition-transform shadow-lg`}
                onClick={() => router.push('/pockets')}
              >
                <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full transform translate-x-6 -translate-y-6" />
                <div className="relative z-10">
                  <div className="text-xl mb-1">{pocketIcons[pocket.type]}</div>
                  <p className="text-white/70 text-xs font-medium mb-0.5">{pocket.name}</p>
                  <p className="text-lg font-black tabular-nums leading-tight">
                    {formatCurrency(pocket.balance)}
                  </p>
                  {pocket.targetAmount && (
                    <div className="mt-2">
                      <div className="h-1 bg-white/20 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-white/70 rounded-full transition-all"
                          style={{ width: `${Math.min(pocket.progressPercentage || 0, 100)}%` }}
                        />
                      </div>
                      <p className="text-white/60 text-xs mt-1">
                        {(pocket.progressPercentage || 0).toFixed(0)}% dari target
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Recent Transactions ───────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-surface-900 dark:text-white">Transaksi Terakhir</h2>
            <button onClick={() => router.push('/transactions')} className="text-xs text-primary-500 font-medium hover:text-primary-400">
              Lihat semua →
            </button>
          </div>
          <div className="card divide-y divide-surface-100 dark:divide-surface-700/50 overflow-hidden">
            {recentTransactions.length === 0 ? (
              <div className="p-8 text-center">
                <div className="text-4xl mb-2">📭</div>
                <p className="text-sm text-slate-400">Belum ada transaksi</p>
                <p className="text-xs text-slate-500 mt-1">Mulai catat pengeluaran pertamamu!</p>
              </div>
            ) : (
              recentTransactions.slice(0, 5).map((tx) => (
                <div key={tx.id} className="flex items-center gap-3 p-4 hover:bg-surface-50 dark:hover:bg-surface-700/30 transition-colors">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 ${
                    tx.type === 'EXPENSE' ? 'bg-rose-100 dark:bg-rose-900/30' : 'bg-emerald-100 dark:bg-emerald-900/30'
                  }`}>
                    {tx.type === 'EXPENSE' ? '💸' : tx.type === 'INCOME_BONUS' ? '🎁' : '💰'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-surface-900 dark:text-white truncate">
                      {tx.category || (tx.type === 'EXPENSE' ? 'Pengeluaran' : 'Pemasukan')}
                    </p>
                    <p className="text-xs text-slate-400 flex items-center gap-1">
                      <span>{tx.pocket}</span>
                      <span>•</span>
                      <span>{new Date(tx.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</span>
                      {tx.categoryType && (
                        <>
                          <span>•</span>
                          <span className={tx.categoryType === 'NEED' ? 'text-primary-500' : 'text-accent-400'}>{tx.categoryType}</span>
                        </>
                      )}
                    </p>
                  </div>
                  <p className={`font-bold text-sm tabular-nums flex-shrink-0 ${
                    tx.type.startsWith('INCOME') ? 'text-emerald-500' : 'text-rose-500'
                  }`}>
                    {tx.type.startsWith('INCOME') ? '+' : '-'}{formatCurrency(tx.amount)}
                  </p>
                </div>
              ))
            )}
          </div>
        </section>
      </main>

      <BottomNav />
      {showAddModal && (
        <AddTransactionModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            fetchDashboard();
          }}
        />
      )}
    </div>
  );
}
