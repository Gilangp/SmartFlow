'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, ArrowRightLeft, Trash2, Percent, Wallet, ShieldAlert, PiggyBank, Target, Car, Plane, Home, GraduationCap, Laptop, Gift, Heart, ShoppingBag, Coffee, Coins, X, Info, HelpCircle } from 'lucide-react';
import AddPocketModal from '@/components/AddPocketModal';
import TransferPocketModal from '@/components/TransferPocketModal';
import AllocationModal from '@/components/AllocationModal';
import { formatNominalInput, cleanNominalInput } from '@/lib/utils';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';

interface Pocket {
  id: string;
  name: string;
  type: 'MAIN' | 'EMERGENCY' | 'SAVINGS' | 'WISHLIST' | 'CUSTOM';
  balance: number;
  targetAmount?: number;
  status: string;
  allocation: number;
  color: string;
  icon: string;
  progressPercentage?: number;
}

function formatCurrency(amount: number): string {
  if (isNaN(amount) || amount === null || amount === undefined) return 'Rp 0';
  const hasFraction = amount % 1 !== 0;
  return `Rp ${amount.toLocaleString('id-ID', {
    minimumFractionDigits: 0,
    maximumFractionDigits: hasFraction ? 2 : 0,
  })}`;
}

function formatCurrencyFull(amount: number): string {
  return `Rp ${amount.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function getPocketIcon(type: string, name: string) {
  if (type === 'MAIN') return <Wallet className="w-5 h-5 text-white" strokeWidth={2.5} />;
  if (type === 'EMERGENCY') return <ShieldAlert className="w-5 h-5 text-white" strokeWidth={2.5} />;
  if (type === 'SAVINGS') return <PiggyBank className="w-5 h-5 text-white" strokeWidth={2.5} />;
  if (type === 'WISHLIST') return <Target className="w-5 h-5 text-white" strokeWidth={2.5} />;

  const n = name.toLowerCase();
  if (n.includes('liburan') || n.includes('jalan') || n.includes('trip') || n.includes('travel') || n.includes('tiket')) return <Plane className="w-5 h-5 text-white" strokeWidth={2.5} />;
  if (n.includes('mobil') || n.includes('motor') || n.includes('kendaraan') || n.includes('bensin') || n.includes('servis')) return <Car className="w-5 h-5 text-white" strokeWidth={2.5} />;
  if (n.includes('rumah') || n.includes('kpr') || n.includes('kos') || n.includes('kontrakan') || n.includes('listrik')) return <Home className="w-5 h-5 text-white" strokeWidth={2.5} />;
  if (n.includes('sekolah') || n.includes('kuliah') || n.includes('pendidikan') || n.includes('spp') || n.includes('buku')) return <GraduationCap className="w-5 h-5 text-white" strokeWidth={2.5} />;
  if (n.includes('laptop') || n.includes('pc') || n.includes('gadget') || n.includes('hp') || n.includes('pulsa')) return <Laptop className="w-5 h-5 text-white" strokeWidth={2.5} />;
  if (n.includes('kado') || n.includes('hadiah') || n.includes('nikah') || n.includes('kawaian')) return <Gift className="w-5 h-5 text-white" strokeWidth={2.5} />;
  if (n.includes('kesehatan') || n.includes('obat') || n.includes('asuransi') || n.includes('sehat') || n.includes('rs')) return <Heart className="w-5 h-5 text-white" strokeWidth={2.5} />;
  if (n.includes('belanja') || n.includes('shopping') || n.includes('baju') || n.includes('skincare')) return <ShoppingBag className="w-5 h-5 text-white" strokeWidth={2.5} />;
  if (n.includes('makan') || n.includes('jajan') || n.includes('kopi') || n.includes('resto') || n.includes('food')) return <Coffee className="w-5 h-5 text-white" strokeWidth={2.5} />;

  return <Coins className="w-5 h-5 text-white" strokeWidth={2.5} />;
}

const POCKET_META = {
  MAIN: {
    label: 'Dompet Utama',
    description: 'Uang jajan harian',
    tip: 'Saldo ini yang digunakan untuk menghitung jatah harian',
    gradient: 'from-indigo-600 to-indigo-700',
    canWithdraw: false,
    canSetTarget: false,
    withdrawWarning: '',
  },
  EMERGENCY: {
    label: 'Dana Darurat',
    description: 'Pelindung keuangan',
    tip: 'Gunakan hanya saat benar-benar darurat',
    gradient: 'from-rose-600 to-rose-700',
    canWithdraw: true,
    canSetTarget: true,
    withdrawWarning: 'Dana darurat seharusnya hanya digunakan untuk keadaan benar-benar mendesak. Menarik dana ini akan mengurangi perlindungan finansial Anda.',
  },
  SAVINGS: {
    label: 'Tabungan',
    description: 'Investasi masa depan',
    tip: 'Biarkan uangmu bertumbuh di sini',
    gradient: 'from-emerald-600 to-emerald-700',
    canWithdraw: true,
    canSetTarget: false,
    withdrawWarning: 'Menarik dari tabungan akan memperlambat tujuan keuangan jangka panjang Anda.',
  },
  WISHLIST: {
    label: 'Wishlist',
    description: 'Tabungan tujuan',
    tip: 'Kumpulkan sampai target tercapai',
    gradient: 'from-fuchsia-600 to-fuchsia-700',
    canWithdraw: true,
    canSetTarget: true,
    withdrawWarning: 'Menarik dari wishlist berarti impian Anda harus ditunda lebih lama.',
  },
};

export default function PocketsPage() {
  const router = useRouter();
  const [pockets, setPockets] = useState<Pocket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editTarget, setEditTarget] = useState<{ pocket: Pocket; value: string } | null>(null);
  const [withdrawData, setWithdrawData] = useState<{ pocket: Pocket; amount: string } | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showAllocationModal, setShowAllocationModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const runPocketsTour = useCallback(() => {
    const driverObj = driver({
      showProgress: true,
      nextBtnText: 'Lanjut',
      prevBtnText: 'Kembali',
      doneBtnText: 'Selesai',
      steps: [
        {
          popover: {
            title: 'Sistem Kantong Cerdas',
            description: 'Di halaman ini, kamu bisa membagi uangmu ke dalam kantong-kantong khusus (2 kantong bawaan: Dompet Utama & Tabungan, serta bebas kamu tambah dengan kantong kustom).',
            side: 'bottom' as const,
            align: 'start' as const
          }
        },
        ...(document.querySelector('#tour-pocket-MAIN') ? [{
          element: '#tour-pocket-MAIN',
          popover: {
            title: 'Dompet Utama',
            description: 'Ini saldo jajan dan operasional harianmu. Pengeluaran rutin harian dipotong dari sini, dan jatah harianmu dihitung murni dari saldo ini.',
            side: 'bottom' as const,
            align: 'start' as const
          }
        }] : []),
        ...(document.querySelector('#tour-pocket-SAVINGS') ? [{
          element: '#tour-pocket-SAVINGS',
          popover: {
            title: 'Tabungan Masa Depan',
            description: 'Simpan uang dinginmu di sini agar bertumbuh tanpa terganggu pengeluaran harian.',
            side: 'bottom' as const,
            align: 'start' as const
          }
        }] : []),
        ...(document.querySelector('#tour-allocation-btn') ? [{
          element: '#tour-allocation-btn',
          popover: {
            title: 'Alokasi Pemasukan Otomatis',
            description: 'Atur persentase di sini agar setiap uang masuk otomatis dibagi ke masing-masing kantong (misal 70% Utama, 30% Tabungan).',
            side: 'bottom' as const,
            align: 'start' as const
          }
        }] : []),
        ...(document.querySelector('#tour-transfer-btn') ? [{
          element: '#tour-transfer-btn',
          popover: {
            title: 'Transfer Antar Kantong',
            description: 'Ingin memindahkan uang dari Dompet Utama ke Tabungan atau sebaliknya secara instan? Gunakan menu transfer ini.',
            side: 'bottom' as const,
            align: 'start' as const
          }
        }] : []),
        ...(document.querySelector('#tour-add-pocket-btn') ? [{
          element: '#tour-add-pocket-btn',
          popover: {
            title: 'Tambah Kantong Kustom',
            description: 'Butuh kantong tambahan diluar 2 kantong bawaan (Utama & Tabungan)? Buat kantong kustom atau target impianmu sendiri di sini.',
            side: 'bottom' as const,
            align: 'start' as const
          }
        }] : [])
      ],
      onDestroyed: () => {
        localStorage.setItem('sf-tour-pockets-completed', 'true');
      }
    });

    driverObj.drive();
  }, []);

  useEffect(() => {
    if (!isLoading && pockets.length > 0) {
      const tourCompleted = localStorage.getItem('sf-tour-pockets-completed');
      if (!tourCompleted) {
        const timer = setTimeout(() => {
          runPocketsTour();
        }, 1500);
        return () => clearTimeout(timer);
      }
    }
  }, [isLoading, pockets, runPocketsTour]);

  const getToken = useCallback(() => localStorage.getItem('sf-token'), []);

  const fetchPockets = useCallback(async () => {
    const token = getToken();
    if (!token) { router.push('/login'); return; }
    try {
      const res = await fetch('/api/pockets', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.success) setPockets(data.data);
      else router.push('/login');
    } catch { router.push('/login'); }
    finally { setIsLoading(false); }
  }, [getToken, router]);

  useEffect(() => { fetchPockets(); }, [fetchPockets]);

  const handleSetTarget = async () => {
    if (!editTarget) return;
    setIsSaving(true);
    const token = getToken();
    try {
      const res = await fetch(`/api/pockets/${editTarget.pocket.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ targetAmount: parseFloat(editTarget.value) }),
      });
      const data = await res.json();
      if (data.success) { setEditTarget(null); fetchPockets(); }
    } finally { setIsSaving(false); }
  };

  const handleWithdraw = async () => {
    if (!withdrawData) return;
    setIsSaving(true);
    const token = getToken();
    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          type: 'EXPENSE',
          amount: parseFloat(withdrawData.amount),
          pocketId: withdrawData.pocket.id,
          categoryId: null,
          notes: `Penarikan dari ${withdrawData.pocket.name}`,
          date: new Date().toISOString(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setWithdrawData(null);
        setShowConfirmModal(false);
        fetchPockets();
      }
    } finally { setIsSaving(false); }
  };

  const sortedPockets = [...pockets].sort((a, b) => {
    const order = ['MAIN', 'SAVINGS', 'EMERGENCY', 'WISHLIST', 'CUSTOM'];
    const indexA = order.indexOf(a.type);
    const indexB = order.indexOf(b.type);
    if (indexA === indexB) return a.name.localeCompare(b.name);
    return indexA - indexB;
  });

  const totalWealth = pockets.reduce((s, p) => s + p.balance, 0);

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-gray-950">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-gray-950/80 backdrop-blur-xl border-b border-gray-200 dark:border-gray-800 pt-safe">
        <div className="max-w-7xl mx-auto px-5 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center justify-between w-full sm:w-auto">
              <div>
                <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Kantong</h1>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">
                  Total: <span className="font-semibold text-indigo-600 dark:text-indigo-400">{formatCurrency(totalWealth)}</span>
                </p>
              </div>
              {/* Help Button (Mobile only) */}
              <button
                onClick={runPocketsTour}
                className="sm:hidden w-9 h-9 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition active:scale-95"
                title="Panduan Pengguna"
                aria-label="Tampilkan Panduan"
              >
                <HelpCircle className="w-4.5 h-4.5" />
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                id="tour-allocation-btn"
                onClick={() => setShowAllocationModal(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition active:scale-[0.98]"
              >
                <Percent className="w-4 h-4" />
                Alokasi
              </button>
              <button
                id="tour-transfer-btn"
                onClick={() => setShowTransferModal(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition active:scale-[0.98]"
              >
                <ArrowRightLeft className="w-4 h-4" />
                Transfer
              </button>
              <button
                id="tour-add-pocket-btn"
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 border border-indigo-600 rounded-lg text-xs font-medium text-white hover:bg-indigo-700 transition shadow-sm shadow-indigo-600/20 active:scale-[0.98]"
              >
                <Plus className="w-4 h-4" />
                Tambah Kantong
              </button>
              {/* Help Button (Desktop only) */}
              <button
                onClick={runPocketsTour}
                className="hidden sm:flex w-9 h-9 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 items-center justify-center text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all active:scale-[0.98]"
                aria-label="Tampilkan Panduan"
                title="Panduan Pengguna"
              >
                <HelpCircle className="w-4.5 h-4.5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-5 py-6 space-y-6">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-44 bg-gray-100 dark:bg-gray-800 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {sortedPockets.map((pocket) => {
              const meta = POCKET_META[pocket.type as keyof typeof POCKET_META] || {
                label: pocket.name,
                description: 'Kantong Tambahan',
                tip: `Alokasi Pemasukan: ${pocket.allocation}%`,
                gradient: '',
                canWithdraw: true,
                canSetTarget: true,
                withdrawWarning: 'Pastikan penarikan sesuai dengan tujuan kantong ini.',
              };
 
              const hasTarget = pocket.targetAmount && meta.canSetTarget;
              const isCompleted = pocket.status === 'completed';
              const progress = Math.min(pocket.progressPercentage || 0, 100);
              const canWithdraw = meta.canWithdraw && pocket.balance > 0;
 
              const isCustomGradient = pocket.color?.startsWith('from-');
              const gradientClass = meta.gradient || (isCustomGradient ? pocket.color : '');
 
              return (
                <div
                  key={pocket.id}
                  id={`tour-pocket-${pocket.type}`}
                  className={`relative overflow-hidden rounded-2xl p-5 text-white shadow-xl shadow-indigo-900/10 dark:shadow-none transition-transform hover:-translate-y-1 duration-300 ${gradientClass ? `bg-gradient-to-br ${gradientClass}` : ''}`}
                  style={!gradientClass ? { backgroundColor: pocket.color || '#6366f1' } : undefined}
                >
                  {/* Decorative Glassmorphism Elements */}
                  <div className="absolute inset-0 opacity-10 mix-blend-overlay" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '16px 16px' }}></div>
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/20 rounded-full blur-2xl transform translate-x-12 -translate-y-12" />
                  <div className="absolute bottom-0 left-0 w-24 h-24 bg-black/10 rounded-full blur-2xl transform -translate-x-10 translate-y-10" />

                  <div className="relative z-10 flex flex-col h-full">
                    {/* Header with Icon */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md border border-white/20 shadow-inner flex items-center justify-center">
                          {getPocketIcon(pocket.type, pocket.name)}
                        </div>
                        <div>
                          <h2 className="font-bold text-base tracking-wide drop-shadow-sm">{meta.label}</h2>
                          <p className="text-white/80 text-xs font-medium drop-shadow-sm">{meta.description}</p>
                        </div>
                      </div>
                      {isCompleted && (
                        <span className="px-2.5 py-1 bg-amber-400 text-amber-950 rounded-lg text-xs font-bold shadow-md">
                          Tercapai!
                        </span>
                      )}
                    </div>

                    {/* Balance */}
                    <div className="mb-4">
                      <p className="text-3xl font-extrabold tracking-tight drop-shadow-md">
                        {formatCurrency(pocket.balance)}
                      </p>
                    </div>

                    {/* Progress Bar */}
                    {hasTarget && pocket.targetAmount && (
                      <div className="mb-4 bg-black/20 p-3 rounded-xl border border-white/10 backdrop-blur-sm">
                        <div className="flex justify-between text-xs text-white/90 mb-1.5 font-medium">
                          <span>Target: {formatCurrencyFull(pocket.targetAmount)}</span>
                          <span className="font-bold text-amber-300">{Math.round(progress)}%</span>
                        </div>
                        <div className="h-2 bg-black/40 rounded-full overflow-hidden shadow-inner relative">
                          <div
                            className="absolute top-0 left-0 h-full bg-gradient-to-r from-amber-300 to-yellow-400 rounded-full transition-all duration-700 ease-out shadow-[0_0_10px_rgba(251,191,36,0.6)]"
                            style={{ width: `${progress}%` }}
                          >
                            <div className="absolute top-0 right-0 bottom-0 w-8 bg-white/40 blur-[4px] -skew-x-12 translate-x-4"></div>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="mt-auto">
                      {/* Tip */}
                      <div className="flex items-start gap-1.5 text-white/70 text-xs italic mb-4 font-medium drop-shadow-sm">
                        <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                        <span>{meta.tip}</span>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2">
                        {meta.canSetTarget && (
                          <button
                            onClick={() => setEditTarget({ pocket, value: String(pocket.targetAmount || '') })}
                            className="flex-1 py-2 bg-white/20 hover:bg-white/30 rounded-xl text-xs font-semibold backdrop-blur-sm border border-white/10 transition-colors shadow-sm"
                          >
                            Set Target
                          </button>
                        )}
                        {canWithdraw && (
                          <button
                            onClick={() => {
                              setWithdrawData({ pocket, amount: '' });
                              setShowConfirmModal(true);
                            }}
                            className="flex-1 py-2 bg-white/20 hover:bg-white/30 rounded-xl text-xs font-semibold backdrop-blur-sm border border-white/10 transition-colors shadow-sm"
                          >
                            Tarik Dana
                          </button>
                        )}
                        {pocket.type === 'CUSTOM' && pocket.balance === 0 && (
                          <button
                            onClick={async () => {
                              if (!confirm(`Yakin ingin menghapus kantong "${pocket.name}"?\n\nSeluruh riwayat transaksi pada kantong ini juga akan dihapus secara permanen.`)) return;
                              const t = getToken();
                              if (!t) return;
                              const res = await fetch(`/api/pockets?id=${pocket.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${t}` } });
                              const data = await res.json();
                              if (data.success) {
                                fetchPockets();
                              } else {
                                alert(`Gagal menghapus: ${data.message}`);
                              }
                            }}
                            className="w-10 h-8 bg-rose-500/80 hover:bg-rose-500 rounded-xl flex items-center justify-center transition-colors shadow-sm"
                          >
                            <Trash2 className="w-4 h-4 text-white" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Info Card */}
        <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4 border border-gray-100 dark:border-gray-800">
          <h3 className="font-semibold text-sm text-gray-900 dark:text-white mb-1">
            Cara Kerja
          </h3>
          <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
            Saat menerima pemasukan, dana akan dialokasikan ke semua kantong.
            Hanya saldo <span className="font-medium text-indigo-600 dark:text-indigo-400">Dompet Utama</span> yang digunakan untuk menghitung Jatah Harian.
          </p>
        </div>
      </main>

      {/* Modals */}
      {editTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-4" onClick={() => setEditTarget(null)}>
          <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-800">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Set Target {editTarget.pocket.name}
              </h2>
              <button onClick={() => setEditTarget(null)} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Nominal Target
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={formatNominalInput(editTarget.value)}
                  onChange={(e) => setEditTarget((prev) => prev ? { ...prev, value: cleanNominalInput(e.target.value) } : null)}
                  placeholder="Contoh: 5.000.000"
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all font-mono"
                />
              </div>

              <button
                onClick={handleSetTarget}
                disabled={!editTarget.value || isSaving}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium text-sm transition-all disabled:opacity-50"
              >
                {isSaving ? 'Menyimpan...' : 'Simpan Target'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showConfirmModal && withdrawData && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-4" onClick={() => { setShowConfirmModal(false); setWithdrawData(null); }}>
          <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-800">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Tarik Dana dari {withdrawData.pocket.name}
              </h2>
              <button onClick={() => { setShowConfirmModal(false); setWithdrawData(null); }} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20">
                <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
                  {POCKET_META[withdrawData.pocket.type as keyof typeof POCKET_META]?.withdrawWarning || 'Pastikan penarikan sesuai dengan tujuan kantong ini.'}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Jumlah Penarikan
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={formatNominalInput(withdrawData.amount)}
                  onChange={(e) => setWithdrawData((prev) => prev ? { ...prev, amount: cleanNominalInput(e.target.value) } : null)}
                  placeholder="Masukkan nominal"
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all font-mono"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Max: {formatCurrencyFull(withdrawData.pocket.balance)}
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => { setShowConfirmModal(false); setWithdrawData(null); }}
                  className="flex-1 py-3 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg font-medium text-sm transition-all"
                >
                  Batal
                </button>
                <button
                  onClick={handleWithdraw}
                  disabled={!withdrawData.amount || parseFloat(withdrawData.amount) <= 0 || parseFloat(withdrawData.amount) > withdrawData.pocket.balance || isSaving}
                  className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-medium text-sm transition-all disabled:opacity-50"
                >
                  {isSaving ? 'Memproses...' : 'Konfirmasi Tarik'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAddModal && (
        <AddPocketModal
          token={getToken()!}
          currentTotalAllocation={pockets.reduce((sum, p) => sum + p.allocation, 0)}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            fetchPockets();
          }}
        />
      )}

      {showTransferModal && (
        <TransferPocketModal
          token={getToken()!}
          pockets={pockets}
          onClose={() => setShowTransferModal(false)}
          onSuccess={() => {
            setShowTransferModal(false);
            fetchPockets();
          }}
        />
      )}

      {showAllocationModal && (
        <AllocationModal
          token={getToken()!}
          pockets={pockets}
          onClose={() => setShowAllocationModal(false)}
          onSuccess={() => {
            setShowAllocationModal(false);
            fetchPockets();
          }}
        />
      )}
    </div>
  );
}