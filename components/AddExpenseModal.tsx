// components/AddExpenseModal.tsx
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { CategoryRecord } from '@/types';
import { Sparkles, Info, Camera, TrendingDown, Calendar, X, Mic, MicOff, Square } from 'lucide-react';
import { compressImage } from '@/lib/image-helper';
import { formatNominalInput, cleanNominalInput } from '@/lib/utils';

interface Pocket {
  id: string;
  name: string;
  type: string;
  allocation: number;
  balance?: number;
}

interface AddExpenseModalProps {
  onClose: () => void;
  onSuccess: () => void;
  prefill?: {
    amount?: number;
    date?: string;
    notes?: string;
    category?: string;
  };
}

const SMART_INPUT_EXAMPLES = [
  'Makan siang warteg 15rb',
  'Beli kuota internet 50000',
  'Ongkos gojek ke kampus 25k',
  'Kopi sama teman 35.000',
];

function getDateBadge(dateStr: string) {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + 'T00:00:00');
  target.setHours(0, 0, 0, 0);
  const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  const className = 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300';

  if (diffDays === 0) {
    return { label: 'Hari Ini', className };
  } else if (diffDays === -1) {
    return { label: 'Kemarin', className };
  } else if (diffDays === -2) {
    return { label: '2 Hari Lalu', className };
  } else if (diffDays < -2) {
    return { label: `${Math.abs(diffDays)} Hari Lalu`, className };
  } else if (diffDays === 1) {
    return { label: 'Besok', className };
  } else {
    return { label: `${diffDays} Hari Lagi`, className };
  }
}

