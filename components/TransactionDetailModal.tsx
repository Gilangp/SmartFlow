// components/TransactionDetailModal.tsx
'use client';

import { TransactionRecord } from '@/types';
import { X, CheckCircle2, Copy, Check, Wallet, Tag, Calendar, Clock, FileText, Hash, Share2, Receipt, ArrowUpRight, ArrowDownRight, ArrowRightLeft } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';

interface TransactionDetailModalProps {
  transaction: TransactionRecord;
  onClose: () => void;
}

function formatCurrencyFull(amount: number): string {
  return `Rp ${amount.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatTime(createdAt: string): string {
  return new Date(createdAt).toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function TransactionDetailModal({ transaction: tx, onClose }: TransactionDetailModalProps) {
  const [copiedId, setCopiedId] = useState(false);
  const [copiedReceipt, setCopiedReceipt] = useState(false);

  const isTransferOut = tx.type === 'TRANSFER' && (tx.notes?.toLowerCase().includes('transfer to') || tx.notes?.toLowerCase().includes('transfer ke'));
  const isTransferIn  = tx.type === 'TRANSFER' && (tx.notes?.toLowerCase().includes('received from') || tx.notes?.toLowerCase().includes('transfer dari'));
  const isExpense     = tx.type === 'EXPENSE' || isTransferOut;
  const isIncome      = tx.type.startsWith('INCOME') || isTransferIn;

  const typeLabel =
    tx.type === 'EXPENSE'        ? 'Pengeluaran' :
    tx.type === 'INCOME_ROUTINE' ? 'Pemasukan Rutin' :
    tx.type === 'INCOME_BONUS'   ? 'Pemasukan Bonus' :
    isTransferOut                ? 'Transfer Keluar' :
    isTransferIn                 ? 'Transfer Masuk' : 'Transfer';

  const sign = isIncome ? '+' : isExpense ? '-' : '';

  const amountColorClass = isIncome
    ? 'text-emerald-600 dark:text-emerald-400'
    : isExpense
    ? 'text-rose-600 dark:text-rose-400'
    : 'text-indigo-600 dark:text-indigo-400';

  const amountBgClass = isIncome
    ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20'
    : isExpense
    ? 'bg-rose-50 dark:bg-rose-500/10 border-rose-100 dark:border-rose-500/20'
    : 'bg-indigo-50 dark:bg-indigo-500/10 border-indigo-100 dark:border-indigo-500/20';

  const Icon = isExpense ? ArrowDownRight : isIncome ? ArrowUpRight : ArrowRightLeft;

  const handleCopyId = () => {
    navigator.clipboard.writeText(tx.id).then(() => {
      setCopiedId(true);
      toast.success('ID Transaksi disalin!');
      setTimeout(() => setCopiedId(false), 2000);
    });
  };

  const handleShareReceipt = async () => {
    const text = `
=== BUKTI TRANSAKSI SMARTFLOW ===
Status  : BERHASIL
Jenis   : ${typeLabel}
Nominal : ${sign}${formatCurrencyFull(tx.amount)}
Kategori: ${tx.category || 'Lainnya'} ${tx.categoryType ? `(${tx.categoryType === 'NEED' ? 'Kebutuhan' : 'Keinginan'})` : ''}
Kantong : ${tx.pocket}
Tanggal : ${formatDate(tx.date)} (${formatTime(tx.createdAt)})
${tx.notes ? `Catatan : ${tx.notes}\n` : ''}ID Tx   : ${tx.id}
=================================
    `.trim();

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: 'Bukti Transaksi SmartFlow',
          text: text,
        });
        toast.success('Bukti transaksi dibagikan!');
        return;
      } catch (err: any) {
        // Jika user cancel atau error, fallback ke copy clipboard di bawah
      }
    }

    navigator.clipboard.writeText(text).then(() => {
      setCopiedReceipt(true);
      toast.success('Bukti transaksi disalin ke clipboard!');
      setTimeout(() => setCopiedReceipt(false), 2000);
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-end sm:items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white dark:bg-gray-900 rounded-3xl w-full max-w-md shadow-2xl border border-gray-100 dark:border-gray-800 overflow-hidden animate-in slide-in-from-bottom-6 duration-300">
        
        {/* Header Section */}
        <div className="relative pt-6 pb-5 px-6 text-center border-b border-gray-100 dark:border-gray-800/80 bg-gradient-to-b from-gray-50/80 to-white dark:from-gray-800/40 dark:to-gray-900">
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-5 right-5 w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-gray-800 dark:hover:text-white flex items-center justify-center transition-colors active:scale-95"
            aria-label="Tutup"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Receipt Brand Tag */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-[11px] font-bold tracking-wider uppercase mb-3">
            <Receipt className="w-3.5 h-3.5" /> E-Receipt SmartFlow
          </div>

          {/* Success Status Badge */}
          <div className="flex items-center justify-center gap-1.5 mb-2">
            <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center shadow-sm shadow-emerald-500/30">
              <CheckCircle2 className="w-3.5 h-3.5 text-white stroke-[2.5]" />
            </div>
            <span className="text-sm font-bold text-gray-900 dark:text-white">Transaksi Berhasil</span>
          </div>

          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-3">{typeLabel}</p>

          {/* Amount Box */}
          <div className={`py-3 px-5 rounded-2xl inline-flex items-center gap-2 border ${amountBgClass} shadow-sm`}>
            <Icon className={`w-6 h-6 ${amountColorClass}`} strokeWidth={2.5} />
            <span className={`text-2xl sm:text-3xl font-black tracking-tight ${amountColorClass}`}>
              {sign}{formatCurrencyFull(tx.amount)}
            </span>
          </div>
        </div>

        {/* Structured Details Box (Apple Pay / Revolut style) */}
        <div className="p-6 space-y-4">
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-4 border border-gray-100 dark:border-gray-800 space-y-3.5">
            
            {/* Kategori */}
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-gray-500 dark:text-gray-400 text-xs flex items-center gap-1.5 font-medium">
                <Tag className="w-3.5 h-3.5 text-gray-400" />
                Kategori
              </span>
              <div className="text-right font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
                <span>{tx.category || 'Lainnya'}</span>
                {tx.categoryType && (
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                    tx.categoryType === 'NEED'
                      ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300'
                      : 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300'
                  }`}>
                    {tx.categoryType === 'NEED' ? 'Need' : 'Want'}
                  </span>
                )}
              </div>
            </div>

            {/* Kantong */}
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-gray-500 dark:text-gray-400 text-xs flex items-center gap-1.5 font-medium">
                <Wallet className="w-3.5 h-3.5 text-gray-400" />
                Sumber / Kantong
              </span>
              <span className="font-semibold text-gray-900 dark:text-white text-right">
                {tx.pocket}
              </span>
            </div>

            {/* Tanggal & Waktu */}
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-gray-500 dark:text-gray-400 text-xs flex items-center gap-1.5 font-medium">
                <Calendar className="w-3.5 h-3.5 text-gray-400" />
                Waktu Transaksi
              </span>
              <span className="font-medium text-gray-800 dark:text-gray-200 text-xs text-right">
                {formatDate(tx.date)} • {formatTime(tx.createdAt)}
              </span>
            </div>

            {/* Catatan / Merchant */}
            {tx.notes && (
              <div className="pt-2 border-t border-gray-200/60 dark:border-gray-700/60">
                <span className="text-gray-500 dark:text-gray-400 text-xs flex items-center gap-1.5 font-medium mb-1">
                  <FileText className="w-3.5 h-3.5 text-gray-400" />
                  Catatan / Merchant
                </span>
                <p className="text-sm font-medium text-gray-900 dark:text-white bg-white dark:bg-gray-800 p-2.5 rounded-xl border border-gray-200/50 dark:border-gray-700/50 italic">
                  &ldquo;{tx.notes}&rdquo;
                </p>
              </div>
            )}

            {/* ID Transaksi */}
            <div className="pt-2 border-t border-gray-200/60 dark:border-gray-700/60 flex items-center justify-between gap-3">
              <span className="text-gray-500 dark:text-gray-400 text-xs flex items-center gap-1.5 font-medium">
                <Hash className="w-3.5 h-3.5 text-gray-400" />
                ID Referensi
              </span>
              <button
                onClick={handleCopyId}
                className="flex items-center gap-1 text-xs font-mono text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors bg-white dark:bg-gray-800 px-2.5 py-1 rounded-lg border border-gray-200/60 dark:border-gray-700/60 group"
                title="Salin ID"
              >
                <span className="truncate max-w-[130px]">{tx.id}</span>
                {copiedId ? (
                  <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                ) : (
                  <Copy className="w-3.5 h-3.5 flex-shrink-0 opacity-70 group-hover:opacity-100" />
                )}
              </button>
            </div>

          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <button
              onClick={handleShareReceipt}
              className="py-3 px-4 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-500/30 rounded-xl font-semibold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
            >
              {copiedReceipt ? <Check className="w-4 h-4 text-emerald-500" /> : <Share2 className="w-4 h-4" />}
              <span>{copiedReceipt ? 'Tersalin!' : 'Bagikan Bukti'}</span>
            </button>

            <button
              onClick={onClose}
              className="py-3 px-4 bg-gray-900 hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-100 text-white dark:text-gray-900 rounded-xl font-semibold text-xs sm:text-sm transition-all flex items-center justify-center active:scale-[0.98] shadow-md shadow-gray-900/10 dark:shadow-none"
            >
              Tutup
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
