'use client';

import { Wrench, RefreshCw } from 'lucide-react';

export default function MaintenancePage() {
  const handleReload = () => {
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center px-4 py-8 transition-colors duration-300">
      <div className="w-full max-w-md text-center">
        {/* Minimal Icon Container */}
        <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/50 flex items-center justify-center mx-auto mb-6">
          <Wrench className="w-6 h-6 text-amber-600 dark:text-amber-400" />
        </div>

        {/* Content */}
        <h1 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
          Pemeliharaan Sistem
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm max-w-xs mx-auto mb-8 leading-relaxed">
          Finto sedang diperbarui untuk meningkatkan kualitas layanan. Kami akan segera kembali setelah proses selesai.
        </p>

        {/* Actions */}
        <button
          onClick={handleReload}
          className="px-5 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 active:scale-95 mx-auto"
        >
          <RefreshCw className="w-4 h-4" />
          Perbarui Halaman
        </button>
      </div>
    </div>
  );
}