export default function AddExpenseModal({ onClose, onSuccess, prefill }: AddExpenseModalProps) {
  const [mode, setMode] = useState<'smart' | 'manual' | 'scan'>(prefill ? 'manual' : 'smart');
  const [smartText, setSmartText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [voiceError, setVoiceError] = useState('');
  const recognitionRef = useRef<any>(null);
  const finalTranscriptRef = useRef('');
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const silenceRafRef = useRef<number | null>(null);
  const SILENCE_TIMEOUT_MS = 3000; // auto-stop setelah 3 detik hening
  const [aiProcessing, setAiProcessing] = useState(false);
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [pockets, setPockets] = useState<Pocket[]>([]);
  const [form, setForm] = useState({
    amount: prefill?.amount ? String(prefill.amount) : '',
    categoryId: '',
    pocketId: '',
    date: prefill?.date || new Date().toISOString().split('T')[0],
    notes: prefill?.notes || '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const getToken = () => localStorage.getItem('sf-token');

  // ── Stop semua recording ──────────────────────────────────────────────────
  const stopVoice = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (silenceRafRef.current) {
      cancelAnimationFrame(silenceRafRef.current);
      silenceRafRef.current = null;
    }
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  // ── Start recording: Web Speech API + AudioContext silence detection ────────
  const startVoice = useCallback(() => {
    setVoiceError('');

    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setVoiceError('Browser kamu tidak mendukung voice input. Gunakan Chrome atau Edge.');
      return;
    }

    // Reset teks lama — rekam selalu mulai dari awal
    setSmartText('');
    finalTranscriptRef.current = '';

    const recognition = new SpeechRecognition();
    recognition.lang = 'id-ID';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);

    recognition.onresult = (event: any) => {
      let interim = '';
      let final = finalTranscriptRef.current;
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += (final ? ' ' : '') + t;
          finalTranscriptRef.current = final;
        } else {
          interim = t;
        }
      }
      setSmartText(finalTranscriptRef.current + (interim ? ' ' + interim : ''));
    };

    recognition.onerror = (event: any) => {
      const errMap: Record<string, string> = {
        'not-allowed': 'Izin mikrofon ditolak. Izinkan di pengaturan browser.',
        'audio-capture': 'Mikrofon tidak ditemukan.',
        'network': 'Gagal koneksi. Coba lagi.',
      };
      // 'no-speech' diabaikan karena silence detection yang handle
      if (event.error !== 'no-speech') {
        setVoiceError(errMap[event.error] || `Error: ${event.error}`);
      }
    };

    recognition.onend = () => {
      recognitionRef.current = null;
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();

    // ── Silence Detection via AudioContext ───────────────────────────────────
    // Minta stream mikrofon terpisah hanya untuk cek volume
    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      try {
        const audioCtx = new AudioContext();
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 512;
        source.connect(analyser);
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const SILENCE_THRESHOLD = 8;

        const checkSilence = () => {
          if (!recognitionRef.current) {
            stream.getTracks().forEach((t) => t.stop());
            audioCtx.close();
            return;
          }

          analyser.getByteTimeDomainData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            const val = (dataArray[i] - 128) / 128;
            sum += val * val;
          }
          const rms = Math.sqrt(sum / dataArray.length) * 100;

          if (rms < SILENCE_THRESHOLD) {
            if (!silenceTimerRef.current) {
              silenceTimerRef.current = setTimeout(() => {
                stream.getTracks().forEach((t) => t.stop());
                audioCtx.close();
                if (recognitionRef.current) {
                  recognitionRef.current.stop();
                  recognitionRef.current = null;
                }
                silenceTimerRef.current = null;
                silenceRafRef.current = null;
                setIsListening(false);
              }, SILENCE_TIMEOUT_MS);
            }
          } else {
            if (silenceTimerRef.current) {
              clearTimeout(silenceTimerRef.current);
              silenceTimerRef.current = null;
            }
          }

          silenceRafRef.current = requestAnimationFrame(checkSilence);
        };

        silenceRafRef.current = requestAnimationFrame(checkSilence);
      } catch {
        stream.getTracks().forEach((t) => t.stop());
      }
    }).catch(() => { /* tidak bisa dapat stream untuk volume check, skip */ });
  }, [smartText]);

  // Cleanup on unmount
  useEffect(() => () => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (silenceRafRef.current) cancelAnimationFrame(silenceRafRef.current);
    if (recognitionRef.current) recognitionRef.current.stop();
  }, []);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };

    Promise.all([
      fetch('/api/categories', { headers }).then((r) => r.json()),
      fetch('/api/pockets', { headers }).then((r) => r.json()),
    ]).then(([catData, pktData]) => {
      if (catData.success) {
        setCategories(catData.data);
        if (prefill?.category && catData.data.length > 0) {
          const matched = catData.data.find(
            (c: CategoryRecord) => c.name.toLowerCase().includes(prefill.category!.toLowerCase()) ||
              prefill.category!.toLowerCase().includes(c.name.toLowerCase())
          );
          if (matched) {
            setForm((f) => ({ ...f, categoryId: matched.id, pocketId: matched.pocketId || f.pocketId }));
          }
        }
      }
      if (pktData.success) {
        setPockets(pktData.data);
        const mainPocket = pktData.data.find((p: Pocket) => p.type === 'MAIN');
        setForm((f) => {
           if (!f.pocketId && mainPocket) return { ...f, pocketId: mainPocket.id };
           return f;
        });
      }
    });
  }, [prefill]);

  const handleSmartInput = async () => {
    if (!smartText.trim()) return;
    setAiProcessing(true);
    setError('');
    const token = getToken();
    try {
      const res = await fetch('/api/ai/smart-input', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ text: smartText }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        const extracted = data.data;
        const matchedCat = categories.find(
          (c) => c.name.toLowerCase() === extracted.category?.toLowerCase()
        );
        setForm((f) => ({
          ...f,
          amount: String(extracted.amount || ''),
          categoryId: matchedCat?.id || f.categoryId,
          pocketId: matchedCat?.pocketId || f.pocketId,
          notes: extracted.notes || smartText,
          date: extracted.date || f.date,
        }));
        setMode('manual');
      } else {
        setError('AI gagal memproses. Isi manual.');
        setMode('manual');
      }
    } catch {
      setError('Gagal menghubungi AI. Isi manual.');
      setMode('manual');
    } finally {
      setAiProcessing(false);
    }
  };

  const handleScanReceipt = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAiProcessing(true);
    setError('');
    const token = getToken();

    try {
      const compressedDataUrl = await compressImage(file, {
        maxWidth: 1200,
        maxHeight: 1200,
        quality: 0.8,
        mimeType: 'image/webp',
      });
      const base64String = compressedDataUrl.split(',')[1];
      
      const res = await fetch('/api/ai/scan-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ imageBase64: base64String, mimeType: 'image/webp' }),
      });
      
      const data = await res.json();
        
      if (data.success && data.data) {
        const extracted = data.data;
        const matchedCat = categories.find(
          (c) => c.name.toLowerCase() === extracted.category?.toLowerCase() || 
                 extracted.category?.toLowerCase().includes(c.name.toLowerCase())
        );
        
        let notes = extracted.merchant;
        if (extracted.items && extracted.items.length > 0) {
           notes += ' - ' + extracted.items.map((i: any) => i.name).join(', ');
        }

        setForm((f) => ({
          ...f,
          amount: String(extracted.amount || ''),
          categoryId: matchedCat?.id || f.categoryId,
          pocketId: matchedCat?.pocketId || f.pocketId,
          notes: notes.substring(0, 200),
          date: extracted.date || f.date
        }));
        setMode('manual');
      } else {
        setError(data.message || 'Gagal membaca struk. Pastikan foto jelas.');
      }
      setAiProcessing(false);
    } catch {
      setError('Gagal memproses gambar. Coba lagi.');
      setAiProcessing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.amount || !form.pocketId || !form.date) {
      setError('Nominal, kantong, dan tanggal wajib diisi');
      return;
    }
    setIsSubmitting(true);
    setError('');
    const token = getToken();
    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          type: 'EXPENSE',
          amount: parseFloat(form.amount),
          categoryId: form.categoryId || undefined,
          pocketId: form.pocketId,
          date: form.date,
          notes: form.notes || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        onSuccess();
      } else {
        setError(data.message || 'Gagal menyimpan transaksi');
      }
    } catch {
      setError('Terjadi kesalahan. Coba lagi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-800">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <TrendingDown className="w-5 h-5 text-indigo-500" />
              Catat Pengeluaran
            </h2>
            {prefill && (
              <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-0.5 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Data dari scan struk</span>
              </p>
            )}
          </div>

          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 text-rose-600 dark:text-rose-400 text-sm">
              {error}
            </div>
          )}

          {/* Mode Toggle */}
          <div className="flex gap-2 mb-5 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg">
            <button
              onClick={() => setMode('smart')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${mode === 'smart' ? 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
            >
              Smart Input
            </button>
            <button
              onClick={() => setMode('scan')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${mode === 'scan' ? 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
            >
              Scan Struk
            </button>
            <button
              onClick={() => setMode('manual')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${mode === 'manual' ? 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
            >
              Manual
            </button>
          </div>

          {/* Smart Input */}
          {mode === 'smart' && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20">
                <p className="text-xs text-indigo-600 dark:text-indigo-400 font-medium mb-2">Contoh input:</p>
                <div className="flex flex-wrap gap-1.5">
                  {SMART_INPUT_EXAMPLES.map((ex) => (
                    <button
                      key={ex}
                      onClick={() => setSmartText(ex)}
                      className="px-2 py-1 bg-indigo-100 dark:bg-indigo-800/40 text-indigo-700 dark:text-indigo-300 rounded-lg text-xs hover:bg-indigo-200 dark:hover:bg-indigo-700/40 transition"
                    >
                      {ex}
                    </button>
                  ))}
                </div>
              </div>
              {/* Modern Prompt Box Container */}
              <div className={`w-full rounded-xl border bg-white dark:bg-gray-800 transition-all shadow-sm overflow-hidden ${
                isListening
                  ? 'border-rose-400 dark:border-rose-500 ring-2 ring-rose-400/20'
                  : 'border-gray-200 dark:border-gray-700 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20'
              }`}>
                <textarea
                  value={smartText}
                  onChange={(e) => setSmartText(e.target.value)}
                  placeholder={
                    isListening
                      ? 'Mendengarkan... bicara sekarang'
                      : "Ketik atau rekam suara... contoh: 'Makan soto ayam 18rb'"
                  }
                  rows={3}
                  className="w-full px-4 pt-3 pb-2 bg-transparent text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none resize-none text-sm leading-relaxed"
                />

                {/* Prompt Box Toolbar Footer */}
                <div className="flex items-center justify-between px-3 py-2 bg-gray-50/60 dark:bg-gray-800/60 border-t border-gray-100 dark:border-gray-700/60">
                  <div className="flex items-center gap-2">
                    {isListening ? (
                      <div className="flex items-center gap-2 text-xs text-rose-600 dark:text-rose-400 font-medium">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                        </span>
                        <span>Merekam... otomatis hapus teks lama</span>
                      </div>
                    ) : (
                      <span className="text-[11px] text-gray-400 dark:text-gray-500">
                        Ketik atau ketuk tombol rekam
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={isListening ? stopVoice : startVoice}
                      title={isListening ? 'Stop perekaman' : 'Rekam suara otomatis'}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all shadow-sm ${
                        isListening
                          ? 'bg-rose-500 hover:bg-rose-600 text-white animate-pulse'
                          : 'bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-500/20 active:scale-95'
                      }`}
                    >
                      {isListening ? (
                        <>
                          <Square className="w-3 h-3 fill-current" />
                          <span>Stop</span>
                        </>
                      ) : (
                        <>
                          <Mic className="w-3.5 h-3.5" />
                          <span>Rekam Suara</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Voice error */}
              {voiceError && (
                <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20 text-amber-700 dark:text-amber-300 text-xs">
                  <MicOff className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  <span>{voiceError}</span>
                </div>
              )}

              <button
                onClick={handleSmartInput}
                disabled={!smartText.trim() || aiProcessing || isListening}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium text-sm transition-all disabled:opacity-50"
              >
                {aiProcessing ? 'Memproses...' : 'Proses dengan AI'}
              </button>
              <button onClick={() => setMode('manual')} className="w-full text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition py-1">
                Atau isi manual →
              </button>
            </div>
          )}

          {/* Scan Mode */}
          {mode === 'scan' && (
            <div className="space-y-4">
              <div className="p-6 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 bg-white dark:bg-gray-900 rounded-full flex items-center justify-center shadow-sm mb-4">
                  {aiProcessing ? (
                     <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                  ) : (
                     <Camera className="w-8 h-8 text-indigo-500" />
                  )}
                </div>
                <h3 className="text-gray-900 dark:text-white font-semibold mb-1">Scan Struk Belanja</h3>
                <p className="text-xs text-gray-500 max-w-xs mb-4">Foto struk otomatis dianalisis oleh AI untuk mengekstrak nominal dan kategori belanja</p>
                <label className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium cursor-pointer transition active:scale-95">
                  <span>Pilih Foto Struk</span>
                  <input type="file" accept="image/*" capture="environment" onChange={handleScanReceipt} className="hidden" disabled={aiProcessing} />
                </label>
              </div>
              <button onClick={() => setMode('manual')} className="w-full text-sm text-gray-500 hover:text-gray-700 transition py-1">
                Isi manual tanpa foto →
              </button>
            </div>
          )}

          {/* Manual Form */}
          {mode === 'manual' && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex items-start gap-2 p-3 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 text-xs text-indigo-700 dark:text-indigo-300 leading-relaxed">
                <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <span>Mencatat pengeluaran akan memotong saldo kantong yang dipilih dan mengurangi <strong>Jatah Harian</strong> Anda.</span>
              </div>

              {/* Amount */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Nominal Belanja
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={formatNominalInput(form.amount)}
                  onChange={(e) => setForm((f) => ({ ...f, amount: cleanNominalInput(e.target.value) }))}
                  placeholder="0"
                  required
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 font-mono text-base"
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Kategori
                </label>
                <select
                  value={form.categoryId}
                  onChange={(e) => {
                    const selectedCat = categories.find(c => c.id === e.target.value);
                    setForm((f) => ({ 
                      ...f, 
                      categoryId: e.target.value,
                      pocketId: selectedCat?.pocketId || f.pocketId 
                    }));
                  }}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                >
                  <option value="">Pilih kategori (opsional)</option>
                  <optgroup label="Kebutuhan">
                    {categories.filter((c) => c.type === 'NEED').map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Keinginan">
                    {categories.filter((c) => c.type === 'WANT').map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </optgroup>
                </select>
              </div>

              {/* Pocket Selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Diambil Dari Kantong
                </label>
                <select
                  value={form.pocketId}
                  onChange={(e) => setForm((f) => ({ ...f, pocketId: e.target.value }))}
                  required
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                >
                  <option value="">Pilih kantong</option>
                  {pockets.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} (Saldo: Rp {(p.balance || 0).toLocaleString('id-ID')})</option>
                  ))}
                </select>
              </div>

              {/* Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Tanggal
                </label>
                <div className="relative block w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white flex items-center justify-between cursor-pointer hover:border-indigo-500/50 transition focus-within:ring-2 focus-within:ring-indigo-500/50">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Calendar className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                    <span className="font-medium text-sm truncate">
                      {form.date ? new Date(form.date + 'T00:00:00').toLocaleDateString('id-ID', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      }) : 'Pilih Tanggal'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {(() => {
                      const badge = getDateBadge(form.date);
                      return badge ? (
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${badge.className}`}>
                          {badge.label}
                        </span>
                      ) : null;
                    })()}
                  </div>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                    onClick={(e) => {
                      if (e.currentTarget.showPicker) {
                        try { e.currentTarget.showPicker(); } catch {}
                      }
                    }}
                    required
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Catatan (opsional)
                </label>
                <input
                  type="text"
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="contoh: Makan siang bareng tim"
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium text-sm shadow-md shadow-indigo-600/15 transition-all active:scale-[0.98] disabled:opacity-50"
              >
                {isSubmitting ? 'Menyimpan...' : 'Simpan Pengeluaran'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
