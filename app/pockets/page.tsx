'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import BottomNav from '@/components/BottomNav';

interface Pocket {
  id: string;
  name: string;
  type: 'MAIN' | 'EMERGENCY' | 'SAVINGS' | 'WISHLIST';
  balance: number;
  targetAmount?: number;
  status: string;
  progressPercentage?: number;
}

function formatCurrency(amount: number): string {
  return `Rp ${amount.toLocaleString('id-ID')}`;
}

const POCKET_META = {
  MAIN: {
    icon: '💳',
    label: 'Dompet Utama',
    description: 'Uang jajan harian — basis kalkulasi Jatah Harian',
    gradient: 'from-indigo-600 to-violet-700',
    tip: 'Saldo ini yang digunakan untuk menghitung jatah harian kamu.',
  },
  EMERGENCY: {
    icon: '🛡️',
    label: 'Dana Darurat',
    description: 'Pelindung keuangan — gunakan hanya saat darurat',
    gradient: 'from-rose-500 to-orange-600',
    tip: 'Dana darurat ideal adalah 3-6x pengeluaran bulanan.',
  },
  SAVINGS: {
    icon: '📈',
    label: 'Tabungan Aset',
    description: 'Investasi masa depan — biarkan bertumbuh',
    gradient: 'from-emerald-500 to-teal-600',
    tip: 'Uang di sini sebaiknya tidak diambil — biarkan bertumbuh!',
  },
  WISHLIST: {
    icon: '🎯',
    label: 'Wishlist',
    description: 'Tabungan tujuan — untuk impian kamu',
    gradient: 'from-fuchsia-500 to-pink-600',
    tip: 'Kumpulkan sampai 100% lalu nikmati hasilnya!',
  },
};

