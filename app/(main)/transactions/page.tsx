// app/transactions/page.tsx
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import AddExpenseModal from '@/components/AddExpenseModal';
import AddIncomeModal from '@/components/AddIncomeModal';
import ScanReceiptModal from '@/components/ScanReceiptModal';
import TransactionDetailModal from '@/components/TransactionDetailModal';
import CalendarRangePicker from '@/components/CalendarRangePicker';
import { showInterstitial } from '@/lib/admob';
import { TransactionRecord } from '@/types';
import { ScanLine, Lock, Download, TrendingDown, TrendingUp, HelpCircle, Calendar, Filter, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';

import AnalyticsView from '@/components/AnalyticsView';

function formatCurrency(amount: number): string {
  if (isNaN(amount) || amount === null || amount === undefined) return 'Rp 0';
  const hasFraction = amount % 1 !== 0;
  return `Rp ${amount.toLocaleString('id-ID', {
    minimumFractionDigits: 0,
    maximumFractionDigits: hasFraction ? 2 : 0,
  })}`;
}

export default function TransactionsPage() {
  const router = useRouter();
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [addModalType, setAddModalType] = useState<'EXPENSE' | 'INCOME_ROUTINE' | null>(null);
  const [showScanModal, setShowScanModal] = useState(false);
  const [scanPrefill, setScanPrefill] = useState<{ amount?: number; date?: string; notes?: string; category?: string } | null>(null);
  const [paydayDate, setPaydayDate] = useState<number | null>(null);
  const [filter, setFilter] = useState<'ALL' | 'EXPENSE' | 'INCOME_ROUTINE' | 'INCOME_BONUS'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [token, setToken] = useState('');
  const [canScanReceipt, setCanScanReceipt] = useState(false);
  const [canExportExcel, setCanExportExcel] = useState(false);
  const [checkingSub, setCheckingSub] = useState(true);
  const [viewMode, setViewMode] = useState<'list' | 'analytics'>('list');
  const [selectedTx, setSelectedTx] = useState<TransactionRecord | null>(null);

  // Real M-Banking Period Filter States
  const [periodPreset, setPeriodPreset] = useState<'TODAY' | 'LAST_7_DAYS' | 'THIS_MONTH' | 'BY_MONTH' | 'DATE_RANGE' | 'ALL'>('THIS_MONTH');
  const [selectedMonth, setSelectedMonth] = useState<string>(''); // e.g. '2026-08'
  const [startDate, setStartDate] = useState<string>(''); // YYYY-MM-DD
  const [endDate, setEndDate] = useState<string>(''); // YYYY-MM-DD

  // Derive unique months available in transactions
  const availableMonths = useMemo(() => {
    const monthsSet = new Set<string>();
    const nowStr = new Date().toISOString().slice(0, 7);
    monthsSet.add(nowStr);
    transactions.forEach((tx) => {
      if (tx.date && tx.date.length >= 7) {
        monthsSet.add(tx.date.slice(0, 7));
      }
    });
    return Array.from(monthsSet).sort((a, b) => b.localeCompare(a));
  }, [transactions]);

  useEffect(() => {
    if (availableMonths.length > 0 && !selectedMonth) {
      setSelectedMonth(availableMonths[0]);
    }
  }, [availableMonths, selectedMonth]);

  const runTransactionsTour = useCallback(() => {
    setViewMode('list');
    setTimeout(() => {
      const driverObj = driver({
        showProgress: true,
        nextBtnText: 'Lanjut',
        prevBtnText: 'Kembali',
        doneBtnText: 'Selesai',
        steps: [
          {
            popover: {
              title: 'Kelola Transaksi & Analitik',
              description: 'Di halaman ini, kamu bisa memantau semua riwayat transaksi, melakukan pencatatan cepat, serta melihat laporan keuangan terperinci.',
              side: 'bottom' as const,
              align: 'start' as const
            }
          },
          {
            element: '#tour-tx-tabs',
            popover: {
              title: 'Dua Mode Tampilan',
              description: 'Gunakan tab "Daftar" untuk melihat & mencatat pengeluaran, dan tab "Analitik" untuk melihat grafik visual serta audit AI.',
              side: 'bottom' as const,
              align: 'start' as const
            }
          },
          ...(document.querySelector('#tour-tx-add-expense') ? [{
            element: '#tour-tx-add-expense',
            popover: {
              title: 'Catat Pengeluaran Cepat',
              description: 'Catat belanjaan harianmu di sini secara instan. Saldo akan otomatis memotong Dompet Utama.',
              side: 'bottom' as const,
              align: 'start' as const
            }
          }] : []),
          ...(document.querySelector('#tour-tx-scan-receipt') ? [{
            element: '#tour-tx-scan-receipt',
            popover: {
              title: 'Scan Struk AI',
              description: 'Malas ngetik nominal dan tanggal? Foto struk atau nota belanjamu, AI kami akan otomatis memprosesnya untukmu!',
              side: 'bottom' as const,
              align: 'start' as const
            }
          }] : []),
          ...(document.querySelector('#tour-tx-search') ? [{
            element: '#tour-tx-search',
            popover: {
              title: 'Pencarian & Filter Transaksi',
              description: 'Gunakan kolom pencarian ini untuk mencari transaksi lama berdasarkan kategori, nama kantong, atau catatan.',
              side: 'bottom' as const,
              align: 'start' as const
            }
          }] : []),
          ...(document.querySelector('#tour-tx-export') ? [{
            element: '#tour-tx-export',
            popover: {
              title: 'Ekspor Data',
              description: 'Download semua laporan riwayat transaksi keuanganmu ke dalam format file CSV/Excel secara instan.',
              side: 'bottom' as const,
              align: 'start' as const
            }
          }] : [])
        ],
        onDestroyed: () => {
          localStorage.setItem('sf-tour-transactions-completed', 'true');
        }
      });
      driverObj.drive();
    }, 150);
  }, []);

  useEffect(() => {
    if (!isLoading) {
      const tourCompleted = localStorage.getItem('sf-tour-transactions-completed');
      if (!tourCompleted) {
        const timer = setTimeout(() => {
          runTransactionsTour();
        }, 1500);
        return () => clearTimeout(timer);
      }
    }
  }, [isLoading, runTransactionsTour]);

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
        .catch(() => { })
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
        const res = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } });
        const profileData = await res.json();
        if (profileData.success && profileData.data.paydayDate) setPaydayDate(profileData.data.paydayDate);
      } catch { }
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
    // Type Filter
    if (filter !== 'ALL' && tx.type !== filter) return false;

    // Search Query Filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const match = (tx.category?.toLowerCase().includes(q) || tx.pocket.toLowerCase().includes(q) || tx.notes?.toLowerCase().includes(q));
      if (!match) return false;
    }

    // Real M-Banking Period Filter
    const txDateStr = tx.date; // YYYY-MM-DD
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const currentMonthStr = today.toISOString().slice(0, 7);

    if (periodPreset === 'TODAY') {
      if (txDateStr !== todayStr) return false;
    } else if (periodPreset === 'LAST_7_DAYS') {
      const txTime = new Date(txDateStr).getTime();
      const sevenDaysAgo = today.getTime() - 7 * 24 * 60 * 60 * 1000;
      if (txTime < sevenDaysAgo || txTime > today.getTime() + 86400000) return false;
    } else if (periodPreset === 'THIS_MONTH') {
      if (!txDateStr.startsWith(currentMonthStr)) return false;
    } else if (periodPreset === 'BY_MONTH') {
      if (selectedMonth && !txDateStr.startsWith(selectedMonth)) return false;
    } else if (periodPreset === 'DATE_RANGE') {
      if (startDate && txDateStr < startDate) return false;
      if (endDate && txDateStr > endDate) return false;
    }

    return true;
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
            <div id="tour-tx-tabs" className="bg-gray-100 dark:bg-gray-800 p-1 rounded-xl inline-flex">
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
            <div className="flex items-center gap-2">
              <button
                id="tour-tx-export"
                onClick={handleExport}
                disabled={checkingSub}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${canExportExcel
                  ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 dark:hover:bg-emerald-900/50'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400'
                  }`}
              >
                {!canExportExcel && !checkingSub ? <Lock className="w-3.5 h-3.5" /> : <Download className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">Export CSV</span>
              </button>
              <button
                onClick={runTransactionsTour}
                className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition active:scale-95"
                title="Panduan Pengguna"
                aria-label="Tampilkan Panduan"
              >
                <HelpCircle className="w-4.5 h-4.5" />
              </button>
            </div>
          </div>
          {viewMode === 'list' && (
            <div className="relative">
              <input
                id="tour-tx-search"
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
        {/* View Mode Content */}
        {viewMode === 'analytics' ? (
          <AnalyticsView
            transactions={transactions}
            canUseAnalytics={canExportExcel} // we use canExportExcel as proxy for Premium plan limit
            checkingSub={checkingSub}
          />
        ) : (
          <>
            {/* Summary Cards & Integrated Action Buttons */}
            <div className="grid grid-cols-2 gap-3 mb-5">
              {/* Card Pemasukan */}
              <div className="bg-white dark:bg-gray-900 rounded-xl p-3.5 border border-gray-200 dark:border-gray-800 flex flex-col justify-between min-w-0 shadow-sm">
                <div>
                  <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1">Pemasukan</p>
                  <p className="text-base sm:text-lg font-bold text-emerald-600 dark:text-emerald-400 truncate">{formatCurrency(totalIncome)}</p>
                </div>
                <button
                  onClick={() => setAddModalType('INCOME_ROUTINE')}
                  className="mt-3 py-1.5 px-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-lg text-xs font-semibold transition active:scale-[0.98] flex items-center justify-center gap-1"
                >
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                  + Pemasukan
                </button>
              </div>

              {/* Card Pengeluaran */}
              <div className="bg-white dark:bg-gray-900 rounded-xl p-3.5 border border-gray-200 dark:border-gray-800 flex flex-col justify-between min-w-0 shadow-sm">
                <div>
                  <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1">Pengeluaran</p>
                  <p className="text-base sm:text-lg font-bold text-rose-600 dark:text-rose-400 truncate">{formatCurrency(totalExpense)}</p>
                </div>
                <button
                  id="tour-tx-add-expense"
                  onClick={() => setAddModalType('EXPENSE')}
                  className="mt-3 py-1.5 px-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition shadow-sm active:scale-[0.98] flex items-center justify-center gap-1"
                >
                  <TrendingDown className="w-3.5 h-3.5" />
                  + Pengeluaran
                </button>
              </div>
            </div>

            {/* Unified Transaction Filter Card (Periode & Tipe Transaksi) */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl p-4 border border-gray-200 dark:border-gray-800 shadow-sm mb-5">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-y-4 lg:gap-y-0 divide-y lg:divide-y-0 lg:divide-x divide-gray-100 dark:divide-gray-800/80 items-start">
                {/* Section 1: Periode Transaksi */}
                <div className="lg:pr-6">
                  <div className="flex items-center gap-2 mb-2.5">
                    <Calendar className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Periode Transaksi</span>
                  </div>

                  {/* Periode Preset Chips */}
                  <div className="flex gap-2 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] flex-nowrap">
                    {[
                      { id: 'TODAY', label: 'Hari Ini' },
                      { id: 'LAST_7_DAYS', label: '7 Hari Terakhir' },
                      { id: 'BY_MONTH', label: 'Pilih Bulan' },
                      { id: 'DATE_RANGE', label: 'Pilih Tanggal' },
                    ].map((chip) => {
                      const isActive = periodPreset === chip.id;
                      return (
                        <button
                          key={chip.id}
                          onClick={() => setPeriodPreset(chip.id as any)}
                          className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all flex-shrink-0 whitespace-nowrap ${isActive
                            ? 'bg-indigo-600 text-white shadow-sm font-semibold'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                            }`}
                        >
                          {chip.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Sub-Filters (Only expands when user explicitly clicks 'Pilih Bulan') */}
                  {periodPreset === 'BY_MONTH' && (
                    <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800/80">
                      <div className="bg-gray-50/80 dark:bg-gray-800/50 p-3.5 rounded-xl border border-gray-200/60 dark:border-gray-700/60 flex items-center justify-between gap-3">
                        <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                          Bulan Terpilih:
                        </span>
                        <div className="relative flex-1 max-w-[220px]">
                          <select
                            value={selectedMonth}
                            onChange={(e) => {
                              setSelectedMonth(e.target.value);
                              setPeriodPreset('BY_MONTH');
                            }}
                            className="w-full appearance-none bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-xs font-semibold rounded-lg pl-3 pr-8 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 shadow-sm cursor-pointer"
                          >
                            {availableMonths.map((m: string) => {
                              const [year, month] = m.split('-');
                              const d = new Date(parseInt(year), parseInt(month) - 1, 1);
                              const monthName = d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
                              return (
                                <option key={m} value={m}>
                                  {monthName}
                                </option>
                              );
                            })}
                          </select>
                          <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Custom Popover Floating Calendar Range Picker */}
                  {periodPreset === 'DATE_RANGE' && (
                    <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800/80">
                      <CalendarRangePicker
                        startDate={startDate}
                        endDate={endDate}
                        onRangeSelect={(start, end) => {
                          setStartDate(start);
                          setEndDate(end);
                        }}
                      />
                    </div>
                  )}
                </div>

                {/* Section 2: Tipe Transaksi */}
                <div className="pt-4 lg:pt-0 lg:pl-6">
                  <div className="flex items-center gap-2 mb-2.5">
                    <Filter className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Tipe Transaksi</span>
                  </div>

                  {/* Tipe Transaksi Chips */}
                  <div className="flex gap-2 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] flex-nowrap">
                    {[
                      { value: 'ALL', label: 'Semua' },
                      { value: 'EXPENSE', label: 'Pengeluaran' },
                      { value: 'INCOME_ROUTINE', label: 'Gaji / Rutin' },
                      { value: 'INCOME_BONUS', label: 'Bonus' },
                    ].map((f) => (
                      <button
                        key={f.value}
                        onClick={() => setFilter(f.value as any)}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all flex-shrink-0 whitespace-nowrap ${filter === f.value
                          ? 'bg-indigo-600 text-white shadow-sm font-semibold'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                          }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

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
                      const isTransferOut = tx.type === 'TRANSFER' && (tx.notes?.toLowerCase().includes('transfer to') || tx.notes?.toLowerCase().includes('transfer ke'));
                      const isTransferIn = tx.type === 'TRANSFER' && (tx.notes?.toLowerCase().includes('received from') || tx.notes?.toLowerCase().includes('transfer dari'));

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
                        <div
                          key={tx.id}
                          onClick={() => setSelectedTx(tx)}
                          className="flex items-center gap-3 p-3 border-b border-gray-100 dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800 transition cursor-pointer active:bg-gray-100 dark:active:bg-gray-700"
                        >
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${bgClass}`}>
                            {icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm text-gray-900 dark:text-white truncate">
                              {title}
                            </p>
                            <p className="text-xs text-gray-500">
                              {tx.pocket}
                              {tx.createdAt && (
                                <span className="text-gray-400"> • {new Date(tx.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
                              )}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <p className={`font-medium text-sm ${textClass}`}>
                              {sign}{formatCurrency(tx.amount)}
                            </p>
                            <span className="text-gray-300 dark:text-gray-600 text-xs ml-1">›</span>
                          </div>
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

      {addModalType === 'EXPENSE' && (
        <AddExpenseModal
          onClose={() => { setAddModalType(null); setScanPrefill(null); }}
          onSuccess={() => {
            setAddModalType(null);
            setScanPrefill(null);
            fetchTransactions();
            showInterstitial();
          }}
          prefill={scanPrefill || undefined}
        />
      )}

      {addModalType === 'INCOME_ROUTINE' && (
        <AddIncomeModal
          onClose={() => setAddModalType(null)}
          onSuccess={() => {
            setAddModalType(null);
            fetchTransactions();
            showInterstitial();
          }}
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
            setAddModalType('EXPENSE');
          }}
        />
      )}
      {selectedTx && (
        <TransactionDetailModal
          transaction={selectedTx}
          onClose={() => setSelectedTx(null)}
        />
      )}
    </div>
  );
}