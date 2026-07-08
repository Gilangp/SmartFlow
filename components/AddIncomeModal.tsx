// components/AddIncomeModal.tsx
'use client';

import { useState, useEffect } from 'react';
import { Info, TrendingUp, Gift, X, Calendar } from 'lucide-react';
import { formatNominalInput, cleanNominalInput } from '@/lib/utils';

interface Pocket {
  id: string;
  name: string;
  type: string;
  allocation: number;
}

interface AddIncomeModalProps {
  onClose: () => void;
  onSuccess: () => void;
  defaultType?: 'INCOME_ROUTINE' | 'INCOME_BONUS';
}

const SMART_INPUT_EXAMPLES = [
  'Gaji bulanan 3500000',
  'Bonus project 500rb kemarin',
  'Dapat transferan ortu 500k 2 hari lalu',
  'Uang saku minggu ini 250rb',
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

export default function AddIncomeModal({ onClose, onSuccess, defaultType }: AddIncomeModalProps) {
  const [mode, setMode] = useState<'smart' | 'manual'>('smart');
  const [smartText, setSmartText] = useState('');
  const [aiProcessing, setAiProcessing] = useState(false);
  const [pockets, setPockets] = useState<Pocket[]>([]);
  const [form, setForm] = useState({
    type: defaultType || 'INCOME_ROUTINE',
    amount: '',
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

    fetch('/api/pockets', { headers })
      .then((r) => r.json())
      .then((pktData) => {
        if (pktData.success) {
          setPockets(pktData.data);
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
        const lowerText = smartText.toLowerCase();
        let incomeType: 'INCOME_ROUTINE' | 'INCOME_BONUS' = form.type as 'INCOME_ROUTINE' | 'INCOME_BONUS';
        if (lowerText.includes('gaji') || lowerText.includes('rutin') || lowerText.includes('bulanan') || lowerText.includes('saku') || lowerText.includes('kiriman')) {
          incomeType = 'INCOME_ROUTINE';
        } else if (lowerText.includes('bonus') || lowerText.includes('kaget') || lowerText.includes('project') || lowerText.includes('hadiah') || lowerText.includes('thr') || lowerText.includes('freelance')) {
          incomeType = 'INCOME_BONUS';
        }
        setForm((f) => ({
          ...f,
          type: incomeType,
          amount: String(extracted.amount || ''),
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.amount || !form.date) {
      setError('Nominal dan tanggal wajib diisi');
      return;
    }
    setIsSubmitting(true);
    setError('');
    const token = getToken();
    const mainPocket = pockets.find((p) => p.type === 'MAIN');
    const pocketId = mainPocket?.id || (pockets[0]?.id || '');

    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          type: form.type,
          amount: parseFloat(form.amount),
          pocketId: pocketId,
          date: form.date,
          notes: form.notes || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        onSuccess();
      } else {
        setError(data.message || 'Gagal menyimpan pemasukan');
      }
    } catch {
      setError('Terjadi kesalahan. Coba lagi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const amountNum = parseFloat(form.amount) || 0;
  const otherPocketsTotal = pockets
    .filter((p) => p.type !== 'MAIN')
    .reduce((sum, p) => sum + (p.allocation || 0), 0);
  const mainRemainder = Math.max(0, 100 - otherPocketsTotal);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-xl border border-emerald-500/20">
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-800">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-500" />
              Catat Pemasukan
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">Pendapatan disebarkan otomatis ke kantong-kantongmu</p>
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
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${mode === 'smart' ? 'bg-white dark:bg-gray-700 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
            >
              Smart Input
            </button>
            <button
              onClick={() => setMode('manual')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${mode === 'manual' ? 'bg-white dark:bg-gray-700 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
            >
              Manual
            </button>
          </div>

          {/* Smart Input Mode */}
          {mode === 'smart' && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20">
                <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium mb-2">Contoh input pemasukan:</p>
                <div className="flex flex-wrap gap-1.5">
                  {SMART_INPUT_EXAMPLES.map((ex) => (
                    <button
                      key={ex}
                      onClick={() => setSmartText(ex)}
                      className="px-2 py-1 bg-emerald-100 dark:bg-emerald-800/40 text-emerald-700 dark:text-emerald-300 rounded-lg text-xs hover:bg-emerald-200 dark:hover:bg-emerald-700/40 transition"
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
                  placeholder="Ketik apa saja... contoh: 'Gaji bulan ini 3,5jt kemarin'"
                  rows={3}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 resize-none text-sm"
                />
              </div>
              <button
                onClick={handleSmartInput}
                disabled={!smartText.trim() || aiProcessing}
                className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-lg font-medium text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20"
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
              {/* Type Toggle */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 dark:bg-gray-800/80 rounded-xl">
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, type: 'INCOME_ROUTINE' }))}
                  className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                    form.type === 'INCOME_ROUTINE'
                      ? 'bg-white dark:bg-gray-700 text-emerald-600 dark:text-emerald-400 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  <TrendingUp className="w-4 h-4" />
                  Pemasukan Rutin (Gaji)
                </button>
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, type: 'INCOME_BONUS' }))}
                  className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                    form.type === 'INCOME_BONUS'
                      ? 'bg-white dark:bg-gray-700 text-amber-600 dark:text-amber-400 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  <Gift className="w-4 h-4" />
                  Pemasukan Tambahan
                </button>
              </div>

              {/* Educational Info Card */}
              {form.type === 'INCOME_ROUTINE' ? (
                <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 text-xs text-emerald-700 dark:text-emerald-400 leading-relaxed">
                  <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span><strong>Gaji Tetap / Pendapatan Rutin</strong> — Uang akan dibagi ke seluruh kantong sesuai persentase alokasi, serta <strong>meningkatkan Jatah Harian</strong> kamu.</span>
                </div>
              ) : (
                <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20 text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
                  <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span><strong>Bonus / Uang Kaget / Hadiah</strong> — Dibagi sesuai alokasi kantong, namun <strong>tidak menaikkan Jatah Harian dasar</strong> agar kamu tetap konsisten berhemat.</span>
                </div>
              )}

              {/* Amount */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Nominal Pemasukan
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={formatNominalInput(form.amount)}
                  onChange={(e) => setForm((f) => ({ ...f, amount: cleanNominalInput(e.target.value) }))}
                  placeholder="0"
                  required
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-mono text-lg font-bold text-emerald-600 dark:text-emerald-400"
                />
              </div>

              {/* Real-time Allocation Preview */}
              {form.amount && amountNum > 0 && (
                <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-500/10 space-y-2.5 animate-fadeIn">
                  <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
                    <span>Pratinjau Pembagian Uang ({form.type === 'INCOME_ROUTINE' ? 'Gaji' : 'Bonus'}):</span>
                    <span className="font-mono">Rp {amountNum.toLocaleString('id-ID')}</span>
                  </p>
                  <div className="space-y-2 pt-1 border-t border-emerald-500/20">
                    {pockets.filter((p) => p.type !== 'MAIN' && (p.allocation || 0) > 0).map((p) => (
                      <div key={p.id} className="flex justify-between items-center text-xs">
                        <span className="text-gray-600 dark:text-gray-300">{p.name} ({p.allocation}%)</span>
                        <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                          +Rp {((amountNum * p.allocation) / 100).toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    ))}
                    {mainRemainder > 0 && pockets.filter((p) => p.type === 'MAIN').map((p) => (
                      <div key={p.id} className="flex justify-between items-center text-xs border-t border-emerald-500/20 pt-1.5 mt-1">
                        <span className="text-emerald-700 dark:text-emerald-300 font-semibold">{p.name} (Sisa {mainRemainder}%)</span>
                        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          +Rp {((amountNum * mainRemainder) / 100).toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Tanggal Diterima
                </label>
                <div className="relative block w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white flex items-center justify-between cursor-pointer hover:border-emerald-500/50 transition focus-within:ring-2 focus-within:ring-emerald-500/50">
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
                  Catatan / Keterangan (opsional)
                </label>
                <input
                  type="text"
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="contoh: Gaji Bulan Juni / Bonus Project"
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl font-bold text-sm shadow-lg shadow-emerald-600/20 transition-all active:scale-[0.98] disabled:opacity-50"
              >
                {isSubmitting ? 'Mendistribusikan...' : 'Catat & Bagikan Otomatis'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

