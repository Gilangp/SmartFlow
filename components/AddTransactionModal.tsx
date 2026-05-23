// components/AddTransactionModal.tsx
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
        setError('AI gagal memproses. Isi manual.');
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

  const hasAllocation = allocation.allocationEmergency > 0 || allocation.allocationSavings > 0 || allocation.allocationWishlist > 0;
  const amountNum = parseFloat(form.amount) || 0;
  const emergency = allocation.allocationEmergency || 0;
  const savings = allocation.allocationSavings || 0;
  const wishlist = allocation.allocationWishlist || 0;
  const main = Math.max(0, 100 - emergency - savings - wishlist);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Tambah Transaksi</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition">
            ✕
          </button>
        </div>

        <div className="p-5">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 text-rose-600 dark:text-rose-400 text-sm">
              {error}
            </div>
          )}

          {/* Mode Toggle */}
          <div className="flex gap-2 mb-5 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg">
            <button
              onClick={() => setMode('smart')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${mode === 'smart' ? 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-gray-500'}`}
            >
              Smart Input
            </button>
            <button
              onClick={() => setMode('manual')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${mode === 'manual' ? 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-gray-500'}`}
            >
              Manual
            </button>
          </div>

          {/* Smart Input */}
          {mode === 'smart' && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20">
                <p className="text-xs text-indigo-600 dark:text-indigo-400 font-medium mb-2">Contoh input:</p>
                <div className="flex flex-wrap gap-1.5">
                  {SMART_INPUT_EXAMPLES.map((ex) => (
                    <button
                      key={ex}
                      onClick={() => setSmartText(ex)}
                      className="px-2 py-1 bg-indigo-100 dark:bg-indigo-800/40 text-indigo-700 dark:text-indigo-300 rounded-lg text-xs hover:bg-indigo-200 dark:hover:bg-indigo-700/40 transition"
                    >
                      {ex}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <textarea
                  value={smartText}
                  onChange={(e) => setSmartText(e.target.value)}
                  placeholder="Ketik apa saja... contoh: 'Makan soto ayam 18rb'"
                  rows={3}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none text-sm"
                />
              </div>
              <button
                onClick={handleSmartInput}
                disabled={!smartText.trim() || aiProcessing}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium text-sm transition-all disabled:opacity-50"
              >
                {aiProcessing ? 'Memproses...' : 'Proses dengan AI'}
              </button>
              <button onClick={() => setMode('manual')} className="w-full text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition py-1">
                Atau isi manual →
              </button>
            </div>
          )}

          {/* Manual Form */}
          {mode === 'manual' && (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Type */}
              <div className="flex gap-2">
                {[
                  { value: 'EXPENSE', label: 'Pengeluaran' },
                  { value: 'INCOME_BONUS', label: 'Bonus' },
                ].map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, type: t.value as any }))}
                    className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-all ${
                      form.type === t.value
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                        : 'border-gray-200 dark:border-gray-700 text-gray-500'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Amount */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Nominal
                </label>
                <input
                  type="number"
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                  placeholder="0"
                  min={1}
                  required
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 font-mono"
                />
              </div>

              {/* Category */}
              {form.type === 'EXPENSE' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Kategori
                  </label>
                  <select
                    value={form.categoryId}
                    onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  >
                    <option value="">Pilih kategori (opsional)</option>
                    <optgroup label="Kebutuhan">
                      {categories.filter((c) => c.type === 'NEED').map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </optgroup>
                    <optgroup label="Keinginan">
                      {categories.filter((c) => c.type === 'WANT').map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </optgroup>
                  </select>
                </div>
              )}

              {/* Pocket */}
              {!(form.type === 'INCOME_BONUS' && hasAllocation) ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    {form.type === 'EXPENSE' ? 'Dari Kantong' : 'Masuk ke Kantong'}
                  </label>
                  <select
                    value={form.pocketId}
                    onChange={(e) => setForm((f) => ({ ...f, pocketId: e.target.value }))}
                    required
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  >
                    <option value="">Pilih kantong</option>
                    {pockets.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="p-3.5 rounded-xl bg-indigo-50/50 dark:bg-indigo-500/5 border border-indigo-100/50 dark:border-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs leading-relaxed">
                  ✨ Pemasukan bonus akan dibagikan otomatis ke kantong Anda sesuai target alokasi di bawah.
                </div>
              )}

              {/* Allocation Preview for Bonus */}
              {form.type === 'INCOME_BONUS' && hasAllocation && form.amount && (
                <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                  <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Alokasi: Rp {amountNum.toLocaleString('id-ID')}
                  </p>
                  <div className="space-y-1.5 text-xs">
                    {main > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Dompet Utama</span>
                        <span className="font-medium">{(amountNum * main / 100).toLocaleString('id-ID')} ({main}%)</span>
                      </div>
                    )}
                    {emergency > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Dana Darurat</span>
                        <span className="font-medium text-rose-600">{(amountNum * emergency / 100).toLocaleString('id-ID')} ({emergency}%)</span>
                      </div>
                    )}
                    {savings > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Tabungan</span>
                        <span className="font-medium text-emerald-600">{(amountNum * savings / 100).toLocaleString('id-ID')} ({savings}%)</span>
                      </div>
                    )}
                    {wishlist > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Wishlist</span>
                        <span className="font-medium text-indigo-600">{(amountNum * wishlist / 100).toLocaleString('id-ID')} ({wishlist}%)</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Tanggal
                </label>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                  required
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Catatan (opsional)
                </label>
                <input
                  type="text"
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="Tambahkan catatan..."
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium text-sm transition-all disabled:opacity-50"
              >
                {isSubmitting ? 'Menyimpan...' : 'Simpan Transaksi'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}