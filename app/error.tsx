'use client';

import { useEffect } from 'react';
import { ServerCrash, RotateCw, Home } from 'lucide-react';
import Link from 'next/link';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error('Next.js App Error:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center px-4 py-8 transition-colors duration-300">
      <div className="w-full max-w-md text-center">
        {/* Minimal Icon Container */}
        <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-800/50 flex items-center justify-center mx-auto mb-6">
          <ServerCrash className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
        </div>

        {/* Content */}
        <h1 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
          Layanan Sedang Mengalami Kendala
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm max-w-xs mx-auto mb-8 leading-relaxed">
          Koneksi ke server terputus atau sistem sedang mengalami gangguan teknis. Tim kami sedang menanganinya.
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => reset()}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 active:scale-95"
          >
            <RotateCw className="w-4 h-4" />
            Coba Lagi
          </button>
          <Link
            href="/auth/login"
            className="px-5 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 active:scale-95"
          >
            <Home className="w-4 h-4" />
            Ke Halaman Login
          </Link>
        </div>
      </div>
    </div>
  );
}
