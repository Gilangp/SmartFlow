'use client';

import { useState, useEffect } from 'react';
import { Check, AlertTriangle } from 'lucide-react';

export default function OfflineStatusDetector() {
  const [isOnline, setIsOnline] = useState(true);
  const [showStatus, setShowStatus] = useState(false);
  const [hasChanged, setHasChanged] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsOnline(navigator.onLine);
    }

    const handleOnline = () => {
      setIsOnline(true);
      setHasChanged(true);
      setShowStatus(true);
      const timer = setTimeout(() => {
        setShowStatus(false);
      }, 3000);
      return () => clearTimeout(timer);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setHasChanged(true);
      setShowStatus(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!hasChanged) return null;

  const isVisible = !isOnline || (isOnline && showStatus);

  if (!isVisible) return null;

  return (
    <div 
      className={`fixed top-4 left-1/2 -translate-x-1/2 z-[9999] w-[calc(100%-2rem)] max-w-sm transition-all duration-500 cubic-bezier(0.16, 1, 0.3, 1) transform ${
        isVisible ? 'translate-y-0 opacity-100 scale-100' : '-translate-y-8 opacity-0 scale-95'
      }`}
    >
      <div 
        className={`backdrop-blur-lg border px-4 py-3.5 rounded-2xl shadow-xl flex items-center gap-3 transition-colors duration-300 ${
          isOnline 
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400 shadow-emerald-500/5' 
            : 'bg-rose-500/10 border-rose-500/20 text-rose-700 dark:text-rose-400 shadow-rose-500/5'
        }`}
      >
        <div className={`p-1.5 rounded-lg ${isOnline ? 'bg-emerald-500/15' : 'bg-rose-500/15'}`}>
          {isOnline ? (
            <Check className="w-4 h-4 flex-shrink-0" strokeWidth={3} />
          ) : (
            <AlertTriangle className="w-4 h-4 flex-shrink-0 animate-pulse" strokeWidth={2.5} />
          )}
        </div>
        <div className="flex-1 text-xs font-semibold tracking-wide">
          {isOnline ? (
            <span>Koneksi internet terhubung kembali!</span>
          ) : (
            <span>Koneksi internet terputus. Mode offline aktif.</span>
          )}
        </div>
      </div>
    </div>
  );
}
