'use client';

import { useState, useEffect } from 'react';
import { CategoryRecord } from '@/types';

interface Pocket {
  id: string;
  name: string;
  type: string;
}

interface UserAllocation {
  allocationEmergency: number;
  allocationSavings: number;
  allocationWishlist: number;
}

interface AddTransactionModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

const SMART_INPUT_EXAMPLES = [
  'Makan siang warteg 15rb',
  'Beli kuota internet 50000',
  'Ongkos gojek ke kampus 25k',
  'Kopi sama teman 35.000',
];

export default function AddTransactionModal({ onClose, onSuccess }: AddTransactionModalProps) {
  const [mode, setMode] = useState<'smart' | 'manual'>('smart');
  const [smartText, setSmartText] = useState('');
  const [aiProcessing, setAiProcessing] = useState(false);
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [pockets, setPockets] = useState<Pocket[]>([]);
  const [allocation, setAllocation] = useState<UserAllocation>({
    allocationEmergency: 0,
    allocationSavings: 0,
    allocationWishlist: 0,
  });
  const [form, setForm] = useState({
    type: 'EXPENSE' as 'INCOME_ROUTINE' | 'INCOME_BONUS' | 'EXPENSE',
    amount: '',
    categoryId: '',
    pocketId: '',
    date: new Date().toISOString().split('T')[0],
    notes: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const getToken = () => localStorage.getItem('sf-token');

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };

    Promise.all([
      fetch('/api/categories', { headers }).then((r) => r.json()),
      fetch('/api/pockets', { headers }).then((r) => r.json()),
      fetch('/api/auth/me', { headers }).then((r) => r.json()),
    ]).then(([catData, pktData, userData]) => {
      if (catData.success) setCategories(catData.data);
      if (pktData.success) {
        setPockets(pktData.data);
        const mainPocket = pktData.data.find((p: Pocket) => p.type === 'MAIN');
        if (mainPocket) setForm((f) => ({ ...f, pocketId: mainPocket.id }));
      }
      // Set allocation from user data
      if (userData.success && userData.data) {
        setAllocation({
          allocationEmergency: userData.data.allocationEmergency || 0,
          allocationSavings: userData.data.allocationSavings || 0,
          allocationWishlist: userData.data.allocationWishlist || 0,
        });
      }
    });
  }, []);

  const handleSmartInput = async () => {
    if (!smartText.trim()) return;
    setAiProcessing(true);
    setError('');
    const token = getToken();
    try {
      const res = await fetch('/api/ai/smart-input', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ text: smartText }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        const extracted = data.data;
        const matchedCat = categories.find(
          (c) => c.name.toLowerCase() === extracted.category?.toLowerCase()
        );
        setForm((f) => ({
          ...f,
          amount: String(extracted.amount || ''),
          categoryId: matchedCat?.id || f.categoryId,
          notes: extracted.notes || smartText,
        }));
        setMode('manual');
      } else {
        setError('AI gagal memproses. Isi manual ya!');
        setMode('manual');
      }
    } catch {
      setError('Gagal menghubungi AI. Isi manual.');
      setMode('manual');
    } finally {
      setAiProcessing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.amount || !form.pocketId || !form.date) {
      setError('Nominal, kantong, dan tanggal wajib diisi');
      return;
    }
    setIsSubmitting(true);
    setError('');
    const token = getToken();
    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          type: form.type,
          amount: parseFloat(form.amount),
          categoryId: form.categoryId || undefined,
          pocketId: form.pocketId,
          date: form.date,
          notes: form.notes || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        onSuccess();
      } else {
        setError(data.message || 'Gagal menyimpan transaksi');
      }
    } catch {
      setError('Terjadi kesalahan. Coba lagi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content">
        <div className="modal-header">
          <h2 className="text-lg font-bold text-surface-900 dark:text-white">Tambah Transaksi</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-surface-100 dark:hover:bg-surface-700 transition-all">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-rose-100 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-700/50 text-rose-600 dark:text-rose-300 text-sm">
              {error}
            </div>
          )}

          {/* Mode Toggle */}
          <div className="flex gap-2 mb-5 p-1 bg-surface-100 dark:bg-surface-700 rounded-xl">
            <button
              onClick={() => setMode('smart')}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${mode === 'smart' ? 'bg-white dark:bg-surface-800 text-primary-600 dark:text-primary-400 shadow-sm' : 'text-slate-500'}`}
            >
              Smart Input
            </button>
            <button
              onClick={() => setMode('manual')}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${mode === 'manual' ? 'bg-white dark:bg-surface-800 text-primary-600 dark:text-primary-400 shadow-sm' : 'text-slate-500'}`}
            >
              Manual
            </button>
          </div>

          {/* Smart Input */}
          {mode === 'smart' && (
            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-700/30">
                <p className="text-xs text-primary-600 dark:text-primary-300 font-medium mb-2">Contoh input:</p>
                <div className="flex flex-wrap gap-1.5">
                  {SMART_INPUT_EXAMPLES.map((ex) => (
                    <button
                      key={ex}
                      onClick={() => setSmartText(ex)}
                      className="px-2.5 py-1 bg-primary-100 dark:bg-primary-800/40 text-primary-700 dark:text-primary-300 rounded-lg text-xs hover:bg-primary-200 dark:hover:bg-primary-700/40 transition-colors"
                    >
                      {ex}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <textarea
                  id="smart-input-text"
                  value={smartText}
                  onChange={(e) => setSmartText(e.target.value)}
                  placeholder="Ketik apa saja... contoh: 'Makan soto ayam 18rb di warung sebelah kampus'"
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl border border-surface-200 dark:border-surface-600 bg-white dark:bg-surface-700 text-surface-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 resize-none text-sm"
                />
              </div>
              <button
                onClick={handleSmartInput}
                disabled={!smartText.trim() || aiProcessing}
                className="w-full py-3.5 bg-gradient-to-r from-accent-600 to-primary-600 hover:from-accent-500 hover:to-primary-500 text-white rounded-xl font-bold text-sm disabled:opacity-50 transition-all active:scale-95 flex items-center justify-center gap-2 shadow-lg"
              >
                {aiProcessing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Memproses...
                  </>
                ) : (
                  <>Proses dengan AI</>
                )}
              </button>
              <button onClick={() => setMode('manual')} className="w-full text-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors py-1">
                Atau isi manual →
              </button>
            </div>
          )}

          {/* Manual Form */}
          {mode === 'manual' && (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Type */}
              <div className="flex gap-2">
                {([
                  { value: 'EXPENSE', label: '💸 Pengeluaran', color: 'rose' },
                  { value: 'INCOME_BONUS', label: '🎁 Bonus/Rejeki', color: 'amber' },
                ] as const).map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, type: t.value }))}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-semibold border transition-all ${
                      form.type === t.value
                        ? `bg-${t.color}-100 dark:bg-${t.color}-900/30 border-${t.color}-400 text-${t.color}-700 dark:text-${t.color}-300`
                        : 'bg-surface-50 dark:bg-surface-700 border-surface-200 dark:border-surface-600 text-slate-500'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Amount */}
              <div>
                <label className="form-label">Nominal (Rp)</label>
                <input
                  id="trx-amount"
                  type="number"
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                  placeholder="0"
                  min={1}
                  required
                  className="form-input font-mono text-lg"
                />
              </div>

              {/* Category - Only for EXPENSE */}
              {form.type === 'EXPENSE' && (
                <div>
                  <label className="form-label">Kategori</label>
                  <select
                    id="trx-category"
                    value={form.categoryId}
                    onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
                    className="form-select"
                  >
                    <option value="">Pilih kategori (opsional)</option>
                    <optgroup label="Kebutuhan (Need)">
                      {categories.filter((c) => c.type === 'NEED').map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </optgroup>
                    <optgroup label="Keinginan (Want)">
                      {categories.filter((c) => c.type === 'WANT').map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </optgroup>
                  </select>
                </div>
              )}

              {/* Pocket */}
              <div>
                <label className="form-label">
                  {form.type === 'EXPENSE' ? 'Dari Kantong' : 'Masuk ke Kantong'}
                </label>
                <select
                  id="trx-pocket"
                  value={form.pocketId}
                  onChange={(e) => setForm((f) => ({ ...f, pocketId: e.target.value }))}
                  required
                  className="form-select"
                >
                  <option value="">Pilih kantong</option>
                  {pockets.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              {/* Allocation Preview for INCOME_BONUS */}
              {form.type === 'INCOME_BONUS' && form.amount && (
                <div className="p-4 rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200 dark:border-amber-700/30">
                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 mb-3">
                    Alokasi Otomatis untuk Rp {parseFloat(form.amount || '0').toLocaleString('id-ID')}
                  </p>
                  <div className="space-y-2">
                    {(() => {
                      const amount = parseFloat(form.amount || '0');
                      const emergency = Math.max(0, allocation.allocationEmergency || 0);
                      const savings = Math.max(0, allocation.allocationSavings || 0);
                      const wishlist = Math.max(0, allocation.allocationWishlist || 0);
                      const main = Math.max(0, 100 - emergency - savings - wishlist);

                      const emergencyAmount = (amount * emergency) / 100;
                      const savingsAmount = (amount * savings) / 100;
                      const wishlistAmount = (amount * wishlist) / 100;
                      const mainAmount = (amount * main) / 100;

                      return (
                        <>
                          {mainAmount > 0 && (
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-slate-600 dark:text-slate-400">MAIN</span>
                              <span className="font-mono font-bold text-primary-600 dark:text-primary-300">
                                {mainAmount.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ({String(main)}%)
                              </span>
                            </div>
                          )}
                          {emergencyAmount > 0 && (
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-slate-600 dark:text-slate-400">🚨 Darurat</span>
                              <span className="font-mono font-bold text-rose-600 dark:text-rose-300">
                                {emergencyAmount.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ({String(emergency)}%)
                              </span>
                            </div>
                          )}
                          {savingsAmount > 0 && (
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-slate-600 dark:text-slate-400">🏦 Tabungan</span>
                              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-300">
                                {savingsAmount.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ({String(savings)}%)
                              </span>
                            </div>
                          )}
                          {wishlistAmount > 0 && (
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-slate-600 dark:text-slate-400">💝 Wishlist</span>
                              <span className="font-mono font-bold text-blue-600 dark:text-blue-300">
                                {wishlistAmount.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ({String(wishlist)}%)
                              </span>
                            </div>
                          )}
                          {emergency + savings + wishlist === 0 && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                              Belum ada alokasi. Atur di halaman Profil.
                            </p>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* Date */}
              <div>
                <label className="form-label">Tanggal</label>
                <input
                  id="trx-date"
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                  required
                  className="form-input"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="form-label">Catatan (opsional)</label>
                <input
                  id="trx-notes"
                  type="text"
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="Tambahkan catatan..."
                  className="form-input"
                />
              </div>

              <button
                id="trx-submit"
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 bg-gradient-to-r from-primary-600 to-primary-500 text-white rounded-xl font-bold text-sm shadow-lg disabled:opacity-50 transition-all active:scale-95"
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Menyimpan...
                  </span>
                ) : '✅ Simpan Transaksi'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
