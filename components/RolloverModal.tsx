'use client';

import { useState } from 'react';
import { PiggyBank, Target, RefreshCw, PartyPopper, ChevronRight } from 'lucide-react';

interface RolloverModalProps {
  performanceId: string;
  surplus: number;
  onClose: () => void;
  onSuccess: () => void;
}

export default function RolloverModal({ performanceId, surplus, onClose, onSuccess }: RolloverModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleAction = async (action: 'TRANSFER' | 'CARRY_OVER', targetPocketType?: 'SAVINGS' | 'WISHLIST') => {
    setIsSubmitting(true);
    setError('');
    const token = localStorage.getItem('sf-token');
    
    try {
      const res = await fetch('/api/transactions/rollover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ performanceId, action, targetPocketType }),
      });
      const data = await res.json();
      if (data.success) {
        onSuccess();
      } else {
        setError(data.message || 'Gagal memproses rollover');
      }
    } catch {
      setError('Terjadi kesalahan. Coba lagi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return `Rp ${amount.toLocaleString('id-ID')}`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-md shadow-xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200">
        
        <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 p-6 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full bg-white/10 opacity-50 flex items-center justify-center">
             {/* decorative background */}
          </div>
          <div className="relative z-10">
            <div className="flex items-center justify-center gap-2 mb-1">
              <PartyPopper className="w-5 h-5 text-white" />
              <h2 className="text-white text-xl font-bold">Hebat! Anda Berhemat</h2>
            </div>
            <p className="text-emerald-50 text-sm">Kemarin Anda berhasil menyisakan jatah harian sebesar:</p>
            <p className="text-3xl font-black text-white mt-3">{formatCurrency(surplus)}</p>
          </div>
        </div>

        <div className="p-5">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 text-rose-600 dark:text-rose-400 text-sm text-center">
              {error}
            </div>
          )}

          <p className="text-sm text-gray-700 dark:text-gray-300 text-center mb-5 font-medium">
            Mau diapakan sisa uang ini?
          </p>

          <div className="space-y-3">
            <button
              onClick={() => handleAction('TRANSFER', 'SAVINGS')}
              disabled={isSubmitting}
              className="w-full flex items-center justify-between p-4 rounded-xl border-2 border-emerald-100 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-500/5 hover:bg-emerald-100 dark:hover:bg-emerald-500/10 transition-colors disabled:opacity-50"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-800 flex items-center justify-center">
                  <PiggyBank className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-emerald-900 dark:text-emerald-100">Tabung (Savings)</p>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400">Pindahkan ke Tabungan Aset</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-emerald-500" />
            </button>

            <button
              onClick={() => handleAction('TRANSFER', 'WISHLIST')}
              disabled={isSubmitting}
              className="w-full flex items-center justify-between p-4 rounded-xl border-2 border-indigo-100 dark:border-indigo-900 bg-indigo-50 dark:bg-indigo-500/5 hover:bg-indigo-100 dark:hover:bg-indigo-500/10 transition-colors disabled:opacity-50"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-800 flex items-center justify-center">
                  <Target className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-indigo-900 dark:text-indigo-100">Wishlist</p>
                  <p className="text-xs text-indigo-600 dark:text-indigo-400">Pindahkan ke target impian</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-indigo-500" />
            </button>

            <button
              onClick={() => handleAction('CARRY_OVER')}
              disabled={isSubmitting}
              className="w-full flex items-center justify-between p-4 rounded-xl border-2 border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                  <RefreshCw className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-gray-900 dark:text-white">Akumulasi Saja</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Biarkan menumpuk di Dompet Utama</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </button>
          </div>
          
          <button 
            onClick={onClose}
            disabled={isSubmitting}
            className="w-full mt-4 py-2 text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            Lewati untuk saat ini
          </button>
        </div>
      </div>
    </div>
  );
}
