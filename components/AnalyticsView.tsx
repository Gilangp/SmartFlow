'use client';

import { useState, useEffect, useMemo } from 'react';
import { TransactionRecord } from '@/types';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { Lock, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';

interface AnalyticsViewProps {
  transactions: TransactionRecord[];
  canUseAnalytics: boolean;
  checkingSub: boolean;
}

const COLORS = ['#6366f1', '#ec4899', '#14b8a6', '#f59e0b', '#8b5cf6', '#ef4444', '#f97316'];

function formatCurrency(amount: number): string {
  if (isNaN(amount) || amount === null || amount === undefined) return 'Rp 0';
  const hasFraction = amount % 1 !== 0;
  return `Rp ${amount.toLocaleString('id-ID', {
    minimumFractionDigits: 0,
    maximumFractionDigits: hasFraction ? 2 : 0,
  })}`;
}

function formatChartYAxis(val: number): string {
  if (!val || val === 0) return '0';
  const abs = Math.abs(val);
  if (abs >= 1_000_000) {
    const formatted = (val / 1_000_000).toLocaleString('id-ID', { maximumFractionDigits: 1 });
    return `${formatted}jt`;
  }
  if (abs >= 1_000) {
    const formatted = (val / 1_000).toLocaleString('id-ID', { maximumFractionDigits: 0 });
    return `${formatted}rb`;
  }
  return `${val}`;
}

export default function AnalyticsView({ transactions, canUseAnalytics, checkingSub }: AnalyticsViewProps) {
  const router = useRouter();
  const [trendData, setTrendData] = useState<any[]>([]);
  const [aiSummary, setAiSummary] = useState<string[] | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'));
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (canUseAnalytics) {
       const t = localStorage.getItem('sf-token');
       if (t) {
         fetch('/api/analytics', { headers: { Authorization: `Bearer ${t}` } })
           .then(r => r.json())
           .then(d => {
             if (d.success) {
                if (d.data?.trend) setTrendData(d.data.trend);
             }
           });

         setAiLoading(true);
         fetch('/api/ai/analytics-summary', { headers: { Authorization: `Bearer ${t}` } })
           .then(r => r.json())
           .then(d => {
             if (d.success && Array.isArray(d.data?.summary)) {
               setAiSummary(d.data.summary);
             }
           })
           .catch(() => {})
           .finally(() => setAiLoading(false));
       }
    }
  }, [canUseAnalytics]);

  const { 
    pieData, 
    barData, 
    highestCategory, 
    totalExpense, 
    totalIncomeAll, 
    netFlow, 
    topExpenses,
    pocketPieData,
    totalNeedExpense,
    totalWantExpense,
    needPercentage,
    wantPercentage
  } = useMemo(() => {
    // Basic Totals
    const totalIncomeAll = transactions.filter(t => t.type.startsWith('INCOME')).reduce((s,t) => s + t.amount, 0);
    const totalExpense = transactions.filter(t => t.type === 'EXPENSE').reduce((s,t) => s + t.amount, 0);
    const netFlow = totalIncomeAll - totalExpense;

    // Needs vs Wants calculation
    let totalNeedExpense = 0;
    let totalWantExpense = 0;
    transactions.filter(t => t.type === 'EXPENSE').forEach(t => {
      if (t.categoryType === 'WANT') {
        totalWantExpense += t.amount;
      } else {
        totalNeedExpense += t.amount;
      }
    });
    const totalExpenseSum = totalNeedExpense + totalWantExpense;
    const needPercentage = totalExpenseSum > 0 ? Math.round((totalNeedExpense / totalExpenseSum) * 100) : 0;
    const wantPercentage = totalExpenseSum > 0 ? Math.round((totalWantExpense / totalExpenseSum) * 100) : 0;

    // Top 5 Single Expenses
    const topExpenses = [...transactions]
      .filter(t => t.type === 'EXPENSE')
      .sort((a,b) => b.amount - a.amount)
      .slice(0, 5);

    // Pie Data (Expenses by Category)
    const expensesByCategory = transactions
      .filter(t => t.type === 'EXPENSE')
      .reduce((acc, t) => {
        const cat = t.category || 'Lainnya';
        acc[cat] = (acc[cat] || 0) + t.amount;
        return acc;
      }, {} as Record<string, number>);

    const pieData = Object.keys(expensesByCategory)
      .map(key => ({ name: key, value: expensesByCategory[key] }))
      .sort((a, b) => b.value - a.value);

    const highestCategory = pieData.length > 0 ? pieData[0].name : '-';

    // Pie Data (Expenses by Pocket)
    const expensesByPocket = transactions
      .filter(t => t.type === 'EXPENSE')
      .reduce((acc, t) => {
        const p = t.pocket || 'Lainnya';
        acc[p] = (acc[p] || 0) + t.amount;
        return acc;
      }, {} as Record<string, number>);

    const pocketPieData = Object.keys(expensesByPocket)
      .map(key => ({ name: key, value: expensesByPocket[key] }))
      .sort((a, b) => b.value - a.value);

    // Bar Data (Last 7 Days Trend)
    const last7Days = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toISOString().split('T')[0];
    }).reverse();

    const barData = last7Days.map(date => {
      const dayTxs = transactions.filter(t => t.date === date);
      const income = dayTxs.filter(t => t.type.startsWith('INCOME')).reduce((s, t) => s + t.amount, 0);
      const expense = dayTxs.filter(t => t.type === 'EXPENSE').reduce((s, t) => s + t.amount, 0);
      return {
        date: new Date(date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
        Pemasukan: income,
        Pengeluaran: expense,
        Net: income - expense
      };
    });

    return { pieData, barData, highestCategory, totalExpense, totalIncomeAll, netFlow, topExpenses, pocketPieData, totalNeedExpense, totalWantExpense, needPercentage, wantPercentage };
  }, [transactions]);

  if (checkingSub) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-xl p-10 text-center border border-gray-200 dark:border-gray-800 animate-pulse">
        <div className="h-4 w-32 bg-gray-200 dark:bg-gray-800 rounded mx-auto mb-3"></div>
        <div className="h-3 w-48 bg-gray-100 dark:bg-gray-800 rounded mx-auto"></div>
      </div>
    );
  }

  if (!canUseAnalytics) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-xl p-8 text-center border border-dashed border-indigo-200 dark:border-indigo-900 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-white/50 dark:to-gray-900/50 backdrop-blur-[2px]"></div>
        <div className="relative z-10 flex flex-col items-center">
          <div className="w-12 h-12 rounded-full bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-500 mb-4">
            <Lock className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Analitik Eksklusif</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-5 max-w-sm">
            Lihat kemana saja uangmu pergi dengan grafik visual yang interaktif. Khusus untuk pengguna Premium.
          </p>
          <button 
            onClick={() => router.push('/upgrade')}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition shadow-md shadow-indigo-600/20 active:scale-[0.98]"
          >
            Upgrade ke Premium
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Premium Dashboard Metrics - Always 3 Columns Horizontal */}
      <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
        <div className="bg-white dark:bg-gray-900 rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-gray-100 dark:border-gray-800 shadow-sm relative overflow-hidden flex flex-col justify-between min-w-0">
          <div className="absolute top-0 right-0 w-12 h-12 bg-emerald-500/10 rounded-full -mr-6 -mt-6 pointer-events-none"></div>
          <p className="text-[11px] sm:text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 truncate">Total Pemasukan</p>
          <p className="text-xs sm:text-base md:text-lg font-extrabold text-emerald-600 dark:text-emerald-400 truncate tracking-tight">{formatCurrency(totalIncomeAll)}</p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-gray-100 dark:border-gray-800 shadow-sm relative overflow-hidden flex flex-col justify-between min-w-0">
          <div className="absolute top-0 right-0 w-12 h-12 bg-rose-500/10 rounded-full -mr-6 -mt-6 pointer-events-none"></div>
          <p className="text-[11px] sm:text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 truncate">Total Pengeluaran</p>
          <p className="text-xs sm:text-base md:text-lg font-extrabold text-rose-600 dark:text-rose-400 truncate tracking-tight">{formatCurrency(totalExpense)}</p>
        </div>
        <div className={`bg-gradient-to-br ${netFlow >= 0 ? 'from-emerald-50 to-teal-100 dark:from-emerald-950/40 dark:to-teal-950/20 border-emerald-200 dark:border-emerald-800/80' : 'from-rose-50 to-orange-100 dark:from-rose-950/40 dark:to-orange-950/20 border-rose-200 dark:border-rose-800/80'} rounded-xl sm:rounded-2xl p-3 sm:p-4 border shadow-sm relative overflow-hidden flex flex-col justify-between min-w-0`}>
          <p className={`text-[11px] sm:text-xs font-medium mb-1 truncate ${netFlow >= 0 ? 'text-emerald-800 dark:text-emerald-300' : 'text-rose-800 dark:text-rose-300'}`}>
            Arus Kas (Net)
          </p>
          <p className={`text-xs sm:text-base md:text-lg font-extrabold truncate tracking-tight ${netFlow >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
            {formatCurrency(netFlow)}
          </p>
        </div>
      </div>

      {/* AI Deep Insight */}
      <div className="bg-indigo-50 dark:bg-indigo-500/10 rounded-2xl p-5 border border-indigo-100 dark:border-indigo-500/20 shadow-sm relative overflow-hidden">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white shadow-sm">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <h3 className="font-semibold text-indigo-900 dark:text-indigo-300">Executive Summary</h3>
          </div>
          {aiLoading && (
            <span className="flex items-center gap-1.5 text-xs bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-300 px-2.5 py-1 rounded-full animate-pulse font-medium">
              <Sparkles className="w-3.5 h-3.5 animate-spin" /> Sedang menganalisis data...
            </span>
          )}
        </div>
        <ul className="space-y-2.5">
          {aiLoading ? (
            <div className="py-2 space-y-3">
              <div className="h-4 bg-indigo-150 dark:bg-indigo-500/20 rounded w-11/12 animate-pulse"></div>
              <div className="h-4 bg-indigo-150 dark:bg-indigo-500/20 rounded w-10/12 animate-pulse"></div>
              <div className="h-4 bg-indigo-150 dark:bg-indigo-500/20 rounded w-8/12 animate-pulse"></div>
            </div>
          ) : aiSummary ? (
            aiSummary.map((point, idx) => (
              <li key={idx} className="flex gap-2 items-start text-sm text-gray-700 dark:text-gray-300 leading-relaxed animate-fadeIn">
                <span className="text-indigo-500 mt-0.5 font-bold">•</span>
                <ReactMarkdown
                  components={{
                    p: ({ children }) => <span>{children}</span>,
                    strong: ({ children }) => <strong className="font-bold text-indigo-950 dark:text-indigo-100">{children}</strong>,
                  }}
                >
                  {point}
                </ReactMarkdown>
              </li>
            ))
          ) : (
            <>
              <li className="flex gap-2 items-start text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                <span className="text-indigo-500 mt-0.5 font-bold">•</span>
                <span>
                  {netFlow >= 0 ? (
                    <>
                      Kondisi keuanganmu <strong className="text-emerald-600 dark:text-emerald-400 font-bold">cukup sehat</strong> dengan sisa uang masuk bersih sebesar <strong className="text-emerald-600 dark:text-emerald-400 font-bold">{formatCurrency(netFlow)}</strong> bulan ini. Pemasukanmu mencatatkan <strong className="text-gray-900 dark:text-white font-bold">{formatCurrency(totalIncomeAll)}</strong> vs pengeluaran <strong className="text-gray-900 dark:text-white font-bold">{formatCurrency(totalExpense)}</strong>. <strong className="text-indigo-900 dark:text-indigo-200">Strategi:</strong> Segera sisihkan sebagian sisa arus kas ini minimal 10-20% ke dana darurat atau tabungan aset agar masa bertahan keuanganmu jauh lebih panjang.
                    </>
                  ) : (
                    <>
                      Kondisi keuanganmu mengalami <strong className="text-rose-600 dark:text-rose-400 font-bold">peringatan defisit</strong> sebesar <strong className="text-rose-600 dark:text-rose-400 font-bold">{formatCurrency(Math.abs(netFlow))}</strong> karena pengeluaran ({formatCurrency(totalExpense)}) melampaui pemasukan ({formatCurrency(totalIncomeAll)}). <strong className="text-rose-700 dark:text-rose-300">Opsi Pengaturan:</strong> Lakukan rem darurat pada pos belanja non-pokok dan fokuskan sisa saldo yang ada hanya untuk kebutuhan harian mendesak.
                    </>
                  )}
                </span>
              </li>
              <li className="flex gap-2 items-start text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                <span className="text-indigo-500 mt-0.5 font-bold">•</span>
                <span>
                  Pengeluaranmu saat ini didominasi <strong className="text-indigo-600 dark:text-indigo-400 font-bold">Kebutuhan pokok sebesar {needPercentage}%</strong> ({formatCurrency(totalNeedExpense)}), sementara <strong className="text-rose-500 font-bold">Keinginan atau jajan sebesar {wantPercentage}%</strong> ({formatCurrency(totalWantExpense)}). {wantPercentage > 30 ? <>Meski sudah ada pos kebutuhan, porsi jajanmu melebihi ambang 30%. <strong className="text-indigo-900 dark:text-indigo-200">Cara Mengatur:</strong> Turunkan anggaran jajan harian atau pesan makanan dari {formatCurrency(totalWantExpense)} menjadi maksimal {formatCurrency(totalExpense * 0.2)} bulan depan agar keuangan lebih stabil.</> : <>Kamu sudah sangat disiplin menjaga porsi jajan berada di bawah batas aman 30%. <strong className="text-emerald-700 dark:text-emerald-300">Saran:</strong> Pertahankan pola ini agar alokasi tabunganmu dapat bertambah konsisten.</>}
                </span>
              </li>
              {highestCategory !== '-' && pieData.length > 0 && (
                <li className="flex gap-2 items-start text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                  <span className="text-indigo-500 mt-0.5 font-bold">•</span>
                  <span>
                    Kategori pengeluaran paling boros tercatat pada <strong className="text-indigo-600 dark:text-indigo-400 bg-indigo-100/60 dark:bg-indigo-900/40 px-1.5 py-0.5 rounded font-medium">{highestCategory}</strong> senilai <strong className="text-gray-900 dark:text-white font-bold">{formatCurrency(pieData[0].value)}</strong>{topExpenses.length > 0 ? <>, dengan transaksi terbesar tunggal untuk <strong className="text-rose-600 dark:text-rose-400 font-bold">{topExpenses[0].notes || topExpenses[0].category} ({formatCurrency(topExpenses[0].amount)})</strong></> : ''}. <strong className="text-indigo-900 dark:text-indigo-200">Masukan & Strategi:</strong> Evaluasi item pengeluaran di kategori {highestCategory} dan buat batas maksimal belanja harian untuk kategori tersebut.
                  </span>
                </li>
              )}
              <li className="flex gap-2 items-start text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                <span className="text-indigo-500 mt-0.5 font-bold">•</span>
                <span>
                  Saat ini uangmu tersebar di <strong className="text-indigo-600 dark:text-indigo-400 font-bold">{pocketPieData.length > 0 ? pocketPieData.length : 'beberapa'} kantong keuangan</strong>. <strong className="text-indigo-900 dark:text-indigo-200">Rekomendasi Aksional:</strong> Pindahkan sebagian saldo mengendap di Dompet Utama secara berkala ke kantong Tabungan atau Kantong Impian khusus agar target saldo aman dan ketahanan finansialmu makin kokoh.
                </span>
              </li>
            </>
          )}
        </ul>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie Chart: Categories */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Pengeluaran per Kategori</h3>
          <p className="text-xs text-gray-500 mb-4">Melihat kemana saja uangmu pergi</p>
          
          <div className="h-64">
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                    stroke="none"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: any) => formatCurrency(value)}
                    contentStyle={{ 
                      borderRadius: '12px', 
                      border: isDark ? '1px solid #374151' : '1px solid #e5e7eb', 
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', 
                      backgroundColor: isDark ? '#1f2937' : '#ffffff' 
                    }}
                    itemStyle={{ color: isDark ? '#f3f4f6' : '#1f2937' }}
                  />
                  <Legend 
                    layout="vertical" 
                    verticalAlign="middle" 
                    align="right"
                    wrapperStyle={{ fontSize: '12px' }}
                    iconType="circle"
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400 text-sm">Belum ada data pengeluaran</div>
            )}
          </div>
        </div>

        {/* Bar Chart: Last 7 Days */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Arus Kas 7 Hari Terakhir</h3>
          
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 10, right: 10, left: -5, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#4b5563' : '#374151'} opacity={0.15} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: isDark ? '#9ca3af' : '#6b7280' }} axisLine={false} tickLine={false} dy={10} />
                <YAxis width={45} tickFormatter={formatChartYAxis} tick={{ fontSize: 10, fill: isDark ? '#9ca3af' : '#6b7280' }} axisLine={false} tickLine={false} />
                <Tooltip 
                  formatter={(value: any) => formatCurrency(value)}
                  cursor={{ fill: isDark ? '#374151' : '#f3f4f6', opacity: 0.1 }}
                  contentStyle={{ 
                    borderRadius: '12px', 
                    border: isDark ? '1px solid #374151' : '1px solid #e5e7eb', 
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', 
                    backgroundColor: isDark ? '#1f2937' : '#ffffff' 
                  }}
                  itemStyle={{ color: isDark ? '#f3f4f6' : '#1f2937' }}
                />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} iconType="circle" />
                <Bar dataKey="Pemasukan" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={30} />
                <Bar dataKey="Pengeluaran" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={30} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Rasio Kebutuhan vs Keinginan */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Rasio Kebutuhan vs Keinginan</h3>
            <p className="text-xs text-gray-500 mb-4">Menganalisis jenis pengeluaran berdasarkan prinsip 50/30/20</p>
          </div>
          
          <div className="space-y-4 my-auto">
            <div className="flex justify-between text-xs font-medium">
              <span className="text-indigo-600 dark:text-indigo-400">Kebutuhan (Esensial)</span>
              <span className="text-rose-500">Keinginan (Konsumtif)</span>
            </div>
            
            <div className="h-4 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden flex">
              <div 
                className="h-full bg-indigo-500 transition-all duration-500" 
                style={{ width: `${totalExpense > 0 ? needPercentage : 50}%` }}
                title={`Kebutuhan: ${needPercentage}%`}
              />
              <div 
                className="h-full bg-rose-500 transition-all duration-500" 
                style={{ width: `${totalExpense > 0 ? wantPercentage : 50}%` }}
                title={`Keinginan: ${wantPercentage}%`}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="bg-indigo-50/50 dark:bg-indigo-500/5 p-3 rounded-xl border border-indigo-100/50 dark:border-indigo-500/10">
                <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase font-bold">Total Kebutuhan</p>
                <p className="text-base font-bold text-indigo-600 dark:text-indigo-400">{formatCurrency(totalNeedExpense)}</p>
                <p className="text-[11px] text-gray-500 mt-0.5">{needPercentage}% dari pengeluaran</p>
              </div>
              <div className="bg-rose-50/50 dark:bg-rose-500/5 p-3 rounded-xl border border-rose-100/50 dark:border-rose-500/10">
                <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase font-bold">Total Keinginan</p>
                <p className="text-base font-bold text-rose-600 dark:text-rose-400">{formatCurrency(totalWantExpense)}</p>
                <p className="text-[11px] text-gray-500 mt-0.5">{wantPercentage}% dari pengeluaran</p>
              </div>
            </div>
          </div>
        </div>

        {/* Pie Chart: Pockets */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Pengeluaran per Kantong</h3>
          <p className="text-xs text-gray-500 mb-4">Melihat dari kantong mana uangmu keluar</p>
          
          <div className="h-64">
            {pocketPieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pocketPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                    stroke="none"
                  >
                    {pocketPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[(index + 3) % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: any) => formatCurrency(value)}
                    contentStyle={{ 
                      borderRadius: '12px', 
                      border: isDark ? '1px solid #374151' : '1px solid #e5e7eb', 
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', 
                      backgroundColor: isDark ? '#1f2937' : '#ffffff' 
                    }}
                    itemStyle={{ color: isDark ? '#f3f4f6' : '#1f2937' }}
                  />
                  <Legend 
                    layout="vertical" 
                    verticalAlign="middle" 
                    align="right"
                    wrapperStyle={{ fontSize: '12px' }}
                    iconType="circle"
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400 text-sm">Belum ada data pengeluaran</div>
            )}
          </div>
        </div>

        {/* Bar Chart: Last 6 Months (API) */}
        {trendData.length > 0 && (
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm lg:col-span-2">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Tren Arus Kas (6 Bulan Terakhir)</h3>
            
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trendData} margin={{ top: 10, right: 10, left: -5, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#4b5563' : '#374151'} opacity={0.15} />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: isDark ? '#9ca3af' : '#6b7280' }} dy={10} />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 11, fill: isDark ? '#9ca3af' : '#6b7280' }}
                    tickFormatter={formatChartYAxis}
                    width={45}
                  />
                  <Tooltip 
                    cursor={{ fill: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(99, 102, 241, 0.05)' }}
                    contentStyle={{ 
                      borderRadius: '12px', 
                      border: isDark ? '1px solid #374151' : '1px solid #e5e7eb', 
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', 
                      backgroundColor: isDark ? '#1f2937' : '#ffffff',
                      color: isDark ? '#f3f4f6' : '#111827'
                    }}
                    formatter={(value: any) => formatCurrency(Number(value))}
                  />
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '12px' }} />
                  <Bar dataKey="income" name="Pemasukan" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  <Bar dataKey="expense" name="Pengeluaran" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Top 5 Expenses List */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm lg:col-span-2">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">5 Pengeluaran Terbesar</h3>
          {topExpenses.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {topExpenses.map((tx, idx) => (
                <div key={tx.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50">
                  <div className="w-8 h-8 rounded-full bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center font-bold text-xs flex-shrink-0">
                    #{idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{tx.notes || tx.category || 'Pengeluaran'}</p>
                    <p className="text-xs text-gray-500">{new Date(tx.date).toLocaleDateString('id-ID')} • {tx.pocket}</p>
                  </div>
                  <p className="text-sm font-bold text-rose-600 dark:text-rose-400 flex-shrink-0">
                    -{formatCurrency(tx.amount)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-gray-400 text-sm text-center py-4">Belum ada data pengeluaran</div>
          )}
        </div>
      </div>
    </div>
  );
}
