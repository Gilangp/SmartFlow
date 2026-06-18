'use client';

import { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    // Cek apakah sudah di-install atau di-dismiss sebelumnya
    const isDismissed = localStorage.getItem('pwa-prompt-dismissed');
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;

    if (isDismissed || isStandalone) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Tampilkan prompt setelah delay sedikit agar tidak mengganggu kesan pertama
      setTimeout(() => setShowPrompt(true), 3000);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowPrompt(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('pwa-prompt-dismissed', 'true');
  };

  if (!showPrompt) return null;

  return (
    <div 
      className="fixed left-4 right-4 sm:left-auto sm:right-6 sm:w-96 z-[60] animate-slide-up"
      style={{ bottom: 'calc(var(--banner-height, 0px) + 80px)' }}
    >
      <div className="bg-indigo-600 dark:bg-indigo-900 text-white p-4 rounded-2xl shadow-2xl flex items-start gap-4 border border-indigo-400/20">
        <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
          <Download className="w-6 h-6 text-white" />
        </div>
        <div className="flex-1 pt-1">
          <h3 className="font-semibold text-sm mb-1">Install Finto App</h3>
          <p className="text-xs text-indigo-100 mb-3 opacity-90 leading-relaxed">
            Install Finto di layar utama HP Anda agar lebih cepat & lancar saat mencatat pengeluaran.
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={handleInstall}
              className="px-4 py-1.5 bg-white text-indigo-600 text-xs font-bold rounded-lg hover:bg-gray-50 transition active:scale-95"
            >
              Install Sekarang
            </button>
            <button
              onClick={handleDismiss}
              className="px-4 py-1.5 bg-indigo-700 dark:bg-indigo-950 text-white text-xs font-medium rounded-lg hover:bg-indigo-800 transition"
            >
              Nanti Saja
            </button>
          </div>
        </div>
        <button onClick={handleDismiss} className="p-1 hover:bg-white/10 rounded-md transition text-indigo-200 hover:text-white">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