export default function PocketsPage() {
  const router = useRouter();
  const [pockets, setPockets] = useState<Pocket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPocket, setSelectedPocket] = useState<Pocket | null>(null);
  const [showWithdrawWarning, setShowWithdrawWarning] = useState(false);
  const [editTarget, setEditTarget] = useState<{ pocket: Pocket; value: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const getToken = useCallback(() => localStorage.getItem('sf-token'), []);

  const fetchPockets = useCallback(async () => {
    const token = getToken();
    if (!token) { router.push('/auth/login'); return; }
    try {
      const res = await fetch('/api/pockets', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.success) setPockets(data.data);
      else router.push('/auth/login');
    } catch { router.push('/auth/login'); }
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

  const sortedPockets = [...pockets].sort((a, b) => {
    const order = ['MAIN', 'EMERGENCY', 'SAVINGS', 'WISHLIST'];
    return order.indexOf(a.type) - order.indexOf(b.type);
  });

  const totalWealth = pockets.reduce((s, p) => s + p.balance, 0);

  return (
    <div className="page-shell">
      <header className="page-header">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <h1 className="text-xl font-bold text-surface-900 dark:text-white">Kantong Finansial</h1>
          <p className="text-sm text-slate-400">Total kekayaan: <span className="font-bold text-primary-500">{formatCurrency(totalWealth)}</span></p>
        </div>
      </header>

      <main className="page-content space-y-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-36 rounded-2xl" />
          ))
        ) : (
          sortedPockets.map((pocket) => {
            const meta = POCKET_META[pocket.type];
            return (
              <div key={pocket.id} className={`bg-gradient-to-br ${meta.gradient} rounded-3xl p-5 text-white shadow-xl relative overflow-hidden`}>
                {/* Decorative circles */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full transform translate-x-12 -translate-y-12" />
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full transform -translate-x-8 translate-y-8" />

                <div className="relative z-10">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{meta.icon}</span>
                      <div>
                        <h2 className="font-bold text-base">{pocket.name}</h2>
                        <p className="text-white/70 text-xs">{meta.description}</p>
                      </div>
                    </div>
                    {pocket.status === 'completed' && (
                      <span className="px-2 py-1 bg-white/20 rounded-lg text-xs font-bold">✅ Completed</span>
                    )}
                  </div>

                  <p className="text-3xl font-black tabular-nums mb-3">
                    {formatCurrency(pocket.balance)}
                  </p>

                  {/* Progress bar for EMERGENCY and WISHLIST */}
                  {pocket.targetAmount && (
                    <div className="mb-3">
                      <div className="flex justify-between text-xs text-white/70 mb-1">
                        <span>Target: {formatCurrency(pocket.targetAmount)}</span>
                        <span className="font-bold">{Math.min((pocket.progressPercentage || 0), 100).toFixed(1)}%</span>
                      </div>
                      <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-white/80 rounded-full transition-all duration-700"
                          style={{ width: `${Math.min(pocket.progressPercentage || 0, 100)}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Tip */}
                  <p className="text-white/60 text-xs italic mb-3">{meta.tip}</p>

                  {/* Actions */}
                  <div className="flex gap-2">
                    {(pocket.type === 'EMERGENCY' || pocket.type === 'WISHLIST') && (
                      <button
                        onClick={() => setEditTarget({ pocket, value: String(pocket.targetAmount || '') })}
                        className="px-3 py-1.5 bg-white/15 hover:bg-white/25 backdrop-blur-sm rounded-xl text-xs font-semibold transition-all border border-white/20"
                      >
                        🎯 Set Target
                      </button>
                    )}
                    {pocket.type === 'EMERGENCY' && (
                      <button
                        onClick={() => { setSelectedPocket(pocket); setShowWithdrawWarning(true); }}
                        className="px-3 py-1.5 bg-white/15 hover:bg-white/25 backdrop-blur-sm rounded-xl text-xs font-semibold transition-all border border-white/20"
                      >
                        ⚠️ Tarik Dana
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* Info card */}
        <div className="card p-4">
          <h3 className="font-bold text-sm text-surface-900 dark:text-white mb-2">💡 Cara Kerja 4 Kantong</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Saat menerima pemasukan rutin, dana akan dialokasikan otomatis ke semua kantong berdasarkan prioritas. 
            Hanya saldo <strong className="text-primary-500">Dompet Utama</strong> yang digunakan untuk menghitung Jatah Harian kamu.
          </p>
        </div>
      </main>

      {/* Emergency withdrawal warning modal */}
      {showWithdrawWarning && selectedPocket && (
        <div className="modal-backdrop" onClick={() => setShowWithdrawWarning(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="text-center mb-5">
                <div className="text-5xl mb-3">🚨</div>
                <h2 className="text-xl font-black text-surface-900 dark:text-white">Yakin Ini Darurat?</h2>
                <p className="text-slate-400 text-sm mt-2">
                  Dana Darurat seharusnya hanya digunakan untuk keadaan benar-benar mendesak. Menarik dana ini akan mengurangi perlindungan finansial kamu.
                </p>
              </div>
              <div className="space-y-2">
                <button
                  onClick={() => { setShowWithdrawWarning(false); }}
                  className="w-full py-3 bg-surface-100 dark:bg-surface-700 text-surface-700 dark:text-slate-200 rounded-xl font-bold transition-all hover:bg-surface-200 dark:hover:bg-surface-600"
                >
                  ❌ Batal — Saya Tidak Perlu
                </button>
                <button
                  onClick={() => { setShowWithdrawWarning(false); }}
                  className="w-full py-3 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-bold transition-all"
                >
                  Ya, Ini Benar-benar Darurat
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Set Target Modal */}
      {editTarget && (
        <div className="modal-backdrop" onClick={() => setEditTarget(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="text-lg font-bold text-surface-900 dark:text-white">Set Target {editTarget.pocket.name}</h2>
              <button onClick={() => setEditTarget(null)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="form-label">Nominal Target (Rp)</label>
                <input
                  type="number"
                  value={editTarget.value}
                  onChange={(e) => setEditTarget((prev) => prev ? { ...prev, value: e.target.value } : null)}
                  placeholder="Contoh: 5000000"
                  className="form-input text-lg font-mono"
                  min={1}
                />
              </div>
              <button
                onClick={handleSetTarget}
                disabled={!editTarget.value || isSaving}
                className="w-full py-3.5 bg-primary-600 text-white rounded-xl font-bold disabled:opacity-50 transition-all"
              >
                {isSaving ? 'Menyimpan...' : '✅ Simpan Target'}
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
