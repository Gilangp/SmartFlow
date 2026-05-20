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

    // Fetch pockets and user data (for allocation)
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

      // Set allocation from user data
      if (userData.success && userData.data) {
        setAllocation({
          allocationEmergency: userData.data.allocationEmergency || 0,
          allocationSavings: userData.data.allocationSavings || 0,
          allocationWishlist: userData.data.allocationWishlist || 0,
        });
      }

      // Check for current month pending income
      if (pendingData.success && pendingData.data.length > 0) {
        const today = new Date();
        const currentMonth = today.getMonth() + 1;
        const currentYear = today.getFullYear();

        const currentMonthPending = pendingData.data.find(
          (p: PendingIncome) => p.month === currentMonth && p.year === currentYear
        );

        if (currentMonthPending) {
          setPendingIncome(currentMonthPending);
        }
      }
    });

    // Calculate default date based on paydayDate
    let defaultDate = new Date();
    if (paydayDate && paydayDate > 0 && paydayDate <= 31) {
      const today = new Date();
      const currentDay = today.getDate();
      const currentMonth = today.getMonth();
      const currentYear = today.getFullYear();

      if (currentDay <= paydayDate) {
        defaultDate = new Date(currentYear, currentMonth, paydayDate);
      } else {
        defaultDate = new Date(currentYear, currentMonth + 1, paydayDate);
      }
    }

    setForm((f) => ({
      ...f,
      date: defaultDate.toISOString().split('T')[0],
    }));
  }, [paydayDate]);

  const handleConfirmPending = () => {
    if (!pendingIncome) return;
    setConfirmingPending(true);
    setForm((f) => ({
      ...f,
      pocketId: pendingIncome.pocketId,
      date: pendingIncome.expectedDate,
    }));
  };

  const handleCreateNew = () => {
    setConfirmingPending(false);
    setPendingIncome(null);
    setForm((f) => ({
      ...f,
      amount: '',
      notes: '',
    }));
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
      const url = confirmingPending && pendingIncome
        ? '/api/income/pending'
        : '/api/transactions';

      const body = confirmingPending && pendingIncome
        ? {
            transactionId: pendingIncome.id,
            amount: parseFloat(form.amount),
            action: 'confirm',
          }
        : {
            type: 'INCOME_ROUTINE',
            amount: parseFloat(form.amount),
            pocketId: form.pocketId,
            date: form.date,
            notes: form.notes || undefined,
          };

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
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

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal-content">
        <div className="modal-header">
          <h2 className="text-lg font-bold text-surface-900 dark:text-white">
            💰 Terima Gajian / Pemasukan Rutin
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-surface-100 dark:hover:bg-surface-700 transition-all"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-rose-100 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-700/50 text-rose-600 dark:text-rose-300 text-sm">
              {error}
            </div>
          )}

          {/* Show pending income option if exists */}
          {pendingIncome && !confirmingPending && (
            <div className="mb-6 space-y-3">
              <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700/30">
                <p className="text-sm text-blue-700 dark:text-blue-300 font-semibold mb-2">
                  Ada gajian bulan ini yang belum dikonfirmasi!
                </p>
                <p className="text-xs text-blue-600 dark:text-blue-400 mb-3">
                  Sistem otomatis membuat catatan gajian untuk tanggal gajian mu. Konfirmasi atau buat baru.
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleConfirmPending}
                    className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-sm transition-all"
                  >
                    ✅ Konfirmasi Gajian
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateNew}
                    className="flex-1 py-2.5 bg-blue-100 dark:bg-blue-800/30 hover:bg-blue-200 dark:hover:bg-blue-800/50 text-blue-600 dark:text-blue-300 rounded-lg font-semibold text-sm transition-all"
                  >
                    Buat Baru
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="mb-6 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700/30">
            <p className="text-sm text-emerald-700 dark:text-emerald-300">
              <span className="font-semibold">Tip:</span> Tanggal otomatis diisi sesuai
              tanggal gajian mu. Ubah kalau gajian terlambat atau maju.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Amount */}
            <div>
              <label className="form-label">Nominal Gajian (Rp)</label>
              <input
                id="income-amount"
                type="number"
                value={form.amount}
                onChange={(e) =>
                  setForm((f) => ({ ...f, amount: e.target.value }))
                }
                placeholder="0"
                min={1}
                required
                className="form-input font-mono text-lg"
              />
            </div>

            {/* Pocket */}
            <div>
              <label className="form-label">Masuk ke Kantong</label>
              <select
                id="income-pocket"
                value={form.pocketId}
                onChange={(e) =>
                  setForm((f) => ({ ...f, pocketId: e.target.value }))
                }
                required
                className="form-select"
              >
                <option value="">Pilih kantong</option>
                {pockets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Allocation Preview */}
            {form.amount && (
              <div className="p-4 rounded-xl bg-gradient-to-br from-primary-50 to-accent-50 dark:from-primary-900/20 dark:to-accent-900/20 border border-primary-200 dark:border-primary-700/30">
                <p className="text-xs font-semibold text-primary-700 dark:text-primary-300 mb-3">
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
              <label className="form-label">Tanggal Terima</label>
              <input
                id="income-date"
                type="date"
                value={form.date}
                onChange={(e) =>
                  setForm((f) => ({ ...f, date: e.target.value }))
                }
                required
                className="form-input"
              />
            </div>

            {/* Notes */}
            {!confirmingPending && (
              <div>
                <label className="form-label">Catatan (opsional)</label>
                <textarea
                  id="income-notes"
                  value={form.notes}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, notes: e.target.value }))
                  }
                  placeholder="Contoh: Gajian Mei 2026, Bonus akhir kuartal, dll"
                  rows={2}
                  className="form-input resize-none"
                />
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl font-bold text-sm disabled:opacity-50 transition-all active:scale-95 shadow-lg"
            >
              {isSubmitting ? 'Menyimpan...' : confirmingPending ? '✅ Konfirmasi Gajian' : '✅ Simpan Pemasukan'}
            </button>

            {confirmingPending && (
              <button
                type="button"
                onClick={handleCreateNew}
                className="w-full py-2.5 text-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                ← Kembali
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
