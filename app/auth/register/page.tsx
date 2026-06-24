'use client';

import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  GraduationCap,
  Loader2,
  Mail,
  RotateCcw,
  ShieldCheck,
  Camera,
  Image as ImageIcon,
} from 'lucide-react';

// Set to true to require email OTP verification on register
const ENABLE_OTP = false;

// 3 steps: data akun → preferensi keuangan → verifikasi OTP
type Step = 1 | 2 | 3;

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    paydayDate: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<Step>(1);
  const [isScanningKtm, setIsScanningKtm] = useState(false);

  // OTP states
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [resendCooldown, setResendCooldown] = useState(0);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const isStudentEmail = (email: string) => email.toLowerCase().trim().endsWith('.ac.id');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  };

  const handleScanKtm = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanningKtm(true);
    setError('');

    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = (reader.result as string).split(',')[1];
        
        const res = await fetch('/api/ai/verify-ktm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: base64String, mimeType: file.type }),
        });
        
        const data = await res.json();
        
        if (data.success && data.data) {
          setForm(f => ({ ...f, name: data.data.name || f.name }));
          // Optional: we can show a success toast here
        } else {
          setError(data.message || 'Gagal membaca KTM. Pastikan foto jelas.');
        }
        setIsScanningKtm(false);
      };
      reader.readAsDataURL(file);
    } catch {
      setError('Gagal memproses gambar KTM. Coba lagi.');
      setIsScanningKtm(false);
    }
  };

  // ── Step 1: Validate form & move to step 2 ──────────────────────────────
  const handleStep1 = (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) {
      setError('Password tidak cocok');
      return;
    }
    if (form.password.length < 6) {
      setError('Password minimal 6 karakter');
      return;
    }
    setError('');
    setStep(2);
  };

  // ── Step 2: Send OTP & move to step 3 (Or directly register if OTP is disabled) ─────────────────────────
  const handleStep2 = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    if (!ENABLE_OTP) {
      try {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: form.name,
            email: form.email,
            password: form.password,
            paydayDate: form.paydayDate ? parseInt(form.paydayDate) : undefined,
          }),
        });
        const data = await res.json();

        if (data.success) {
          localStorage.setItem('sf-token', data.token);
          localStorage.setItem('sf-user', JSON.stringify(data.user));
          router.push('/dashboard');
        } else {
          setError(data.message || 'Pendaftaran gagal');
          if (data.message?.includes('registered')) {
            setStep(1); // back to account info
          }
        }
      } catch {
        setError('Terjadi kesalahan. Coba lagi.');
      } finally {
        setIsLoading(false);
      }
      return;
    }

    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email, name: form.name }),
      });
      const data = await res.json();

      if (data.success) {
        setStep(3);
        setResendCooldown(60);
        setTimeout(() => otpRefs.current[0]?.focus(), 200);
      } else {
        setError(data.message || 'Gagal mengirim OTP');
        if (data.message?.includes('terdaftar')) {
          setStep(1); // back to email input
        }
      }
    } catch {
      setError('Terjadi kesalahan. Coba lagi.');
    } finally {
      setIsLoading(false);
    }
  };

  // ── OTP Input Handlers ───────────────────────────────────────────────────
  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newDigits = [...otpDigits];
    newDigits[index] = value.slice(-1);
    setOtpDigits(newDigits);
    if (value && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) otpRefs.current[index - 1]?.focus();
    if (e.key === 'ArrowLeft' && index > 0) otpRefs.current[index - 1]?.focus();
    if (e.key === 'ArrowRight' && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const newDigits = ['', '', '', '', '', ''];
    pasted.split('').forEach((char, i) => { if (i < 6) newDigits[i] = char; });
    setOtpDigits(newDigits);
    const nextEmpty = newDigits.findIndex((d) => !d);
    otpRefs.current[nextEmpty === -1 ? 5 : nextEmpty]?.focus();
  };

  // ── Resend OTP ───────────────────────────────────────────────────────────
  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setIsLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email, name: form.name }),
      });
      const data = await res.json();
      if (data.success) {
        setOtpDigits(['', '', '', '', '', '']);
        setResendCooldown(60);
        setTimeout(() => otpRefs.current[0]?.focus(), 100);
      } else {
        setError(data.message || 'Gagal mengirim ulang OTP');
      }
    } catch {
      setError('Terjadi kesalahan. Coba lagi.');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Step 3: Verify OTP & Register ───────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = otpDigits.join('');
    if (code.length < 6) {
      setError('Masukkan 6 digit kode OTP');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          password: form.password,
          paydayDate: form.paydayDate ? parseInt(form.paydayDate) : undefined,
          otpCode: code,
        }),
      });
      const data = await res.json();

      if (data.success) {
        localStorage.setItem('sf-token', data.token);
        localStorage.setItem('sf-user', JSON.stringify(data.user));
        router.push('/dashboard');
      } else {
        setError(data.message || 'Pendaftaran gagal');
        if (data.message?.includes('OTP')) {
          setOtpDigits(['', '', '', '', '', '']);
        }
      }
    } catch {
      setError('Terjadi kesalahan. Coba lagi.');
    } finally {
      setIsLoading(false);
    }
  };

  const isStudent = isStudentEmail(form.email);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center px-4 py-8 relative overflow-hidden transition-colors duration-300">
      <div className="absolute -top-40 -right-40 w-80 h-80 bg-indigo-500/10 dark:bg-primary-700/20 rounded-full blur-3xl" />
      <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/10 dark:bg-accent-700/20 rounded-full blur-3xl" />

      <div className="relative z-10 w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-3 mb-4">
            <img src="/icon-512x512.png" alt="Finto" className="w-14 h-14 rounded-2xl object-cover shadow-lg shadow-indigo-500/30" />
            <span className="text-slate-900 dark:text-white font-black text-2xl">Finto</span>
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Buat Akun Baru</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Mulai perjalanan finansial cerdas kamu</p>
        </div>

        {/* Progress Bar */}
        <div className="flex gap-2 mb-6">
          {(ENABLE_OTP ? [1, 2, 3] : [1, 2]).map((s) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                s <= step ? 'bg-indigo-600 dark:bg-indigo-500' : 'bg-slate-200 dark:bg-slate-800'
              }`}
            />
          ))}
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/50 rounded-3xl p-8 shadow-xl dark:shadow-2xl">
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-900/30 border border-rose-100 dark:border-rose-700/50 text-rose-600 dark:text-rose-300 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* ── STEP 1: Data Akun ── */}
          {step === 1 && (
            <form onSubmit={handleStep1} className="space-y-5">
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider mb-2">
                Langkah 1 dari {ENABLE_OTP ? '3' : '2'} — Data Akun
              </p>

              {/* Scan KTM Button */}
              <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 border border-indigo-100 dark:border-indigo-800/50 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-indigo-900 dark:text-indigo-100 mb-1 flex items-center gap-1.5">
                      <Camera className="w-4 h-4" /> Scan KTM (AI)
                    </h3>
                    <p className="text-xs text-indigo-700 dark:text-indigo-300">Isi nama otomatis dari kartu mahasiswa</p>
                  </div>
                  <div className="relative">
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleScanKtm}
                      disabled={isScanningKtm}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                    />
                    <button
                      type="button"
                      disabled={isScanningKtm}
                      className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-lg text-xs font-medium transition shadow-sm disabled:opacity-70 pointer-events-none"
                    >
                      {isScanningKtm ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Proses...
                        </>
                      ) : (
                        <>
                          <ImageIcon className="w-3.5 h-3.5" /> Pilih Foto
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Nama Lengkap</label>
                <input
                  id="register-name"
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all text-sm"
                  placeholder="Nama kamu"
                  autoComplete="name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Email</label>
                <input
                  id="register-email"
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all text-sm"
                  placeholder="email@kamu.com"
                  autoComplete="email"
                />
                {/* Email kampus badge */}
                {isStudent && (
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                    <GraduationCap className="w-3.5 h-3.5" />
                    Email kampus terdeteksi — kamu dapat plan Student gratis!
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Password</label>
                <div className="relative">
                  <input
                    id="register-password"
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={form.password}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 pr-12 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all text-sm"
                    placeholder="Min. 6 karakter"
                    autoComplete="new-password"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1">
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Konfirmasi Password</label>
                <input
                  id="register-confirm-password"
                  type="password"
                  name="confirmPassword"
                  value={form.confirmPassword}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all text-sm"
                  placeholder="Ulangi password"
                  autoComplete="new-password"
                />
              </div>

              <button type="submit" className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm transition-all shadow-lg hover:shadow-glow-primary active:scale-95 flex items-center justify-center gap-2">
                Lanjut
                <ChevronRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {/* ── STEP 2: Preferensi Keuangan ── */}
          {step === 2 && (
            <form onSubmit={handleStep2} className="space-y-5">
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider mb-2">
                Langkah 2 dari {ENABLE_OTP ? '3' : '2'} — Preferensi Keuangan
              </p>

              <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-800/50">
                <p className="text-sm text-indigo-700 dark:text-indigo-300 font-medium mb-1">Opsional tapi berguna</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Tanggal gajian membantu sistem menghitung siklus anggaran kamu lebih akurat.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Tanggal Kiriman / Gajian</label>
                <div className="relative">
                  <select
                    id="register-payday"
                    name="paydayDate"
                    value={form.paydayDate}
                    onChange={handleChange}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all text-sm appearance-none cursor-pointer"
                  >
                    <option value="">Pilih tanggal (opsional)</option>
                    {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                      <option key={d} value={d}>Tanggal {d}</option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-500">
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button type="button" onClick={() => { setStep(1); setError(''); }} className="flex-1 py-3.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2">
                  <ArrowLeft className="w-4 h-4" /> Kembali
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl font-bold text-sm transition-all shadow-lg disabled:opacity-60 active:scale-95"
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="animate-spin w-4 h-4" />
                      Memproses...
                    </span>
                  ) : ENABLE_OTP ? (
                    <span className="flex items-center justify-center gap-1.5">
                      <Mail className="w-4 h-4" /> Kirim OTP
                    </span>
                  ) : (
                    'Daftar Sekarang'
                  )}
                </button>
              </div>
            </form>
          )}

          {/* ── STEP 3: Verifikasi OTP ── */}
          {step === 3 && (
            <form onSubmit={handleSubmit} className="space-y-6">
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider">
                Langkah 3 dari 3 — Verifikasi Email
              </p>

              <div className="text-center">
                <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-800/50 flex items-center justify-center mx-auto mb-3">
                  <ShieldCheck className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
                </div>
                <p className="font-semibold text-slate-800 dark:text-white text-sm">Kode OTP dikirim ke:</p>
                <p className="text-indigo-600 dark:text-indigo-400 font-mono text-sm mt-0.5 break-all">{form.email}</p>
                {isStudent && (
                  <div className="mt-2 inline-flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-700/50 rounded-full px-2.5 py-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                    <CheckCircle2 className="w-3 h-3" />
                    Terverifikasi — Plan Student Gratis
                  </div>
                )}
                <p className="text-slate-400 dark:text-slate-500 text-xs mt-2">Berlaku 5 menit. Cek folder spam jika tidak muncul.</p>
              </div>

              {/* OTP Digit Inputs */}
              <div className="flex gap-2 justify-center" onPaste={handleOtpPaste}>
                {otpDigits.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => { otpRefs.current[i] = el; }}
                    id={`otp-register-${i}`}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(i, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(i, e)}
                    className={`w-11 h-12 text-center text-xl font-bold rounded-xl border-2 transition-all duration-200
                      bg-white dark:bg-slate-800 text-slate-900 dark:text-white
                      focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20
                      ${digit
                        ? 'border-indigo-400 dark:border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30'
                        : 'border-slate-200 dark:border-slate-700'
                      }`}
                  />
                ))}
              </div>

              <button
                id="register-submit"
                type="submit"
                disabled={isLoading || otpDigits.join('').length < 6}
                className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl font-bold text-sm transition-all shadow-lg disabled:opacity-60 disabled:cursor-not-allowed active:scale-95"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="animate-spin w-4 h-4" />
                    Mendaftar...
                  </span>
                ) : 'Verifikasi & Daftar'}
              </button>

              {/* Resend */}
              <div className="text-center">
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resendCooldown > 0 || isLoading}
                  className="inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  {resendCooldown > 0 ? `Kirim ulang dalam ${resendCooldown}s` : 'Kirim ulang kode'}
                </button>
              </div>

              <button
                type="button"
                onClick={() => { setStep(2); setError(''); setOtpDigits(['','','','','','']); }}
                className="flex items-center justify-center gap-1.5 w-full text-sm text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Kembali
              </button>
            </form>
          )}

          <p className="text-center text-slate-500 dark:text-slate-400 text-sm mt-6">
            Sudah punya akun?{' '}
            <Link href="/login" className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 font-semibold transition-colors">
              Masuk di sini
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
