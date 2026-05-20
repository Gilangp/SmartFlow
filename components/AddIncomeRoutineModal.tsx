// components/AddIncomeRoutineModal.tsx
'use client';

import { useState, useEffect } from 'react';

interface Pocket {
  id: string;
  name: string;
  type: string;
}

interface PendingIncome {
  id: string;
  expectedDate: string;
  amount: number;
  month: number;
  year: number;
  pocketId: string;
  notes?: string;
}

interface UserAllocation {
  allocationEmergency: number;
  allocationSavings: number;
  allocationWishlist: number;
}

interface AddIncomeRoutineModalProps {
  onClose: () => void;
  onSuccess: () => void;
  paydayDate: number | null;
}

export default function AddIncomeRoutineModal({ onClose, onSuccess, paydayDate }: AddIncomeRoutineModalProps) {
  const [pockets, setPockets] = useState<Pocket[]>([]);
  const [pendingIncome, setPendingIncome] = useState<PendingIncome | null>(null);
  const [confirmingPending, setConfirmingPending] = useState(false);
  const [allocation, setAllocation] = useState<UserAllocation>({
    allocationEmergency: 0,
    allocationSavings: 0,
    allocationWishlist: 0,
  });
  const [form, setForm] = useState({
    amount: '',
    pocketId: '',
    date: '',
    notes: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const getToken = () => localStorage.getItem('sf-token');

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    Promise.all([
      fetch('/api/pockets', { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
      fetch('/api/income/pending', { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
      fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
    ]).then(([pocketData, pendingData, userData]) => {
      if (pocketData.success) {
        setPockets(pocketData.data);
        const mainPocket = pocketData.data.find((p: Pocket) => p.type === 'MAIN');
        if (mainPocket) setForm((f) => ({ ...f, pocketId: mainPocket.id }));
      }

      if (userData.success && userData.data) {
        setAllocation({
          allocationEmergency: userData.data.allocationEmergency || 0,
          allocationSavings: userData.data.allocationSavings || 0,
          allocationWishlist: userData.data.allocationWishlist || 0,
        });
      }

      if (pendingData.success && pendingData.data.length > 0) {
        const today = new Date();
        const currentMonth = today.getMonth() + 1;
        const currentYear = today.getFullYear();
        const currentMonthPending = pendingData.data.find(
          (p: PendingIncome) => p.month === currentMonth && p.year === currentYear
        );
        if (currentMonthPending) setPendingIncome(currentMonthPending);
      }
    });

    let defaultDate = new Date();
    if (paydayDate && paydayDate > 0 && paydayDate <= 31) {
      const today = new Date();
      const currentDay = today.getDate();
      if (currentDay <= paydayDate) {
        defaultDate = new Date(today.getFullYear(), today.getMonth(), paydayDate);
      } else {
        defaultDate = new Date(today.getFullYear(), today.getMonth() + 1, paydayDate);
      }
    }
    setForm((f) => ({ ...f, date: defaultDate.toISOString().split('T')[0] }));
  }, [paydayDate]);

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
      const url = confirmingPending && pendingIncome ? '/api/income/pending' : '/api/transactions';
      const body = confirmingPending && pendingIncome
        ? { transactionId: pendingIncome.id, amount: parseFloat(form.amount), action: 'confirm' }
        : { type: 'INCOME_ROUTINE', amount: parseFloat(form.amount), pocketId: form.pocketId, date: form.date, notes: form.notes || undefined };

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (data.success) {
        onSuccess();
        onClose();
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
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Tambah Gajian</h2>
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

          {/* Pending Income Alert */}
          {pendingIncome && !confirmingPending && (
            <div className="mb-5 p-3 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20">
              <p className="text-sm font-medium text-indigo-700 dark:text-indigo-300 mb-2">
                Ada gajian bulan ini yang belum dikonfirmasi
              </p>
              <div className="flex gap-2">
                <button onClick={() => setConfirmingPending(true)} className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition">
                  Konfirmasi
                </button>
                <button onClick={() => setPendingIncome(null)} className="flex-1 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium transition">
                  Buat Baru
                </button>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Nominal Gajian
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

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Masuk ke Kantong
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

            {/* Allocation Preview */}
            {hasAllocation && form.amount && (
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

            {!confirmingPending && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Catatan (opsional)
                </label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="Contoh: Gajian bulan ini"
                  rows={2}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none text-sm"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium text-sm transition-all disabled:opacity-50"
            >
              {isSubmitting ? 'Menyimpan...' : (confirmingPending ? 'Konfirmasi Gajian' : 'Simpan Gajian')}
            </button>

            {confirmingPending && (
              <button type="button" onClick={() => { setConfirmingPending(false); setPendingIncome(null); }} className="w-full py-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition">
                ← Kembali
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}