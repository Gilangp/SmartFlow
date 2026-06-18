'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Lock, Crown, BarChart3, PieChart, TrendingUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart as RePieChart, Pie, Cell } from 'recharts';

export default function AnalyticsPage() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPremium, setIsPremium] = useState(false);

  const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

  const getToken = useCallback(() => localStorage.getItem('sf-token'), []);

  useEffect(() => {
    const init = async () => {
      const token = getToken();
      if (!token) { router.push('/login'); return; }

      try {
        const subRes = await fetch('/api/subscription', { headers: { Authorization: `Bearer ${token}` } });
        const subData = await subRes.json();
        
        if (subData.success && subData.data.plan === 'PREMIUM') {
          setIsPremium(true);
          const analyticsRes = await fetch('/api/analytics', { headers: { Authorization: `Bearer ${token}` } });
          const analyticsData = await analyticsRes.json();
          if (analyticsData.success) {
            setData(analyticsData.data);
          }
        } else {
          setIsPremium(false);
          // Dummy data for blurred preview
          setData({
            trend: [
              { month: 'Jan 2026', income: 4500000, expense: 3200000 },
              { month: 'Feb 2026', income: 4500000, expense: 3800000 },
              { month: 'Mar 2026', income: 4500000, expense: 2900000 },
              { month: 'Apr 2026', income: 5000000, expense: 3500000 },
              { month: 'May 2026', income: 4500000, expense: 4100000 },
              { month: 'Jun 2026', income: 4500000, expense: 2500000 },
            ],
            categories: [
              { name: 'Makan & Minum', value: 1500000 },
              { name: 'Transportasi', value: 500000 },
              { name: 'Hiburan', value: 800000 },
            ]
          });
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    init();
  }, [getToken, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const formatRupiah = (value: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-gray-950 pb-20">
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-gray-950/80 backdrop-blur-xl border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-5 py-4">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            Analisis Mendalam
          </h1>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-5 py-6 relative">
        {!isPremium && (
          <div className="absolute inset-0 z-10 bg-white/60 dark:bg-gray-950/60 backdrop-blur-md flex flex-col items-center justify-center px-4 rounded-xl mt-4">
            <div className="bg-white dark:bg-gray-900 p-8 rounded-2xl shadow-xl max-w-md w-full text-center border border-indigo-100 dark:border-indigo-900/30">
              <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center mx-auto mb-4">
                <Crown className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Fitur Premium</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                Buka wawasan keuanganmu dengan Analisis Mendalam. Pantau tren arus kas 6 bulan terakhir dan visualisasi porsi pengeluaranmu.
              </p>
              <Link href="/upgrade" className="inline-flex items-center justify-center gap-2 w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium transition shadow-lg shadow-indigo-600/20">
                <Lock className="w-4 h-4" /> Buka Akses Sekarang
              </Link>
            </div>
          </div>
        )}

        <div className={`space-y-6 ${!isPremium ? 'opacity-30 pointer-events-none select-none' : ''}`}>
          {/* Trend Chart */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-gray-200 dark:border-gray-800 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              Tren Arus Kas (6 Bulan)
            </h3>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.trend || []} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" opacity={0.2} />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} dy={10} />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 11, fill: '#6b7280' }}
                    tickFormatter={(value) => `Rp ${value / 1000000}M`}
                    width={60}
                  />
                  <Tooltip 
                    cursor={{ fill: 'rgba(99, 102, 241, 0.05)' }}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', backgroundColor: 'rgba(255, 255, 255, 0.95)', color: '#111827' }}
                    formatter={(value: number) => formatRupiah(value)}
                  />
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '12px' }} />
                  <Bar dataKey="income" name="Pemasukan" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  <Bar dataKey="expense" name="Pengeluaran" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Categories Chart */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-gray-200 dark:border-gray-800 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
              <PieChart className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              Porsi Pengeluaran Bulan Ini
            </h3>
            
            {(data?.categories?.length || 0) > 0 ? (
              <div className="flex flex-col md:flex-row items-center justify-center gap-8">
                <div className="h-64 w-64 flex-shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <RePieChart>
                      <Pie
                        data={data.categories}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {data.categories.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(value: number) => formatRupiah(value)}
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                      />
                    </RePieChart>
                  </ResponsiveContainer>
                </div>
                
                <div className="w-full max-w-sm space-y-3">
                  {data.categories.map((item: any, idx: number) => {
                    const total = data.categories.reduce((acc: number, curr: any) => acc + curr.value, 0);
                    const percentage = Math.round((item.value / total) * 100);
                    
                    return (
                      <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50">
                        <div className="flex items-center gap-3">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">{item.name}</p>
                            <p className="text-xs text-gray-500">{percentage}% dari total</p>
                          </div>
                        </div>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">
                          {formatRupiah(item.value)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="h-40 flex items-center justify-center text-sm text-gray-500">
                Belum ada pengeluaran bulan ini.
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
