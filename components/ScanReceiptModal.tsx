'use client';

import { useState, useRef, useCallback } from 'react';
import { Camera, Upload, X, ScanLine, CheckCircle, AlertCircle, Loader2, Info, RefreshCw, Clock, ImageOff, WifiOff, ShieldOff } from 'lucide-react';
import { compressImage } from '@/lib/image-helper';

interface ScanResult {
  merchant: string;
  amount: number;
  date: string;
  category: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  items: Array<{ name: string; price: number; qty: number }>;
}

interface ScanReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onResult: (data: ScanResult) => void;
  token: string;
}

type ErrorType = 'timeout' | 'quality' | 'quota' | 'server' | 'network' | null;

const LOADING_STAGES = [
  'Mengirim gambar ke server OCR...',
  'Server AI sedang membaca teks struk...',
  'Menganalisis data transaksi...',
  'Hampir selesai...',
];

export default function ScanReceiptModal({ isOpen, onClose, onResult, token }: ScanReceiptModalProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState('image/jpeg');
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<ErrorType>(null);
  const [result, setResult] = useState<ScanResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const stageIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const startLoadingStages = () => {
    setLoadingStage(0);
    let stage = 0;
    stageIntervalRef.current = setInterval(() => {
      stage = Math.min(stage + 1, LOADING_STAGES.length - 1);
      setLoadingStage(stage);
    }, 5000);
  };

  const stopLoadingStages = () => {
    if (stageIntervalRef.current) {
      clearInterval(stageIntervalRef.current);
      stageIntervalRef.current = null;
    }
  };

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('File harus berupa gambar (JPG, PNG, WEBP)');
      setErrorType('quality');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('Ukuran file maksimal 10MB. Coba kompres foto terlebih dahulu.');
      setErrorType('quality');
      return;
    }

    setError(null);
    setErrorType(null);
    setResult(null);
    setLoading(true);

    try {
      const compressedDataUrl = await compressImage(file, {
        maxWidth: 1200,
        maxHeight: 1200,
        quality: 0.8,
        mimeType: 'image/webp',
      });
      setMimeType('image/webp');
      setPreview(compressedDataUrl);
    } catch {
      setError('Gagal memproses gambar. Coba lagi dengan foto yang berbeda.');
      setErrorType('quality');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleScan = async () => {
    if (!preview) return;

    setLoading(true);
    setError(null);
    setErrorType(null);
    startLoadingStages();

    try {
      const base64 = preview.split(',')[1];

      const res = await fetch('/api/ai/scan-receipt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ imageBase64: base64, mimeType }),
      });

      const data = await res.json();

      if (!data.success) {
        // Kategorikan error berdasarkan HTTP status
        if (res.status === 403) {
          setErrorType('quota');
          setError('Fitur Scan Struk memerlukan paket Student atau Premium.');
        } else if (res.status === 422) {
          setErrorType('quality');
          setError(data.message || 'Struk tidak terbaca. Pastikan foto jelas dan seluruh struk terlihat.');
        } else if (res.status === 503 || res.status === 504) {
          setErrorType('timeout');
          setError('Server AI sedang memuat model (cold start). Biasanya terjadi hanya sekali. Coba lagi dalam 30 detik.');
        } else if (res.status === 502) {
          setErrorType('server');
          setError('Server OCR tidak dapat dijangkau. Sistem tetap menggunakan AI cadangan, coba lagi.');
        } else {
          setErrorType('server');
          setError(data.message || 'Terjadi kesalahan pada server. Coba lagi.');
        }
        return;
      }

      setResult(data.data);
    } catch (err: any) {
      // Network error (offline, timeout fetch)
      if (err?.name === 'TypeError' && err?.message?.includes('fetch')) {
        setErrorType('network');
        setError('Tidak ada koneksi internet atau server tidak dapat dijangkau.');
      } else {
        setErrorType('server');
        setError('Terjadi kesalahan tak terduga. Coba lagi.');
      }
    } finally {
      setLoading(false);
      stopLoadingStages();
    }
  };

  const handleRetry = () => {
    setError(null);
    setErrorType(null);
    handleScan();
  };

  const handleUseResult = () => {
    if (result) {
      onResult(result);
      handleClose();
    }
  };

  const handleClose = () => {
    setPreview(null);
    setError(null);
    setErrorType(null);
    setResult(null);
    setLoading(false);
    stopLoadingStages();
    onClose();
  };

  const formatRupiah = (n: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);

  if (!isOpen) return null;

  // ── Konfigurasi tampilan error berdasarkan tipe ───────────────────────────
  const errorConfig: Record<NonNullable<ErrorType>, {
    icon: React.ReactNode;
    title: string;
    bgClass: string;
    borderClass: string;
    titleClass: string;
    textClass: string;
    showRetry: boolean;
    retryLabel?: string;
    showManual: boolean;
  }> = {
    timeout: {
      icon: <Clock className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />,
      title: 'Server Sedang Memuat',
      bgClass: 'bg-amber-50 dark:bg-amber-950/20',
      borderClass: 'border-amber-200 dark:border-amber-800/50',
      titleClass: 'text-amber-800 dark:text-amber-300',
      textClass: 'text-amber-600 dark:text-amber-400',
      showRetry: true,
      retryLabel: 'Coba Lagi (30 detik)',
      showManual: true,
    },
    quality: {
      icon: <ImageOff className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />,
      title: 'Foto Tidak Terbaca',
      bgClass: 'bg-orange-50 dark:bg-orange-950/20',
      borderClass: 'border-orange-200 dark:border-orange-800/50',
      titleClass: 'text-orange-800 dark:text-orange-300',
      textClass: 'text-orange-600 dark:text-orange-400',
      showRetry: false,
      showManual: true,
    },
    quota: {
      icon: <ShieldOff className="w-5 h-5 text-purple-500 flex-shrink-0 mt-0.5" />,
      title: 'Fitur Terbatas',
      bgClass: 'bg-purple-50 dark:bg-purple-950/20',
      borderClass: 'border-purple-200 dark:border-purple-800/50',
      titleClass: 'text-purple-800 dark:text-purple-300',
      textClass: 'text-purple-600 dark:text-purple-400',
      showRetry: false,
      showManual: true,
    },
    server: {
      icon: <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />,
      title: 'Kesalahan Server',
      bgClass: 'bg-red-50 dark:bg-red-950/20',
      borderClass: 'border-red-200 dark:border-red-800/50',
      titleClass: 'text-red-800 dark:text-red-300',
      textClass: 'text-red-600 dark:text-red-400',
      showRetry: true,
      retryLabel: 'Coba Lagi',
      showManual: true,
    },
    network: {
      icon: <WifiOff className="w-5 h-5 text-gray-500 flex-shrink-0 mt-0.5" />,
      title: 'Tidak Ada Koneksi',
      bgClass: 'bg-gray-50 dark:bg-gray-800/50',
      borderClass: 'border-gray-200 dark:border-gray-700',
      titleClass: 'text-gray-800 dark:text-gray-300',
      textClass: 'text-gray-600 dark:text-gray-400',
      showRetry: true,
      retryLabel: 'Coba Lagi',
      showManual: true,
    },
  };

  const currentError = errorType ? errorConfig[errorType] : null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-md shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-950/40 rounded-lg flex items-center justify-center">
              <ScanLine className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900 dark:text-white text-sm">Scan Struk</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">AI baca otomatis</p>
            </div>
          </div>
          <button onClick={handleClose} className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 transition">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Upload area */}
          {!result && (
            <>
              {!preview ? (
                <div className="space-y-3">
                  <button
                    onClick={() => cameraInputRef.current?.click()}
                    className="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-dashed border-indigo-300 dark:border-indigo-700 bg-indigo-50/50 dark:bg-indigo-950/20 hover:border-indigo-500 transition group"
                  >
                    <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/40 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Camera className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div className="text-left">
                      <p className="font-semibold text-gray-900 dark:text-white text-sm">Foto Struk</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Buka kamera langsung</p>
                    </div>
                  </button>

                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-700 transition group"
                  >
                    <div className="w-10 h-10 bg-gray-100 dark:bg-gray-800 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Upload className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                    </div>
                    <div className="text-left">
                      <p className="font-semibold text-gray-900 dark:text-white text-sm">Pilih dari Galeri</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">JPG, PNG, WEBP (max 10MB)</p>
                    </div>
                  </button>

                  <div className="flex items-center justify-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
                    <Info className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>Pastikan foto terang dan teks struk terbaca jelas</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Preview gambar */}
                  <div className="relative">
                    <img src={preview} alt="Struk" className="w-full max-h-48 object-contain rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700" />
                    {!loading && (
                      <button
                        onClick={() => { setPreview(null); setError(null); setErrorType(null); }}
                        className="absolute top-2 right-2 w-7 h-7 bg-black/50 rounded-full flex items-center justify-center text-white hover:bg-black/70 transition"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Error Block — tampilan berbeda per tipe */}
                  {error && currentError && (
                    <div className={`flex flex-col gap-3 p-4 ${currentError.bgClass} border ${currentError.borderClass} rounded-xl`}>
                      <div className="flex items-start gap-2.5">
                        {currentError.icon}
                        <div className="space-y-1 flex-1">
                          <p className={`font-semibold text-sm ${currentError.titleClass}`}>{currentError.title}</p>
                          <p className={`text-xs leading-relaxed ${currentError.textClass}`}>{error}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {currentError.showRetry && (
                          <button
                            onClick={handleRetry}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-xs font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            {currentError.retryLabel || 'Coba Lagi'}
                          </button>
                        )}
                        {currentError.showManual && (
                          <button
                            onClick={handleClose}
                            className="flex-1 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 rounded-lg text-xs font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                          >
                            Input Manual
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Tombol Scan / Loading */}
                  {loading ? (
                    <div className="w-full flex flex-col items-center justify-center gap-2 bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800/50 py-4 rounded-xl">
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                        <span className="text-sm font-medium text-indigo-700 dark:text-indigo-400">
                          {LOADING_STAGES[loadingStage]}
                        </span>
                      </div>
                      <p className="text-xs text-indigo-400 dark:text-indigo-500">Proses ini bisa memakan 10-60 detik</p>
                    </div>
                  ) : !error && (
                    <button
                      onClick={handleScan}
                      className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-semibold transition"
                    >
                      <ScanLine className="w-4 h-4" />
                      Scan Sekarang
                    </button>
                  )}
                </div>
              )}
            </>
          )}

          {/* Hasil scan */}
          {result && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle className="w-5 h-5 text-emerald-500" />
                <span className="font-semibold text-gray-900 dark:text-white text-sm">Struk Berhasil Dibaca!</span>
                <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium ${
                  result.confidence === 'HIGH'
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400'
                    : result.confidence === 'MEDIUM'
                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400'
                    : 'bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400'
                }`}>
                  {result.confidence === 'HIGH' ? '✓ Akurat' : result.confidence === 'MEDIUM' ? '~ Cukup Akurat' : '⚠ Perlu Dicek'}
                </span>
              </div>

              {/* Warning jika confidence LOW */}
              {result.confidence === 'LOW' && (
                <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/50 rounded-xl">
                  <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700 dark:text-amber-400">Data mungkin tidak akurat. Pastikan Anda memeriksa kembali sebelum menyimpan.</p>
                </div>
              )}

              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Merchant</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{result.merchant}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Total Bayar</span>
                  <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{formatRupiah(result.amount)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Tanggal</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{result.date}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Kategori</span>
                  <span className="text-xs bg-indigo-100 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-400 px-2 py-0.5 rounded-full">{result.category}</span>
                </div>
              </div>

              {result.items.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1.5">Item di struk:</p>
                  <div className="space-y-1 max-h-24 overflow-y-auto">
                    {result.items.slice(0, 5).map((item, i) => (
                      <div key={i} className="flex justify-between text-xs">
                        <span className="text-gray-700 dark:text-gray-300">{item.name} {item.qty > 1 ? `×${item.qty}` : ''}</span>
                        <span className="text-gray-500 dark:text-gray-400">{formatRupiah(item.price)}</span>
                      </div>
                    ))}
                    {result.items.length > 5 && (
                      <p className="text-xs text-gray-400">+{result.items.length - 5} item lainnya</p>
                    )}
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => { setResult(null); setPreview(null); }}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition"
                >
                  Scan Ulang
                </button>
                <button
                  onClick={handleUseResult}
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition"
                >
                  Pakai Data Ini
                </button>
              </div>
            </div>
          )}
        </div>

        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
        <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
      </div>
    </div>
  );
}
