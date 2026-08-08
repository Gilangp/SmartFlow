// components/AddTransactionModal.tsx
'use client';

import { useState, useEffect } from 'react';
import { CategoryRecord } from '@/types';
import { Sparkles, Info, Camera, Image as ImageIcon, TrendingDown, TrendingUp, Gift, Calendar, X } from 'lucide-react';
import { compressImage } from '@/lib/image-helper';
import { formatNominalInput, cleanNominalInput } from '@/lib/utils';


interface Pocket {
  id: string;
  name: string;
  type: string;
  allocation: number;
  balance?: number;
}

interface AddTransactionModalProps {
  onClose: () => void;
  onSuccess: () => void;
  defaultType?: 'EXPENSE' | 'INCOME_ROUTINE' | 'INCOME_BONUS';
  prefill?: {
    amount?: number;
    date?: string;
    notes?: string;
    category?: string;
  };
}

const SMART_INPUT_EXAMPLES = [
  'Makan siang warteg 15rb',
  'Beli kuota internet 50000',
  'Ongkos gojek ke kampus 25k',
  'Kopi sama teman 35.000',
];

function getDateBadge(dateStr: string) {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + 'T00:00:00');
  target.setHours(0, 0, 0, 0);
  const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  const className = 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300';

  if (diffDays === 0) {
    return { label: 'Hari Ini', className };
  } else if (diffDays === -1) {
    return { label: 'Kemarin', className };
  } else if (diffDays === -2) {
    return { label: '2 Hari Lalu', className };
  } else if (diffDays < -2) {
    return { label: `${Math.abs(diffDays)} Hari Lalu`, className };
  } else if (diffDays === 1) {
    return { label: 'Besok', className };
  } else {
    return { label: `${diffDays} Hari Lagi`, className };
  }
}

