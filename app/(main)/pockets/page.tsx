'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, ArrowRightLeft, Trash2, Percent } from 'lucide-react';
import AddPocketModal from '@/components/AddPocketModal';
import TransferPocketModal from '@/components/TransferPocketModal';
import AllocationModal from '@/components/AllocationModal';

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
  if (amount >= 1000000) return `Rp ${(amount / 1000000).toFixed(1)}jt`;
  if (amount >= 1000) return `Rp ${(amount / 1000).toFixed(0)}rb`;
  return `Rp ${amount.toLocaleString('id-ID')}`;
}

function formatCurrencyFull(amount: number): string {
  return `Rp ${amount.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
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
    const order = ['MAIN', 'EMERGENCY', 'SAVINGS', 'WISHLIST', 'CUSTOM'];
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
            <div>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Kantong</h1>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">
                Total: <span className="font-semibold text-indigo-600 dark:text-indigo-400">{formatCurrency(totalWealth)}</span>
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setShowAllocationModal(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition active:scale-[0.98]"
              >
                <Percent className="w-4 h-4" />
                Alokasi
              </button>
              <button
                onClick={() => setShowTransferModal(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition active:scale-[0.98]"
              >
                <ArrowRightLeft className="w-4 h-4" />
                Transfer
              </button>
              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 border border-indigo-600 rounded-lg text-xs font-medium text-white hover:bg-indigo-700 transition shadow-sm shadow-indigo-600/20 active:scale-[0.98]"
              >
                <Plus className="w-4 h-4" />
                Tambah Kantong
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
                  className={`relative overflow-hidden rounded-2xl p-5 text-white shadow-lg ${gradientClass ? `bg-gradient-to-r ${gradientClass}` : ''}`}
                  style={!gradientClass ? { backgroundColor: pocket.color || '#6366f1' } : undefined}
                >
                  {/* Decorative elements */}
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl transform translate-x-16 -translate-y-16" />
                  <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full blur-2xl transform -translate-x-12 translate-y-12" />
                  
                  <div className="relative z-10">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h2 className="font-semibold text-base">{meta.label}</h2>
                        <p className="text-white/70 text-xs">{meta.description}</p>
                      </div>
                      {isCompleted && (
                        <span className="px-2 py-0.5 bg-white/20 rounded-lg text-xs font-medium">
                          Tercapai
                        </span>
                      )}
                    </div>

                    {/* Balance */}
                    <p className="text-3xl font-bold mb-3">
                      {formatCurrency(pocket.balance)}
                    </p>

                    {/* Progress Bar for EMERGENCY and WISHLIST */}
                    {hasTarget && pocket.targetAmount && (
                      <div className="mb-3">
                        <div className="flex justify-between text-xs text-white/70 mb-1">
                          <span>Target: {formatCurrencyFull(pocket.targetAmount)}</span>
                          <span className="font-medium">{Math.round(progress)}%</span>
                        </div>
                        <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-white/80 rounded-full transition-all duration-500"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Tip */}
                    <p className="text-white/60 text-xs italic mb-3">
                      {meta.tip}
                    </p>

                    {/* Actions */}
                    <div className="flex gap-2">
                      {meta.canSetTarget && (
                        <button
                          onClick={() => setEditTarget({ pocket, value: String(pocket.targetAmount || '') })}
                          className="px-3 py-1.5 bg-white/15 hover:bg-white/25 rounded-lg text-xs font-medium transition-all"
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
                          className="px-3 py-1.5 bg-white/15 hover:bg-white/25 rounded-lg text-xs font-medium transition-all"
                        >
                          Tarik Dana
                        </button>
                      )}
                      {pocket.type === 'CUSTOM' && pocket.balance === 0 && (
                        <button
                          onClick={async () => {
                            if (!confirm('Yakin ingin menghapus kantong ini?')) return;
                            const t = getToken();
                            if(!t) return;
                            await fetch(`/api/pockets?id=${pocket.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${t}` } });
                            fetchPockets();
                          }}
                          className="px-2 py-1.5 bg-red-500/30 hover:bg-red-500/50 rounded-lg text-xs font-medium transition-all flex items-center justify-center ml-auto"
                        >
                          <Trash2 className="w-4 h-4 text-red-100" />
                        </button>
                      )}
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
                ✕
              </button>
            </div>
            
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Nominal Target
                </label>
                <input
                  type="number"
                  value={editTarget.value}
                  onChange={(e) => setEditTarget((prev) => prev ? { ...prev, value: e.target.value } : null)}
                  placeholder="Contoh: 5000000"
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all font-mono"
                  min={1}
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
                ✕
              </button>
            </div>
            
            <div className="p-5 space-y-4">
              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20">
                <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
                  {POCKET_META[withdrawData.pocket.type].withdrawWarning}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Jumlah Penarikan
                </label>
                <input
                  type="number"
                  value={withdrawData.amount}
                  onChange={(e) => setWithdrawData((prev) => prev ? { ...prev, amount: e.target.value } : null)}
                  placeholder="Masukkan nominal"
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all font-mono"
                  min={1}
                  max={withdrawData.pocket.balance}
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