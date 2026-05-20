'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import BottomNav from '@/components/BottomNav';
import AddTransactionModal from '@/components/AddTransactionModal';
import AddIncomeRoutineModal from '@/components/AddIncomeRoutineModal';
import { TransactionRecord } from '@/types';

function formatCurrency(amount: number): string {
  return `Rp ${amount.toLocaleString('id-ID')}`;
}

const TYPE_LABELS: Record<string, { label: string; emoji: string; color: string }> = {
  EXPENSE: { label: 'Pengeluaran', emoji: '💸', color: 'text-rose-500' },
  INCOME_ROUTINE: { label: 'Pemasukan Rutin', emoji: '💰', color: 'text-emerald-500' },
  INCOME_BONUS: { label: 'Pemasukan Bonus', emoji: '🎁', color: 'text-amber-500' },
};

export default function TransactionsPage() {
  const router = useRouter();
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showIncomeRoutineModal, setShowIncomeRoutineModal] = useState(false);
  const [paydayDate, setPaydayDate] = useState<number | null>(null);
  const [pendingIncomeCount, setPendingIncomeCount] = useState(0);
  const [filter, setFilter] = useState<'ALL' | 'EXPENSE' | 'INCOME_ROUTINE' | 'INCOME_BONUS'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const getToken = useCallback(() => localStorage.getItem('sf-token'), []);

  // Fetch user profile to get paydayDate and pending income
  useEffect(() => {
    const fetchProfile = async () => {
      const token = getToken();
      if (!token) return;
      try {
        const [profileRes, pendingRes] = await Promise.all([
          fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } }),
          fetch('/api/income/pending', { headers: { Authorization: `Bearer ${token}` } }),
        ]);

        const profileData = await profileRes.json();
        if (profileData.success && profileData.data.paydayDate) {
          setPaydayDate(profileData.data.paydayDate);
        }

        const pendingData = await pendingRes.json();
        if (pendingData.success && pendingData.data) {
          setPendingIncomeCount(pendingData.data.length);
        }
      } catch {
        // Silent fail
      }
    };
    fetchProfile();
  }, [getToken]);

  const fetchTransactions = useCallback(async () => {
    const token = getToken();
    if (!token) { router.push('/auth/login'); return; }
    try {
      const url = filter !== 'ALL' ? `/api/transactions?type=${filter}&limit=100` : '/api/transactions?limit=100';
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.success) setTransactions(data.data);
      else router.push('/auth/login');
    } catch {
      router.push('/auth/login');
    } finally {
      setIsLoading(false);
    }
  }, [getToken, router, filter]);

  useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

  const filtered = transactions.filter((tx) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      tx.category?.toLowerCase().includes(q) ||
      tx.pocket.toLowerCase().includes(q) ||
      tx.notes?.toLowerCase().includes(q)
    );
  });

  // Group by date
  const grouped = filtered.reduce((acc, tx) => {
    const date = tx.date;
    if (!acc[date]) acc[date] = [];
    acc[date].push(tx);
    return acc;
  }, {} as Record<string, TransactionRecord[]>);

  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  const totalIncome = filtered.filter((t) => t.type.startsWith('INCOME')).reduce((s, t) => s + t.amount, 0);
  const totalExpense = filtered.filter((t) => t.type === 'EXPENSE').reduce((s, t) => s + t.amount, 0);

  return (
    <div className="page-shell">
      <header className="page-header">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <h1 className="text-xl font-bold text-surface-900 dark:text-white mb-3">Riwayat Transaksi</h1>
          {/* Search */}
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Cari transaksi..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-surface-200 dark:border-surface-600 bg-surface-50 dark:bg-surface-800 text-sm text-surface-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
            />
          </div>
        </div>
      </header>

      <main className="page-content space-y-5">
        {/* Pending Income Alert */}
        {pendingIncomeCount > 0 && (
          <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700/30 flex items-center justify-between">
            <div className="flex items-center gap-3 flex-1">
              <div className="text-2xl">📋</div>
              <div className="flex-1">
                <p className="font-semibold text-blue-900 dark:text-blue-100 text-sm">
                  Ada {pendingIncomeCount} gajian yang belum dikonfirmasi
                </p>
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  Klik tombol gajian untuk mengkonfirmasi
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowIncomeRoutineModal(true)}
              className="py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-all flex-shrink-0"
            >
              Konfirmasi
            </button>
          </div>
        )}

        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="card p-4">
            <p className="text-xs text-slate-400 mb-1">Total Pemasukan</p>
            <p className="text-lg font-black text-emerald-500 tabular-nums">{formatCurrency(totalIncome)}</p>
          </div>
          <div className="card p-4">
            <p className="text-xs text-slate-400 mb-1">Total Pengeluaran</p>
            <p className="text-lg font-black text-rose-500 tabular-nums">{formatCurrency(totalExpense)}</p>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {([
            { value: 'ALL', label: 'Semua' },
            { value: 'EXPENSE', label: '💸 Pengeluaran' },
            { value: 'INCOME_ROUTINE', label: '💰 Rutin' },
            { value: 'INCOME_BONUS', label: '🎁 Bonus' },
          ] as const).map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold flex-shrink-0 transition-all ${
                filter === f.value
                  ? 'bg-primary-600 text-white shadow-md'
                  : 'bg-surface-100 dark:bg-surface-800 text-slate-500 dark:text-slate-400'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Add Transaction Buttons - 2 options */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setShowAddModal(true)}
            className="py-3 px-3 bg-rose-100 dark:bg-rose-900/30 hover:bg-rose-200 dark:hover:bg-rose-800/30 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-700/50 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            💸 Pengeluaran / 🎁 Bonus
          </button>
          <button
            onClick={() => setShowIncomeRoutineModal(true)}
            className="py-3 px-3 bg-emerald-100 dark:bg-emerald-900/30 hover:bg-emerald-200 dark:hover:bg-emerald-800/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-700/50 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            💰 Terima Gajian
          </button>
        </div>

        {/* Transaction list */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="card p-4 flex gap-3">
                <div className="skeleton w-10 h-10 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton h-4 w-3/4 rounded" />
                  <div className="skeleton h-3 w-1/2 rounded" />
                </div>
                <div className="skeleton h-5 w-16 rounded" />
              </div>
            ))}
          </div>
        ) : sortedDates.length === 0 ? (
          <div className="card p-10 text-center">
            <div className="text-4xl mb-3">📭</div>
            <p className="font-semibold text-surface-900 dark:text-white">Belum ada transaksi</p>
            <p className="text-sm text-slate-400 mt-1">Mulai catat sekarang!</p>
          </div>
        ) : (
          sortedDates.map((date) => (
            <div key={date}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  {new Date(date + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
                <p className="text-xs text-slate-400 tabular-nums">
                  {formatCurrency(
                    grouped[date].filter((t) => t.type === 'EXPENSE').reduce((s, t) => s + t.amount, 0)
                  )} keluar
                </p>
              </div>
              <div className="card divide-y divide-surface-100 dark:divide-surface-700/50 overflow-hidden">
                {grouped[date].map((tx) => {
                  const typeInfo = TYPE_LABELS[tx.type];
                  return (
                    <div key={tx.id} className="flex items-center gap-3 p-4 hover:bg-surface-50 dark:hover:bg-surface-700/30 transition-colors">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 ${
                        tx.type === 'EXPENSE' ? 'bg-rose-100 dark:bg-rose-900/30' :
                        tx.type === 'INCOME_BONUS' ? 'bg-amber-100 dark:bg-amber-900/30' :
                        'bg-emerald-100 dark:bg-emerald-900/30'
                      }`}>
                        {typeInfo.emoji}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-surface-900 dark:text-white truncate">
                          {tx.category || typeInfo.label}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-xs text-slate-400">{tx.pocket}</span>
                          {tx.categoryType && (
                            <>
                              <span className="text-slate-300">·</span>
                              <span className={`text-xs font-medium ${tx.categoryType === 'NEED' ? 'text-primary-500' : 'text-accent-400'}`}>
                                {tx.categoryType}
                              </span>
                            </>
                          )}
                          {tx.notes && (
                            <>
                              <span className="text-slate-300">·</span>
                              <span className="text-xs text-slate-400 truncate">{tx.notes}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <p className={`font-bold text-sm tabular-nums flex-shrink-0 ${typeInfo.color}`}>
                        {tx.type.startsWith('INCOME') ? '+' : '-'}{formatCurrency(tx.amount)}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </main>

      <BottomNav />
      {showAddModal && (
        <AddTransactionModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => { 
            setShowAddModal(false); 
            fetchTransactions();
            // Refetch pending income count
            const token = getToken();
            if (token) {
              fetch('/api/income/pending', { headers: { Authorization: `Bearer ${token}` } })
                .then((r) => r.json())
                .then((data) => {
                  if (data.success) setPendingIncomeCount(data.data.length);
                });
            }
          }}
        />
      )}
      {showIncomeRoutineModal && (
        <AddIncomeRoutineModal
          onClose={() => setShowIncomeRoutineModal(false)}
          onSuccess={() => { 
            setShowIncomeRoutineModal(false); 
            fetchTransactions();
            // Refetch pending income count
            const token = getToken();
            if (token) {
              fetch('/api/income/pending', { headers: { Authorization: `Bearer ${token}` } })
                .then((r) => r.json())
                .then((data) => {
                  if (data.success) setPendingIncomeCount(data.data.length);
                });
            }
          }}
          paydayDate={paydayDate}
        />
      )}
    </div>
  );
}
