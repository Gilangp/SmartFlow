import { useState } from 'react';
import toast from 'react-hot-toast';
import { Loader2, AlertCircle, X } from 'lucide-react';
import { formatNominalInput, cleanNominalInput } from '@/lib/utils';

interface AddPocketModalProps {
  onClose: () => void;
  onSuccess: () => void;
  token: string;
  currentTotalAllocation: number;
}

const PRESET_GRADIENTS = [
  { value: 'from-indigo-600 to-indigo-800', display: 'bg-gradient-to-r from-indigo-600 to-indigo-800' },
  { value: 'from-rose-500 to-rose-700', display: 'bg-gradient-to-r from-rose-500 to-rose-700' },
  { value: 'from-emerald-500 to-emerald-700', display: 'bg-gradient-to-r from-emerald-500 to-emerald-700' },
  { value: 'from-amber-500 to-amber-700', display: 'bg-gradient-to-r from-amber-500 to-amber-700' },
  { value: 'from-violet-600 to-violet-800', display: 'bg-gradient-to-r from-violet-600 to-violet-800' },
  { value: 'from-blue-500 to-cyan-600', display: 'bg-gradient-to-r from-blue-500 to-cyan-600' },
  { value: 'from-fuchsia-500 to-pink-600', display: 'bg-gradient-to-r from-fuchsia-500 to-pink-600' },
  { value: 'from-orange-500 to-red-600', display: 'bg-gradient-to-r from-orange-500 to-red-600' },
  { value: 'from-teal-500 to-emerald-600', display: 'bg-gradient-to-r from-teal-500 to-emerald-600' },
  { value: 'from-slate-700 to-slate-900', display: 'bg-gradient-to-r from-slate-700 to-slate-900' },
];

export default function AddPocketModal({ onClose, onSuccess, token, currentTotalAllocation }: AddPocketModalProps) {
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [allocation, setAllocation] = useState('0');
  const [color, setColor] = useState(PRESET_GRADIENTS[0].value);
  const [isSaving, setIsSaving] = useState(false);

  const parsedAllocation = parseInt(allocation) || 0;
  const isOverAllocated = currentTotalAllocation + parsedAllocation > 100;
  const remainingAllocation = Math.max(0, 100 - currentTotalAllocation);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return toast.error('Nama kantong harus diisi');
    if (isOverAllocated) return toast.error(`Total alokasi tidak boleh lebih dari 100%. Sisa alokasi Anda: ${remainingAllocation}%`);

    setIsSaving(true);
    try {
      const res = await fetch('/api/pockets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name,
          targetAmount: targetAmount ? parseFloat(targetAmount) : null,
          allocation: parseInt(allocation) || 0,
          color,
          icon: 'Wallet'
        })
      });

      const data = await res.json();
      if (data.success) {
        toast.success('Kantong berhasil dibuat!');
        onSuccess();
      } else {
        toast.error(data.message || 'Gagal membuat kantong');
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
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Tambah Kantong Baru
          </h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition">
            <X className="w-4 h-4" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Nama Kantong *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: Liburan Jepang"
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Warna Tema
            </label>
            <div className="flex flex-wrap gap-3">
              {PRESET_GRADIENTS.map(c => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setColor(c.value)}
                  className={`w-10 h-10 rounded-full transition-all duration-200 ${c.display} ${color === c.value ? 'scale-110 ring-4 ring-offset-2 ring-indigo-500/50 dark:ring-offset-gray-900 shadow-lg' : 'hover:scale-105 shadow-sm'}`}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Alokasi Pemasukan (%)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={allocation}
                onChange={(e) => setAllocation(e.target.value)}
                min="0"
                max="100"
                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm"
              />
              <span className="text-gray-500 font-medium">%</span>
            </div>
            {isOverAllocated ? (
              <p className="text-xs text-rose-500 font-medium mt-1.5 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                Alokasi melebihi batas. Sisa alokasi yang tersedia: {remainingAllocation}%
              </p>
            ) : (
              <p className="text-xs text-gray-500 mt-1">Sisa alokasi saat ini: {remainingAllocation}%. Berapa persen yang ingin masuk otomatis ke kantong ini?</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Target Saldo (Opsional)
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={formatNominalInput(targetAmount)}
              onChange={(e) => setTargetAmount(cleanNominalInput(e.target.value))}
              placeholder="Contoh: 15.000.000"
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm font-mono"
            />
            <p className="text-xs text-gray-500 mt-1">Kosongkan jika tidak ada target kumpul dana.</p>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isSaving || isOverAllocated}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {isSaving ? 'Menyimpan...' : 'Buat Kantong'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
