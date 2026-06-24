'use client';

import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Mail,
  RotateCcw,
  ShieldCheck,
  KeyRound,
  ArrowLeft,
} from 'lucide-react';

type Step = 'email' | 'otp' | 'reset' | 'success';

export default function LupaPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('email');

  // Form states
  const [email, setEmail] = useState('');
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // UI states
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  // OTP input refs
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  // ── Step 1: Request OTP ──────────────────────────────────────────────────
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (data.success) {
        setStep('otp');
        setResendCooldown(60);
        setTimeout(() => otpRefs.current[0]?.focus(), 200);
      } else {
        setError(data.message || 'Terjadi kesalahan');
      }
    } catch {
      setError('Gagal terhubung ke server. Periksa koneksi internet kamu.');
    } finally {
      setIsLoading(false);
    }
  };

  // ── OTP Input Handlers ───────────────────────────────────────────────────
  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return; // only digits
    const newDigits = [...otpDigits];
    newDigits[index] = value.slice(-1); // only last digit
    setOtpDigits(newDigits);
    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
    if (e.key === 'ArrowLeft' && index > 0) otpRefs.current[index - 1]?.focus();
    if (e.key === 'ArrowRight' && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const newDigits = [...otpDigits];
    pasted.split('').forEach((char, i) => {
      if (i < 6) newDigits[i] = char;
    });
    setOtpDigits(newDigits);
    const nextEmpty = newDigits.findIndex((d) => !d);
    otpRefs.current[nextEmpty === -1 ? 5 : nextEmpty]?.focus();
  };

  // ── Step 2: Verify OTP ───────────────────────────────────────────────────
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = otpDigits.join('');
    if (code.length < 6) {
      setError('Masukkan 6 digit kode OTP');
      return;
    }
    setStep('reset');
    setError('');
  };

  // ── Step 3: Reset Password ───────────────────────────────────────────────
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError('Password tidak cocok');
      return;
    }
    if (newPassword.length < 6) {
      setError('Password minimal 6 karakter');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          code: otpDigits.join(''),
          newPassword,
        }),
      });
      const data = await res.json();

      if (data.success) {
        setStep('success');
      } else {
        setError(data.message || 'Reset password gagal');
        // If OTP invalid, go back to OTP step
        if (data.message?.includes('OTP')) {
          setOtpDigits(['', '', '', '', '', '']);
          setStep('otp');
        }
      }
    } catch {
      setError('Terjadi kesalahan. Coba lagi.');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Resend OTP ───────────────────────────────────────────────────────────
  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setIsLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
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

  // ── Step config ──────────────────────────────────────────────────────────
  const stepConfig = {
    email: { index: 0, label: 'Masukkan Email' },
    otp: { index: 1, label: 'Verifikasi Kode' },
    reset: { index: 2, label: 'Password Baru' },
    success: { index: 3, label: 'Selesai' },
  };
  const currentStepIndex = stepConfig[step].index;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center px-4 py-10 relative overflow-hidden transition-colors duration-300">
      {/* Background blobs */}
      <div className="absolute -top-40 -right-40 w-80 h-80 bg-indigo-500/10 dark:bg-indigo-700/20 rounded-full blur-3xl" />
      <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/10 dark:bg-purple-700/20 rounded-full blur-3xl" />

      <div className="relative z-10 w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-3 mb-4">
            <img
              src="/icon-512x512.png"
              alt="Finto"
              className="w-12 h-12 object-contain rounded-xl"
            />
            <span className="text-slate-900 dark:text-white font-black text-2xl">Finto</span>
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Lupa Password</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Kami akan bantu kamu reset password
          </p>
        </div>

        {/* Progress Bar (hide on success) */}
        {step !== 'success' && (
          <div className="flex gap-2 mb-6">
            {['email', 'otp', 'reset'].map((s, i) => (
              <div
                key={s}
                className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                  i <= currentStepIndex
                    ? 'bg-indigo-600 dark:bg-indigo-500'
                    : 'bg-slate-200 dark:bg-slate-800'
                }`}
              />
            ))}
          </div>
        )}

        {/* Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/50 rounded-3xl p-8 shadow-xl dark:shadow-2xl">
          {/* Error */}
          {error && (
            <div className="mb-5 p-3 rounded-xl bg-rose-50 dark:bg-rose-900/30 border border-rose-100 dark:border-rose-700/50 text-rose-600 dark:text-rose-300 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* ── STEP: EMAIL ── */}
          {step === 'email' && (
            <form onSubmit={handleRequestOtp} className="space-y-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-800/50 flex items-center justify-center flex-shrink-0">
                  <Mail className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <p className="font-semibold text-slate-800 dark:text-white text-sm">
                    Masukkan email akun kamu
                  </p>
                  <p className="text-slate-500 dark:text-slate-400 text-xs">
                    Kami kirimkan kode OTP ke email tersebut
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Email
                </label>
                <input
                  id="forgot-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all text-sm"
                  placeholder="email@kamu.com"
                  autoComplete="email"
                />
              </div>

              <button
                id="forgot-send-otp"
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white rounded-xl font-bold text-sm transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed shadow-lg active:scale-95"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="animate-spin w-4 h-4" />
                    Mengirim OTP...
                  </span>
                ) : (
                  'Kirim Kode OTP'
                )}
              </button>
            </form>
          )}

          {/* ── STEP: OTP ── */}
          {step === 'otp' && (
            <form onSubmit={handleVerifyOtp} className="space-y-6">
              <div className="text-center">
                <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-800/50 flex items-center justify-center mx-auto mb-3">
                  <ShieldCheck className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
                </div>
                <p className="font-semibold text-slate-800 dark:text-white text-sm">
                  Kode OTP dikirim ke:
                </p>
                <p className="text-indigo-600 dark:text-indigo-400 font-mono text-sm mt-0.5">
                  {email}
                </p>
                <p className="text-slate-400 dark:text-slate-500 text-xs mt-1">
                  Berlaku 5 menit. Cek folder spam jika tidak muncul.
                </p>
              </div>

              {/* OTP Digit Inputs */}
              <div className="flex gap-2 justify-center" onPaste={handleOtpPaste}>
                {otpDigits.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => { otpRefs.current[i] = el; }}
                    id={`otp-digit-${i}`}
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
                id="forgot-verify-otp"
                type="submit"
                disabled={otpDigits.join('').length < 6}
                className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white rounded-xl font-bold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg active:scale-95"
              >
                Verifikasi Kode
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
                  {resendCooldown > 0
                    ? `Kirim ulang dalam ${resendCooldown}s`
                    : 'Kirim ulang kode'}
                </button>
              </div>

              <button
                type="button"
                onClick={() => { setStep('email'); setError(''); setOtpDigits(['','','','','','']); }}
                className="flex items-center gap-1.5 text-sm text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors mx-auto"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Ganti email
              </button>
            </form>
          )}

          {/* ── STEP: RESET ── */}
          {step === 'reset' && (
            <form onSubmit={handleResetPassword} className="space-y-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-800/50 flex items-center justify-center flex-shrink-0">
                  <KeyRound className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="font-semibold text-slate-800 dark:text-white text-sm">
                    Buat Password Baru
                  </p>
                  <p className="text-slate-500 dark:text-slate-400 text-xs">
                    Minimal 6 karakter
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Password Baru
                </label>
                <div className="relative">
                  <input
                    id="reset-new-password"
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    className="w-full px-4 py-3 pr-12 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all text-sm"
                    placeholder="Min. 6 karakter"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Konfirmasi Password
                </label>
                <input
                  id="reset-confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all text-sm"
                  placeholder="Ulangi password"
                  autoComplete="new-password"
                />
              </div>

              <button
                id="reset-submit"
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl font-bold text-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-lg active:scale-95"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="animate-spin w-4 h-4" />
                    Menyimpan...
                  </span>
                ) : (
                  'Simpan Password Baru'
                )}
              </button>
            </form>
          )}

          {/* ── STEP: SUCCESS ── */}
          {step === 'success' && (
            <div className="text-center space-y-5">
              <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-950/30 border-2 border-emerald-200 dark:border-emerald-700/50 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 text-emerald-500" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1">
                  Password Berhasil Direset
                </h2>
                <p className="text-slate-500 dark:text-slate-400 text-sm">
                  Kamu sekarang bisa login dengan password barumu.
                </p>
              </div>
              <button
                id="success-go-login"
                onClick={() => router.push('/auth/login')}
                className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-indigo-500 text-white rounded-xl font-bold text-sm shadow-lg hover:shadow-xl transition-all active:scale-95"
              >
                Masuk Sekarang
              </button>
            </div>
          )}

          {/* Footer link */}
          {step !== 'success' && (
            <p className="text-center text-slate-500 dark:text-slate-400 text-sm mt-6">
              Ingat password?{' '}
              <Link
                href="/auth/login"
                className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 font-semibold transition-colors"
              >
                Masuk
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
