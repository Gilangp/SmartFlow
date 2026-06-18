'use client';

import { useState, useRef, useCallback } from 'react';
import { GraduationCap, Camera, Upload, X, CheckCircle, AlertCircle, Loader2, Shield } from 'lucide-react';

interface KtmResult {
  name: string;
  university: string;
  nim: string;
  plan: string;
}

interface KtmVerifyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (data: KtmResult) => void;
  token: string;
  userName: string;
}

export default function KtmVerifyModal({ isOpen, onClose, onSuccess, token, userName }: KtmVerifyModalProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState('image/jpeg');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<KtmResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('File harus berupa gambar (JPG, PNG, WEBP)');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('Ukuran file maksimal 10MB');
      return;
    }

    setError(null);
    setMimeType(file.type);

    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);
  }, []);

  const handleVerify = async () => {
    if (!preview) return;

    setLoading(true);
    setError(null);

    try {
      const base64 = preview.split(',')[1];

      const res = await fetch('/api/subscription/verify-ktm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ imageBase64: base64, mimeType }),
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.message || 'Verifikasi gagal');
        return;
      }

      setSuccess(data.data);
    } catch {
      setError('Terjadi kesalahan. Coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setPreview(null);
    setError(null);
    setSuccess(null);
    setLoading(false);
    onClose();
  };

  const handleDone = () => {
    if (success) {
      onSuccess(success);
      handleClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-md shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-100 dark:bg-emerald-950/40 rounded-lg flex items-center justify-center">
              <GraduationCap className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900 dark:text-white text-sm">Verifikasi KTM</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Dapatkan Student Plan gratis</p>
            </div>
          </div>
          <button onClick={handleClose} className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 transition">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Success state */}
          {success ? (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950/30 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle className="w-8 h-8 text-emerald-500" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white mb-1">KTM Terverifikasi! 🎓</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Kamu sekarang punya akses Student Plan gratis selamanya</p>
              </div>
              <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-3 text-left space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Nama</span>
                  <span className="font-medium text-gray-900 dark:text-white">{success.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Kampus</span>
                  <span className="font-medium text-gray-900 dark:text-white">{success.university}</span>
                </div>
                {success.nim && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">NIM</span>
                    <span className="font-medium text-gray-900 dark:text-white">{success.nim}</span>
                  </div>
                )}
              </div>
              <button
                onClick={handleDone}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold transition"
              >
                Mantap, Lanjutkan! 🚀
              </button>
            </div>
          ) : (
            <>
              {/* Info */}
              <div className="flex items-start gap-2.5 p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-xl">
                <Shield className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-blue-700 dark:text-blue-300">
                  <p className="font-semibold mb-0.5">Panduan Upload KTM</p>
                  <ul className="space-y-0.5 text-blue-600 dark:text-blue-400">
                    <li>• Foto KTM harus jelas dan tidak buram</li>
                    <li>• Nama di KTM harus sama dengan akun: <strong>{userName}</strong></li>
                    <li>• Seluruh kartu harus terlihat di foto</li>
                  </ul>
                </div>
              </div>

              {!preview ? (
                <div className="space-y-3">
                  <button
                    onClick={() => cameraInputRef.current?.click()}
                    className="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-dashed border-emerald-300 dark:border-emerald-700 bg-emerald-50/50 dark:bg-emerald-950/20 hover:border-emerald-500 transition group"
                  >
                    <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/40 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Camera className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div className="text-left">
                      <p className="font-semibold text-gray-900 dark:text-white text-sm">Foto KTM</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Buka kamera langsung</p>
                    </div>
                  </button>

                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 hover:border-emerald-300 dark:hover:border-emerald-700 transition group"
                  >
                    <div className="w-10 h-10 bg-gray-100 dark:bg-gray-800 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Upload className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                    </div>
                    <div className="text-left">
                      <p className="font-semibold text-gray-900 dark:text-white text-sm">Upload dari Galeri</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">JPG, PNG, WEBP (max 10MB)</p>
                    </div>
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="relative">
                    <img src={preview} alt="KTM" className="w-full max-h-48 object-contain rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700" />
                    <button
                      onClick={() => { setPreview(null); setError(null); }}
                      className="absolute top-2 right-2 w-7 h-7 bg-black/50 rounded-full flex items-center justify-center text-white hover:bg-black/70 transition"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {error && (
                    <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-xl">
                      <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
                    </div>
                  )}

                  <button
                    onClick={handleVerify}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white py-3 rounded-xl font-semibold transition"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        AI sedang memverifikasi KTM...
                      </>
                    ) : (
                      <>
                        <GraduationCap className="w-4 h-4" />
                        Verifikasi Sekarang
                      </>
                    )}
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Hidden inputs */}
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
        <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
      </div>
    </div>
  );
}
