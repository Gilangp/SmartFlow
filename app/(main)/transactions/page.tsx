// app/transactions/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import AddTransactionModal from '@/components/AddTransactionModal';
import AddIncomeRoutineModal from '@/components/AddIncomeRoutineModal';
import ScanReceiptModal from '@/components/ScanReceiptModal';
import { showInterstitial } from '@/lib/admob';
import { TransactionRecord } from '@/types';
import { ScanLine, Lock, Download } from 'lucide-react';
import toast from 'react-hot-toast';

import AnalyticsView from '@/components/AnalyticsView';



function formatCurrency(amount: number): string {
  if (amount >= 1000000) return `Rp ${(amount / 1000000).toFixed(1)}jt`;
  if (amount >= 1000) return `Rp ${(amount / 1000).toFixed(0)}rb`;
  return `Rp ${amount.toLocaleString('id-ID')}`;
}

export default function TransactionsPage() {
  const router = useRouter();
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showIncomeRoutineModal, setShowIncomeRoutineModal] = useState(false);
  const [showScanModal, setShowScanModal] = useState(false);
  const [scanPrefill, setScanPrefill] = useState<{ amount?: number; date?: string; notes?: string; category?: string } | null>(null);
  const [paydayDate, setPaydayDate] = useState<number | null>(null);
  const [pendingIncomeCount, setPendingIncomeCount] = useState(0);
  const [filter, setFilter] = useState<'ALL' | 'EXPENSE' | 'INCOME_ROUTINE' | 'INCOME_BONUS'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [token, setToken] = useState('');
  const [canScanReceipt, setCanScanReceipt] = useState(false);
  const [canExportExcel, setCanExportExcel] = useState(false);
  const [checkingSub, setCheckingSub] = useState(true);
  const [viewMode, setViewMode] = useState<'list' | 'analytics'>('list');



  const getToken = useCallback(() => localStorage.getItem('sf-token'), []);

  useEffect(() => {
    const t = localStorage.getItem('sf-token') || '';
    setToken(t);
    if (t) {
      fetch('/api/subscription', { headers: { Authorization: `Bearer ${t}` } })
        .then((r) => r.json())
        .then((data) => {
          if (data.success) {
            setCanScanReceipt(data.data.limits.canScanReceipt);
            setCanExportExcel(data.data.limits.canExportExcel);
          }
        })
        .catch(() => {})
        .finally(() => setCheckingSub(false));
    } else {
      setCheckingSub(false);
    }
  }, []);


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
        if (profileData.success && profileData.data.paydayDate) setPaydayDate(profileData.data.paydayDate);
        const pendingData = await pendingRes.json();
        if (pendingData.success && pendingData.data) setPendingIncomeCount(pendingData.data.length);
      } catch {}
    };
    fetchProfile();
  }, [getToken]);

  const fetchTransactions = useCallback(async () => {
    const token = getToken();
    if (!token) { router.push('/login'); return; }
    try {
      const url = filter !== 'ALL' ? `/api/transactions?type=${filter}&limit=100` : '/api/transactions?limit=100';
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.success) setTransactions(data.data);
      else router.push('/login');
    } catch { router.push('/login'); }
    finally { setIsLoading(false); }
  }, [getToken, router, filter]);

  useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

  const handleExport = async () => {
    if (!canExportExcel) {
      toast.error('Fitur Export Excel/CSV hanya untuk pengguna Premium. Silakan upgrade plan kamu!');
      router.push('/upgrade');
      return;
    }
    
    try {
      const toastId = toast.loading('Sedang menyiapkan file CSV...');
      const res = await fetch('/api/transactions/export', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!res.ok) {
        toast.dismiss(toastId);
        toast.error('Gagal mengekspor data');
        return;
      }
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `SmartFlow_Transactions_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
      toast.dismiss(toastId);
      toast.success('Berhasil mendownload data transaksi!');
    } catch (err) {
      toast.error('Terjadi kesalahan saat export');
    }
  };

  const filtered = transactions.filter((tx) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (tx.category?.toLowerCase().includes(q) || tx.pocket.toLowerCase().includes(q) || tx.notes?.toLowerCase().includes(q));
  });

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
    <div className="min-h-screen bg-gray-50/50 dark:bg-gray-950">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-gray-950/80 backdrop-blur-xl border-b border-gray-200 dark:border-gray-800 pt-safe">
        <div className="max-w-7xl mx-auto px-5 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-gray-100 dark:bg-gray-800 p-1 rounded-xl inline-flex">
              <button 
                onClick={() => setViewMode('list')}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${viewMode === 'list' ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
              >
                Daftar
              </button>
              <button 
                onClick={() => setViewMode('analytics')}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition flex items-center gap-1.5 ${viewMode === 'analytics' ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
              >
                Analitik
                {!canExportExcel && !checkingSub && <Lock className="w-3 h-3 text-indigo-400" />}
              </button>
            </div>
            <button 
              onClick={handleExport}
              disabled={checkingSub}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                canExportExcel 
                  ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 dark:hover:bg-emerald-900/50' 
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400'
              }`}
            >
              {!canExportExcel && !checkingSub ? <Lock className="w-3.5 h-3.5" /> : <Download className="w-3.5 h-3.5" />}
              <span>Export CSV</span>
            </button>
          </div>
          {viewMode === 'list' && (
            <div className="relative">
              <input
                type="text"
                placeholder="Cari transaksi..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm"
              />
            </div>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-5 py-6">
        {/* Pending Income Alert */}
        {pendingIncomeCount > 0 && (
          <div className="mb-5 p-3 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 flex items-center justify-between">
            <div>
              <p className="font-medium text-indigo-700 dark:text-indigo-300 text-sm">
                {pendingIncomeCount} pemasukan belum dikonfirmasi
              </p>
              <p className="text-xs text-indigo-600 dark:text-indigo-400">Klik tombol pemasukan untuk konfirmasi</p>
            </div>
            <button onClick={() => setShowIncomeRoutineModal(true)} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition">
              Konfirmasi
            </button>
          </div>
        )}

        {/* View Mode Content */}
        {viewMode === 'analytics' ? (
          <AnalyticsView 
            transactions={transactions} 
            canUseAnalytics={canExportExcel} // we use canExportExcel as proxy for Premium plan limit
            checkingSub={checkingSub}
          />
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 gap-3 mb-5">
              <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-800">
                <p className="text-xs text-gray-500 mb-1">Pemasukan</p>
                <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(totalIncome)}</p>
              </div>
              <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-800">
                <p className="text-xs text-gray-500 mb-1">Pengeluaran</p>
                <p className="text-lg font-bold text-rose-600 dark:text-rose-400">{formatCurrency(totalExpense)}</p>
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-5 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              {[
                { value: 'ALL', label: 'Semua' },
                { value: 'EXPENSE', label: 'Pengeluaran' },
                { value: 'INCOME_ROUTINE', label: 'Pemasukan' },
                { value: 'INCOME_BONUS', label: 'Bonus' },
              ].map((f) => (
                <button
                  key={f.value}
                  onClick={() => setFilter(f.value as any)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex-shrink-0 ${
                    filter === f.value
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <button onClick={() => setShowAddModal(true)} className="py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium text-sm transition shadow-sm shadow-indigo-600/20 active:scale-[0.98]">
                + Pengeluaran / Bonus
              </button>
              <button onClick={() => setShowIncomeRoutineModal(true)} className="py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium text-sm transition shadow-sm shadow-indigo-600/20 active:scale-[0.98]">
                + Pemasukan
              </button>
            </div>

            {/* Scan Struk Button */}
            <button
              onClick={() => {
                if (!canScanReceipt) {
                  toast.error('Fitur Scan Struk hanya untuk paket Student & Premium. Silakan verifikasi KTM atau upgrade!');
                  router.push('/upgrade');
                  return;
                }
                setShowScanModal(true);
              }}
              disabled={checkingSub}
              className={`w-full mb-6 py-2.5 flex items-center justify-center gap-2 rounded-lg font-medium text-sm transition active:scale-[0.98] ${
                !canScanReceipt && !checkingSub
                  ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 border border-dashed border-gray-300 dark:border-gray-750 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700/50'
                  : 'bg-white dark:bg-gray-900 border border-dashed border-indigo-300 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/20'
              }`}
            >
              {!canScanReceipt && !checkingSub ? (
                <span className="flex items-center justify-center gap-2 text-center w-full px-2">
                  <Lock className="w-4 h-4 flex-shrink-0 text-gray-400" />
                  <span className="leading-tight">Scan Struk / Kwitansi (Khusus Student & Premium)</span>
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2 text-center w-full px-2">
                  <ScanLine className="w-4 h-4 flex-shrink-0" />
                  <span className="leading-tight">Scan Struk / Kwitansi (AI)</span>
                </span>

              )}
            </button>

            {/* Transaction List */}
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 animate-pulse" />
                ))}
              </div>
            ) : sortedDates.length === 0 ? (
              <div className="bg-white dark:bg-gray-900 rounded-xl p-10 text-center border border-gray-200 dark:border-gray-800">
                <p className="text-gray-500">Belum ada transaksi</p>
                <p className="text-xs text-gray-400 mt-1">Mulai catat sekarang</p>
              </div>
            ) : (
              sortedDates.map((date) => (
                <div key={date} className="mb-6">
                  <div className="flex justify-between mb-2">
                    <p className="text-xs font-medium text-gray-500">
                      {new Date(date + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </p>
                    <p className="text-xs text-gray-400 font-medium">
                      {(() => {
                        const dailyNet = grouped[date].reduce((acc, t) => {
                          if (t.type.startsWith('INCOME')) return acc + t.amount;
                          if (t.type === 'EXPENSE') return acc - t.amount;
                          return acc; // TRANSFER tak ubah net harian (biasanya antar kantong)
                        }, 0);
                        return dailyNet > 0 
                          ? `+${formatCurrency(dailyNet)}` 
                          : dailyNet < 0 
                            ? `-${formatCurrency(Math.abs(dailyNet))}` 
                            : 'Rp 0';
                      })()}
                    </p>
                  </div>
                  <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
                    {grouped[date].map((tx) => {
                      const isTransferOut = tx.type === 'TRANSFER' && tx.notes?.toLowerCase().includes('transfer to');
                      const isTransferIn = tx.type === 'TRANSFER' && tx.notes?.toLowerCase().includes('received from');
                      
                      const isExpenseStyle = tx.type === 'EXPENSE' || isTransferOut;
                      const isIncomeStyle = tx.type.startsWith('INCOME') || isTransferIn;
                      
                      let title = tx.category || (tx.type === 'EXPENSE' ? 'Pengeluaran' : tx.type === 'INCOME_BONUS' ? 'Bonus' : tx.type === 'INCOME_ROUTINE' ? 'Pemasukan' : 'Transfer');
                      if (tx.type === 'TRANSFER') {
                        title = isTransferOut ? 'Transfer Keluar' : isTransferIn ? 'Transfer Masuk' : 'Transfer';
                      }

                      const icon = isExpenseStyle ? '↓' : isIncomeStyle ? '↑' : '⇄';
                      const sign = isIncomeStyle ? '+' : isExpenseStyle ? '-' : '';

                      const bgClass = isExpenseStyle ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-500' :
                                      tx.type === 'INCOME_BONUS' ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-500' :
                                      isIncomeStyle ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500' :
                                      'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-500';

                      const textClass = isIncomeStyle ? 'text-emerald-600 dark:text-emerald-400' :
                                        isExpenseStyle ? 'text-rose-600 dark:text-rose-400' :
                                        'text-indigo-600 dark:text-indigo-400';

                      return (
                        <div key={tx.id} className="flex items-center gap-3 p-3 border-b border-gray-100 dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800 transition">
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${bgClass}`}>
                            {icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm text-gray-900 dark:text-white truncate">
                              {title}
                            </p>
                            <p className="text-xs text-gray-500">{tx.pocket}</p>
                          </div>
                          <p className={`font-medium text-sm flex-shrink-0 ${textClass}`}>
                            {sign}{formatCurrency(tx.amount)}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </>
        )}
      </main>

      {showAddModal && (
        <AddTransactionModal
          onClose={() => { setShowAddModal(false); setScanPrefill(null); }}
          onSuccess={() => {
            setShowAddModal(false);
            setScanPrefill(null);
            fetchTransactions();
            showInterstitial();
          }}
          prefill={scanPrefill || undefined}
        />
      )}

      {showIncomeRoutineModal && (
        <AddIncomeRoutineModal
          onClose={() => setShowIncomeRoutineModal(false)}
          onSuccess={() => {
            setShowIncomeRoutineModal(false);
            fetchTransactions();
            showInterstitial();
          }}
          paydayDate={paydayDate}
        />
      )}

      {showScanModal && (
        <ScanReceiptModal
          isOpen={showScanModal}
          onClose={() => setShowScanModal(false)}
          token={token}
          onResult={(data) => {
            setScanPrefill({
              amount: data.amount,
              date: data.date,
              notes: data.merchant,
              category: data.category,
            });
            setShowScanModal(false);
            setShowAddModal(true);
          }}
        />
      )}
    </div>
  );
}