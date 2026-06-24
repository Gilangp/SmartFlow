'use client';

import { useState, useEffect } from 'react';
import { Check, GraduationCap, Zap, Crown, ArrowLeft, Shield, Loader2, Sparkles } from 'lucide-react';
import Link from 'next/link';
import KtmVerifyModal from '@/components/KtmVerifyModal';
import toast from 'react-hot-toast';


interface SubscriptionData {
  plan: 'TRIAL' | 'STUDENT' | 'PREMIUM';
  status: string;
  isActive: boolean;
  isExpired: boolean;
  daysLeft: number | null;
}

export default function UpgradePage() {
  const [sub, setSub] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [ktmOpen, setKtmOpen] = useState(false);
  const [userName, setUserName] = useState('');
  const [token, setToken] = useState('');

  useEffect(() => {
    const t = localStorage.getItem('sf-token') || '';
    let uname = '';
    try {
      const userStr = localStorage.getItem('sf-user');
      if (userStr) {
        const userObj = JSON.parse(userStr);
        uname = userObj.name || '';
      }
    } catch {
      // ignore JSON parse error
    }
    
    setToken(t);
    setUserName(uname);
    fetchSubscription(t);
  }, []);

  const fetchSubscription = async (t: string) => {
    try {
      const res = await fetch('/api/subscription', {
        headers: { Authorization: `Bearer ${t}` },
      });
      const data = await res.json();
      if (data.success) setSub(data.data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const handleKtmSuccess = () => {
    toast.success('Selamat! Kamu sekarang punya Student Plan gratis!');
    fetchSubscription(token);
  };


  const packages = [
    {
      id: 'TRIAL',
      name: 'Trial',
      icon: <Zap className="w-5 h-5" />,
      price: 'Gratis',
      period: '14 hari',
      color: 'gray',
      description: 'Coba semua fitur tanpa perlu verifikasi',
      features: [
        { text: 'Semua fitur lengkap' },
        { text: 'AI Smart Input' },
        { text: '4 Kantong keuangan' },
        { text: 'Maksimal 50 transaksi/bulan' },
      ],
      cta: 'Paket Saat Ini',
      ctaAction: null,
      popular: false,
    },
    {
      id: 'STUDENT',
      name: 'Student',
      icon: <GraduationCap className="w-5 h-5" />,
      price: 'Rp 0',
      period: 'selamanya',
      color: 'emerald',
      description: 'Untuk mahasiswa Indonesia terverifikasi',
      features: [
        { text: 'Semua fitur Trial' },
        { text: 'Scan Struk / Kwitansi', isNew: true },
        { text: 'Kantong tanpa batas' },
        { text: 'Maksimal 200 transaksi/bulan' },
        { text: 'Verifikasi KTM / email .ac.id' },
      ],
      cta: 'Verifikasi KTM',
      ctaAction: 'ktm',
      popular: true,
    },
    {
      id: 'PREMIUM',
      name: 'Premium',
      icon: <Crown className="w-5 h-5" />,
      price: 'Rp 49.000',
      period: 'bulan',
      color: 'indigo',
      description: 'Untuk profesional muda tanpa batas',
      features: [
        { text: 'Semua fitur Student' },
        { text: 'Transaksi tanpa batas' },
        { text: 'Ekspor data ke Excel' },
        { text: 'Dashboard Analitik Mendalam' },
        { text: 'Dukungan prioritas 24/7' },
      ],
      cta: 'Segera Hadir',
      ctaAction: 'premium',
      popular: false,
    },
  ];


  const colorMap = {
    gray: {
      badge: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400',
      border: 'border-gray-200 dark:border-gray-800',
      icon: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400',
      btn: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 cursor-default',
      check: 'text-gray-500 dark:text-gray-400',
    },
    emerald: {
      badge: 'bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400',
      border: 'border-emerald-400 dark:border-emerald-500/50 shadow-lg shadow-emerald-500/10',
      icon: 'bg-emerald-100 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400',
      btn: 'bg-emerald-600 hover:bg-emerald-700 text-white',
      check: 'text-emerald-500',
    },
    indigo: {
      badge: 'bg-indigo-100 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-400',
      border: 'border-indigo-200 dark:border-indigo-800',
      icon: 'bg-indigo-100 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400',
      btn: 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed',
      check: 'text-indigo-500',
    },
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-16">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 sticky top-0 z-10 pt-safe">
        <div className="max-w-7xl mx-auto px-5 py-4 flex items-center gap-3">
          <Link href="/dashboard" className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 transition">
            <ArrowLeft className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          </Link>
          <div>
            <h1 className="font-bold text-gray-900 dark:text-white">Pilih Paket</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Paket aktif: <span className="font-semibold text-indigo-600 dark:text-indigo-400">{sub?.plan || 'TRIAL'}</span>
              {sub?.daysLeft !== null && sub?.daysLeft !== undefined && sub?.plan === 'TRIAL' && (
                <span className="ml-1 text-amber-600 dark:text-amber-400">({sub.daysLeft} hari tersisa)</span>
              )}
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-5 pt-8 space-y-8">
        <div className="text-center mb-8">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-2">Upgrade Pengalaman Finansialmu</h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm md:text-base max-w-xl mx-auto">
            Dapatkan kontrol penuh atas keuanganmu dengan fitur premium yang dirancang khusus untuk mahasiswa dan profesional muda.
          </p>
        </div>
        {/* Banner Trial expired */}
        {sub?.isExpired && (
          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-4 flex items-start gap-3 max-w-2xl mx-auto">
            <Shield className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-800 dark:text-amber-300 text-sm">Trial kamu sudah habis</p>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                Verifikasi KTM untuk Student Plan gratis, atau upgrade ke Premium.
              </p>
            </div>
          </div>
        )}

        {/* Warning Trial mau habis */}
        {!sub?.isExpired && sub?.plan === 'TRIAL' && sub?.daysLeft !== null && (sub?.daysLeft ?? 0) <= 3 && (
          <div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-2xl p-4 flex items-start gap-3 max-w-2xl mx-auto">
            <Shield className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-orange-800 dark:text-orange-300 text-sm">Trial hampir habis!</p>
              <p className="text-xs text-orange-700 dark:text-orange-400 mt-0.5">
                Sisa {sub?.daysLeft} hari. Verifikasi KTM sekarang sebelum terlambat.
              </p>
            </div>
          </div>
        )}

        {/* Package cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
        {packages.map((pkg) => {
          const colors = colorMap[pkg.color as keyof typeof colorMap];
          const isCurrentPlan = sub?.plan === pkg.id;

          return (
            <div
              key={pkg.id}
              className={`bg-white dark:bg-gray-900 rounded-2xl border-2 ${colors.border} p-6 relative flex flex-col transition-all duration-300 hover:shadow-xl ${pkg.popular ? 'md:-translate-y-4 shadow-md z-10' : 'hover:-translate-y-1'}`}
            >
              {pkg.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-600 text-white text-[10px] font-bold tracking-wider uppercase px-3 py-1 rounded-full shadow-sm">
                  Paling Populer
                </div>
              )}

              {isCurrentPlan && (
                <div className="absolute -top-3 right-4 bg-indigo-600 text-white text-[10px] font-bold tracking-wider uppercase px-3 py-1 rounded-full shadow-sm">
                  Paket Aktif
                </div>
              )}

              <div className="flex flex-col mb-6 pb-6 border-b border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colors.icon}`}>
                    {pkg.icon}
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-white text-lg">{pkg.name}</h3>
                  </div>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 h-8">{pkg.description}</p>
                <div>
                  <div className="flex items-baseline gap-1">
                    <p className="text-3xl font-extrabold text-gray-900 dark:text-white">{pkg.price}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">/ {pkg.period}</p>
                  </div>
                </div>
              </div>

              <ul className="space-y-3 mb-8 flex-1">
                {pkg.features.map((f: any, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <Check className={`w-4 h-4 flex-shrink-0 mt-0.5 ${colors.check}`} />
                    <span className="text-gray-700 dark:text-gray-300 leading-snug">{f.text}</span>
                    {f.isNew && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded ml-auto">
                        <Sparkles className="w-2.5 h-2.5" />
                        <span>Baru</span>
                      </span>
                    )}
                  </li>
                ))}
              </ul>


              <button
                onClick={() => {
                  if (pkg.ctaAction === 'ktm' && !isCurrentPlan) setKtmOpen(true);
                }}
                disabled={
                  isCurrentPlan ||
                  pkg.ctaAction === null ||
                  pkg.ctaAction === 'premium'
                }
                className={`w-full py-3 mt-auto rounded-xl font-bold text-sm transition-all duration-200 ${
                  isCurrentPlan
                    ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-default'
                    : colors.btn
                }`}
              >
                {isCurrentPlan ? '✓ Paket Aktif' : pkg.cta}
              </button>
            </div>
          );
        })}
        </div>

        <p className="text-center text-xs text-gray-400 dark:text-gray-500 py-2 flex items-center justify-center gap-1.5">
          <Shield className="w-3.5 h-3.5 text-gray-400" />
          <span>Data aman • Bebas iklan di semua paket</span>
        </p>

      </div>

      {/* KTM Modal */}
      <KtmVerifyModal
        isOpen={ktmOpen}
        onClose={() => setKtmOpen(false)}
        onSuccess={handleKtmSuccess}
        token={token}
        userName={userName}
      />
    </div>
  );
}
