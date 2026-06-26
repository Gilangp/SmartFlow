import { useState } from 'react';
import toast from 'react-hot-toast';
import { Loader2, ArrowRightLeft, X } from 'lucide-react';

interface Pocket {
  id: string;
  name: string;
  balance: number;
}

interface TransferPocketModalProps {
  pockets: Pocket[];
  onClose: () => void;
  onSuccess: () => void;
  token: string;
}

function formatCurrency(amount: number): string {
  return `Rp ${amount.toLocaleString('id-ID')}`;
}

export default function TransferPocketModal({ pockets, onClose, onSuccess, token }: TransferPocketModalProps) {
  const [sourceId, setSourceId] = useState(pockets[0]?.id || '');
  const [targetId, setTargetId] = useState(pockets[1]?.id || '');
  const [amount, setAmount] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const sourcePocket = pockets.find(p => p.id === sourceId);
  const targetPocket = pockets.find(p => p.id === targetId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sourceId === targetId) return toast.error('Kantong asal dan tujuan tidak boleh sama');
    if (!amount || parseFloat(amount) <= 0) return toast.error('Nominal harus lebih dari 0');
    if (sourcePocket && parseFloat(amount) > sourcePocket.balance) {
      return toast.error('Saldo kantong asal tidak mencukupi');
    }

    setIsSaving(true);
    try {
      const res = await fetch('/api/pockets/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          sourceId,
          targetId,
          amount: parseFloat(amount)
        })
      });
      
      const data = await res.json();
      if (data.success) {
        toast.success('Transfer berhasil');
        onSuccess();
      } else {
        toast.error(data.message || 'Gagal transfer');
      }
    } catch (err) {
      toast.error('Terjadi kesalahan');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-md shadow-xl overflow-hidden animate-in slide-in-from-bottom-10 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-indigo-500" />
            Pindah Saldo
          </h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition">
            <X className="w-4 h-4" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Dari Kantong
              </label>
              <select
                value={sourceId}
                onChange={(e) => setSourceId(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm"
              >
                {pockets.map(p => (
                  <option key={p.id} value={p.id} disabled={p.balance <= 0}>
                    {p.name} ({formatCurrency(p.balance)})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-center -my-2 relative z-10">
              <div className="bg-white dark:bg-gray-900 p-1 rounded-full border border-gray-100 dark:border-gray-800">
                <div className="w-8 h-8 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center text-gray-400">
                  <ArrowRightLeft className="w-4 h-4 rotate-90" />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Ke Kantong
              </label>
              <select
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm"
              >
                {pockets.map(p => (
                  <option key={p.id} value={p.id} disabled={p.id === sourceId}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Nominal Transfer
            </label>
            <input
              type="number"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Contoh: 50000"
              min="1"
              max={sourcePocket?.balance || 0}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm font-mono"
            />
            {sourcePocket && (
              <p className="text-xs text-gray-500 mt-1">Maks: {formatCurrency(sourcePocket.balance)}</p>
            )}
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isSaving || !amount || parseFloat(amount) <= 0 || parseFloat(amount) > (sourcePocket?.balance || 0)}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {isSaving ? 'Memproses...' : 'Transfer Sekarang'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
