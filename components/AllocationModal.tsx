import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Loader2, Percent, AlertCircle } from 'lucide-react';
import * as Icons from 'lucide-react';

interface Pocket {
  id: string;
  name: string;
  allocation: number;
  color?: string;
  icon?: string;
}

interface AllocationModalProps {
  pockets: Pocket[];
  onClose: () => void;
  onSuccess: () => void;
  token: string;
}

export default function AllocationModal({ pockets, onClose, onSuccess, token }: AllocationModalProps) {
  const [allocations, setAllocations] = useState<{ id: string; value: number }[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setAllocations(pockets.map(p => ({ id: p.id, value: p.allocation })));
  }, [pockets]);

  const handleAllocationChange = (id: string, value: string) => {
    const numValue = parseInt(value) || 0;
    // Don't clamp here so they can type 100 easily, but we'll warn if > 100
    setAllocations(prev => prev.map(a => a.id === id ? { ...a, value: numValue } : a));
  };



  const totalAllocation = allocations.reduce((sum, a) => sum + a.value, 0);
  const isOverAllocated = totalAllocation > 100;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isOverAllocated) {
      return toast.error('Total alokasi tidak boleh lebih dari 100%');
    }

    setIsSaving(true);
    try {
      // Update each pocket sequentially
      for (const alloc of allocations) {
        const pocket = pockets.find(p => p.id === alloc.id);
        if (pocket && pocket.allocation !== alloc.value) {
          await fetch(`/api/pockets/${alloc.id}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ allocation: alloc.value })
          });
        }
      }

      toast.success('Alokasi berhasil diperbarui');
      onSuccess();
    } catch (err) {
      toast.error('Gagal menyimpan alokasi');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-900 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in slide-in-from-bottom-10 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200 border border-gray-100 dark:border-gray-800 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-white dark:bg-gray-900 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center">
              <Percent className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Alokasi Pemasukan</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Atur porsi untuk setiap kantong</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:text-gray-300 dark:hover:bg-gray-800 transition-colors">
            ✕
          </button>
        </div>
        
        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          <div className="space-y-4">
            {pockets.map(pocket => {
              const alloc = allocations.find(a => a.id === pocket.id)?.value || 0;
              const IconComponent = (Icons as any)[pocket.icon || 'Wallet'] || Icons.Wallet;
              const color = pocket.color || '#6366f1';

              return (
                <div key={pocket.id} className="flex items-center justify-between gap-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800 transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shadow-sm" style={{ backgroundColor: `${color}15`, color: color }}>
                      <IconComponent className="w-4 h-4" />
                    </div>
                    <span className="font-medium text-sm text-gray-900 dark:text-gray-100">{pocket.name}</span>
                  </div>
                  
                  {/* Number Input Container */}
                  <div className="flex items-center gap-2 w-24 shrink-0">
                    <input
                      type="number"
                      value={alloc}
                      onChange={(e) => handleAllocationChange(pocket.id, e.target.value)}
                      min="0"
                      max="100"
                      className="w-full px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-right text-sm font-mono"
                    />
                    <span className="text-gray-500 text-sm font-medium">%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer (Total & Save) */}
        <div className="p-6 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 sticky bottom-0">
          <div className="mb-5">
            <div className="flex items-end justify-between mb-2">
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Alokasi</span>
              <div className="flex items-baseline gap-1">
                <span className={`text-2xl font-black font-mono tracking-tight ${isOverAllocated ? 'text-rose-500' : 'text-indigo-600 dark:text-indigo-400'}`}>
                  {totalAllocation}
                </span>
                <span className="text-sm font-bold text-gray-400 dark:text-gray-500">/ 100%</span>
              </div>
            </div>

            {/* Total Progress Bar */}
            <div className="w-full h-2.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden flex">
              {isOverAllocated ? (
                <div className="h-full bg-rose-500 w-full transition-all duration-300" />
              ) : (
                allocations.map((a, i) => {
                  const pocket = pockets.find(p => p.id === a.id);
                  if (!pocket || a.value === 0) return null;
                  return (
                    <div 
                      key={a.id} 
                      className="h-full transition-all duration-300"
                      style={{ 
                        width: `${a.value}%`, 
                        backgroundColor: pocket.color || '#6366f1',
                        borderRight: i < allocations.length - 1 ? '2px solid rgba(255,255,255,0.2)' : 'none'
                      }}
                    />
                  );
                })
              )}
            </div>
            
            {isOverAllocated && (
              <div className="mt-2.5 flex items-start gap-1.5 text-rose-500 dark:text-rose-400 text-xs font-medium">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>Alokasi melebihi batas 100%. Kurangi {totalAllocation - 100}%.</span>
              </div>
            )}
          </div>

          <button
            onClick={handleSubmit}
            disabled={isSaving || isOverAllocated}
            className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2 active:scale-[0.98]"
          >
            {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
            {isSaving ? 'Menyimpan...' : 'Simpan Alokasi'}
          </button>
        </div>
      </div>
    </div>
  );
}