export default function AddTransactionModal({ onClose, onSuccess, defaultType, prefill }: AddTransactionModalProps) {
  // If prefill is provided or defaultType is set, start directly in manual mode
  const [mode, setMode] = useState<'smart' | 'manual' | 'scan'>(prefill || defaultType ? 'manual' : 'smart');
  const [smartText, setSmartText] = useState('');
  const [aiProcessing, setAiProcessing] = useState(false);
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [pockets, setPockets] = useState<Pocket[]>([]);
  const [form, setForm] = useState({
    type: (defaultType || 'EXPENSE') as 'INCOME_ROUTINE' | 'INCOME_BONUS' | 'EXPENSE',
    amount: prefill?.amount ? String(prefill.amount) : '',
    categoryId: '',
    pocketId: '',
    date: prefill?.date || new Date().toISOString().split('T')[0],
    notes: prefill?.notes || '',
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
    ]).then(([catData, pktData]) => {
      if (catData.success) {
        setCategories(catData.data);
        if (prefill?.category && catData.data.length > 0) {
          const matched = catData.data.find(
            (c: CategoryRecord) => c.name.toLowerCase().includes(prefill.category!.toLowerCase()) ||
              prefill.category!.toLowerCase().includes(c.name.toLowerCase())
          );
          if (matched) {
            setForm((f) => ({ ...f, categoryId: matched.id, pocketId: matched.pocketId || f.pocketId }));
          }
        }
      }
      if (pktData.success) {
        setPockets(pktData.data);
        const mainPocket = pktData.data.find((p: Pocket) => p.type === 'MAIN');
        // If not prefilled with a category pocket, set default to main
        setForm((f) => {
           if (!f.pocketId && mainPocket) return { ...f, pocketId: mainPocket.id };
           return f;
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
        const targetCat = (extracted.category || '').toLowerCase();
        const matchedCat = categories.find((c) => {
          const cName = c.name.toLowerCase();
          if (cName === targetCat) return true;
          if (targetCat && (cName.includes(targetCat) || targetCat.includes(cName))) return true;
          if ((targetCat.includes('minum') || targetCat.includes('es teh') || targetCat.includes('kopi')) && 
              (cName.includes('makan') || cName.includes('minum') || cName.includes('kuliner') || cName.includes('jajan'))) return true;
          return false;
        }) || categories[0];

        setForm((f) => ({
          ...f,
          amount: String(extracted.amount || ''),
          categoryId: matchedCat?.id || f.categoryId,
          pocketId: matchedCat?.pocketId || f.pocketId,
          notes: extracted.notes || smartText,
          date: extracted.date || f.date,
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

  const handleScanReceipt = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAiProcessing(true);
    setError('');
    const token = getToken();

    try {
      const compressedDataUrl = await compressImage(file, {
        maxWidth: 1200,
        maxHeight: 1200,
        quality: 0.8,
        mimeType: 'image/webp',
      });
      const base64String = compressedDataUrl.split(',')[1];
      
      const res = await fetch('/api/ai/scan-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ imageBase64: base64String, mimeType: 'image/webp' }),
      });
      
      const data = await res.json();
        
        if (data.success && data.data) {
          const extracted = data.data;
          const matchedCat = categories.find(
            (c) => c.name.toLowerCase() === extracted.category?.toLowerCase() || 
                   extracted.category?.toLowerCase().includes(c.name.toLowerCase())
          );
          
          let notes = extracted.merchant;
          if (extracted.items && extracted.items.length > 0) {
             notes += ' - ' + extracted.items.map((i: any) => i.name).join(', ');
          }

          setForm((f) => ({
            ...f,
            amount: String(extracted.amount || ''),
            categoryId: matchedCat?.id || f.categoryId,
            pocketId: matchedCat?.pocketId || f.pocketId,
            notes: notes.substring(0, 200),
            date: extracted.date || f.date
          }));
          setMode('manual');
        } else {
          setError(data.message || 'Gagal membaca struk. Pastikan foto jelas.');
        }
        setAiProcessing(false);
    } catch {
      setError('Gagal memproses gambar. Coba lagi.');
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

  const totalAllocation = pockets.reduce((sum, p) => sum + (p.allocation || 0), 0);
  const hasAllocation = totalAllocation > 0;
  const amountNum = parseFloat(form.amount) || 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-800">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Tambah Transaksi</h2>
            {prefill && (
              <p className="text-xs text-indigo-650 dark:text-indigo-400 mt-0.5 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Data dari scan struk</span>
              </p>
            )}
          </div>

          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition">
            <X className="w-4 h-4" />
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
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${mode === 'smart' ? 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
            >
              Smart Input
            </button>
            <button
              onClick={() => setMode('scan')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${mode === 'scan' ? 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
            >
              Scan Struk
            </button>
            <button
              onClick={() => setMode('manual')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${mode === 'manual' ? 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
            >
              Manual
            </button>
          </div>

          {/* Scan Mode */}
          {mode === 'scan' && (
            <div className="space-y-4">
              <div className="p-6 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 bg-white dark:bg-gray-900 rounded-full flex items-center justify-center shadow-sm mb-4">
                  {aiProcessing ? (
                     <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                  ) : (
                     <Camera className="w-8 h-8 text-indigo-500" />
                  )}
                </div>
                <h3 className="text-gray-900 dark:text-white font-semibold mb-1">Scan Struk / Kwitansi</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs mb-6">
                  Foto struk belanjamu dan biarkan Gemini AI mengekstrak total harga dan item otomatis.
                </p>
                <div className="relative">
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleScanReceipt}
                    disabled={aiProcessing}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                  />
                  <button
                    disabled={aiProcessing}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-medium transition-all shadow-sm shadow-indigo-600/20 disabled:opacity-70 pointer-events-none"
                  >
                    <ImageIcon className="w-4 h-4" />
                    <span>{aiProcessing ? 'Menganalisis Struk...' : 'Pilih Foto / Kamera'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

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
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { value: 'EXPENSE', label: 'Pengeluaran', icon: TrendingDown },
                  { value: 'INCOME_ROUTINE', label: 'Pemasukan', icon: TrendingUp },
                  { value: 'INCOME_BONUS', label: 'Bonus', icon: Gift },
                ].map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, type: t.value as any }))}
                    className={`flex flex-col items-center gap-1 py-2.5 rounded-lg text-xs font-medium border transition-all ${
                      form.type === t.value
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                        : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <t.icon className="w-4 h-4" />
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Educational Info Card */}
              {form.type === 'EXPENSE' && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 text-xs text-rose-700 dark:text-rose-400 leading-relaxed">
                  <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  <span><strong>Pengeluaran</strong> — Mencatat belanjaan atau pengeluaran hari ini. Akan memotong saldo kantong dan mengurangi Jatah Harian.</span>
                </div>
              )}
              {form.type === 'INCOME_ROUTINE' && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 text-xs text-emerald-700 dark:text-emerald-400 leading-relaxed">
                  <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  <span><strong>Pemasukan Rutin</strong> — Uang saku bulanan / gaji tetap. Dibagi ke semua kantong sesuai alokasi, dan menjadi dasar perhitungan <strong>Jatah Harian</strong>.</span>
                </div>
              )}
              {form.type === 'INCOME_BONUS' && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20 text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
                  <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  <span><strong>Pemasukan Tambahan / Bonus</strong> — Uang kaget, hadiah, THR, dll. Dibagi ke kantong sesuai alokasi, namun <strong>tidak menaikkan Jatah Harian dasar</strong> agar kamu tetap hemat.</span>
                </div>
              )}

              {/* Amount */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Nominal
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={formatNominalInput(form.amount)}
                  onChange={(e) => setForm((f) => ({ ...f, amount: cleanNominalInput(e.target.value) }))}
                  placeholder="0"
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
                    onChange={(e) => {
                      const selectedCat = categories.find(c => c.id === e.target.value);
                      setForm((f) => ({ 
                        ...f, 
                        categoryId: e.target.value,
                        pocketId: selectedCat?.pocketId || f.pocketId 
                      }));
                    }}
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

              {/* Pocket Selector - only for EXPENSE */}
              {form.type === 'EXPENSE' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Dari Kantong
                  </label>
                  <select
                    value={form.pocketId}
                    onChange={(e) => setForm((f) => ({ ...f, pocketId: e.target.value }))}
                    required
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  >
                    <option value="">Pilih kantong</option>
                    {pockets.map((p) => (
                      <option key={p.id} value={p.id}>{p.name} (Saldo: Rp {(p.balance || 0).toLocaleString('id-ID')})</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="p-3.5 rounded-xl bg-indigo-50/50 dark:bg-indigo-500/5 border border-indigo-100/50 dark:border-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs flex items-start gap-2 leading-relaxed">
                  <Info className="w-4 h-4 text-indigo-500 flex-shrink-0 mt-0.5" />
                  <span>Uang masuk akan dibagikan otomatis ke semua kantong sesuai alokasi yang sudah kamu atur.</span>
                </div>
              )}

              {/* Real-time Allocation Preview for INCOME */}
              {(form.type === 'INCOME_ROUTINE' || form.type === 'INCOME_BONUS') && form.amount && (() => {
                const amountNum = parseFloat(form.amount) || 0;
                const otherPocketsTotal = pockets
                  .filter(p => p.type !== 'MAIN')
                  .reduce((sum, p) => sum + p.allocation, 0);
                const mainRemainder = Math.max(0, 100 - otherPocketsTotal);
                const allPocketsWithAlloc = [
                  ...pockets.filter(p => p.type !== 'MAIN' && p.allocation > 0),
                  ...(mainRemainder > 0 ? pockets.filter(p => p.type === 'MAIN') : []),
                ];
                return (
                  <div className="p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 space-y-2">
                    <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">Rincian Pembagian</p>
                    <div className="space-y-1.5">
                      {pockets.filter(p => p.type !== 'MAIN' && p.allocation > 0).map(p => (
                        <div key={p.id} className="flex justify-between text-xs">
                          <span className="text-gray-500">{p.name} ({p.allocation}%)</span>
                          <span className="font-semibold text-indigo-600 dark:text-indigo-400">Rp {(amountNum * p.allocation / 100).toLocaleString('id-ID')}</span>
                        </div>
                      ))}
                      {mainRemainder > 0 && pockets.filter(p => p.type === 'MAIN').map(p => (
                        <div key={p.id} className="flex justify-between text-xs border-t border-gray-200 dark:border-gray-700 pt-1.5 mt-1.5">
                          <span className="text-indigo-500 font-medium">{p.name} (Sisa {mainRemainder}%)</span>
                          <span className="font-semibold text-indigo-600 dark:text-indigo-400">Rp {(amountNum * mainRemainder / 100).toLocaleString('id-ID')}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Tanggal
                </label>
                <div className="relative block w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white flex items-center justify-between cursor-pointer hover:border-indigo-500/50 transition focus-within:ring-2 focus-within:ring-indigo-500/50">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Calendar className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                    <span className="font-medium text-sm truncate">
                      {form.date ? new Date(form.date + 'T00:00:00').toLocaleDateString('id-ID', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      }) : 'Pilih Tanggal'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {(() => {
                      const badge = getDateBadge(form.date);
                      return badge ? (
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${badge.className}`}>
                          {badge.label}
                        </span>
                      ) : null;
                    })()}
                  </div>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                    onClick={(e) => {
                      if (e.currentTarget.showPicker) {
                        try { e.currentTarget.showPicker(); } catch {}
                      }
                    }}
                    required
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                </div>
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