'use client';

import { useState, useEffect } from 'react';

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
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-4 h-4 flex-shrink-0 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
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
