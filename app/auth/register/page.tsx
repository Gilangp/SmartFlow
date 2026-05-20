'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

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
  const [step, setStep] = useState(1);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  };

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
        }),
      });

      const data = await res.json();

      if (data.success) {
        localStorage.setItem('sf-token', data.token);
        localStorage.setItem('sf-user', JSON.stringify(data.user));
        router.push('/dashboard');
      } else {
        setError(data.message || 'Pendaftaran gagal');
      }
    } catch {
      setError('Terjadi kesalahan. Coba lagi.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-950 flex items-center justify-center px-4 py-8 relative overflow-hidden">
      <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary-700/20 rounded-full blur-3xl" />
      <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-accent-700/20 rounded-full blur-3xl" />

      <div className="relative z-10 w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-4">
            <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-accent-500 rounded-xl flex items-center justify-center shadow-glow-primary">
              <span className="text-white font-bold text-lg">SF</span>
            </div>
            <span className="text-white font-black text-2xl">SmartFlow</span>
          </Link>
          <h1 className="text-2xl font-bold text-white">Buat Akun Baru</h1>
          <p className="text-slate-400 text-sm mt-1">Mulai perjalanan finansial cerdas kamu</p>
        </div>

        {/* Progress */}
        <div className="flex gap-2 mb-6">
          <div className={`h-1 flex-1 rounded-full transition-all ${step >= 1 ? 'bg-primary-500' : 'bg-surface-700'}`} />
          <div className={`h-1 flex-1 rounded-full transition-all ${step >= 2 ? 'bg-primary-500' : 'bg-surface-700'}`} />
        </div>

        <div className="bg-surface-900 border border-surface-700/50 rounded-3xl p-8 shadow-2xl">
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-rose-900/30 border border-rose-700/50 text-rose-300 text-sm flex items-center gap-2">
              <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              {error}
            </div>
          )}

          {step === 1 ? (
            <form onSubmit={handleStep1} className="space-y-5">
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-2">Langkah 1 dari 2 — Data Akun</p>

              <div>
                <label className="form-label text-slate-300">Nama Lengkap</label>
                <input
                  id="register-name"
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 rounded-xl border border-surface-700 bg-surface-800 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all text-sm"
                  placeholder="Nama kamu"
                  autoComplete="name"
                />
              </div>

              <div>
                <label className="form-label text-slate-300">Email</label>
                <input
                  id="register-email"
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 rounded-xl border border-surface-700 bg-surface-800 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all text-sm"
                  placeholder="email@kamu.com"
                  autoComplete="email"
                />
              </div>

              <div>
                <label className="form-label text-slate-300">Password</label>
                <div className="relative">
                  <input
                    id="register-password"
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={form.password}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 pr-12 rounded-xl border border-surface-700 bg-surface-800 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all text-sm"
                    placeholder="Min. 6 karakter"
                    autoComplete="new-password"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-1">
                    {showPassword ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>

              <div>
                <label className="form-label text-slate-300">Konfirmasi Password</label>
                <input
                  id="register-confirm-password"
                  type="password"
                  name="confirmPassword"
                  value={form.confirmPassword}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 rounded-xl border border-surface-700 bg-surface-800 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all text-sm"
                  placeholder="Ulangi password"
                  autoComplete="new-password"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3.5 bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-500 hover:to-primary-400 text-white rounded-xl font-bold text-sm transition-all shadow-lg hover:shadow-glow-primary active:scale-95"
              >
                Lanjut →
              </button>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-2">Langkah 2 dari 2 — Preferensi Keuangan</p>

              <div className="p-4 rounded-2xl bg-primary-900/20 border border-primary-700/30">
                <p className="text-sm text-primary-300 font-medium mb-1">💡 Opsional tapi berguna!</p>
                <p className="text-xs text-slate-400">Tanggal kiriman/gajian membantu sistem menghitung siklus anggaran kamu lebih akurat.</p>
              </div>

              <div>
                <label className="form-label text-slate-300">Tanggal Kiriman / Gajian</label>
                <select
                  id="register-payday"
                  name="paydayDate"
                  value={form.paydayDate}
                  onChange={handleChange}
                  className="w-full px-4 py-3 rounded-xl border border-surface-700 bg-surface-800 text-white focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all text-sm appearance-none cursor-pointer"
                >
                  <option value="">Pilih tanggal (opsional)</option>
                  {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                    <option key={d} value={d}>Tanggal {d} setiap bulan</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex-1 py-3.5 bg-surface-700 hover:bg-surface-600 text-white rounded-xl font-semibold text-sm transition-all"
                >
                  ← Kembali
                </button>
                <button
                  id="register-submit"
                  type="submit"
                  disabled={isLoading}
                  className="flex-2 flex-1 py-3.5 bg-gradient-to-r from-primary-600 to-accent-600 hover:from-primary-500 hover:to-accent-500 text-white rounded-xl font-bold text-sm transition-all shadow-lg disabled:opacity-60 active:scale-95"
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Mendaftar...
                    </span>
                  ) : '🚀 Daftar!'}
                </button>
              </div>
            </form>
          )}

          <p className="text-center text-slate-400 text-sm mt-6">
            Sudah punya akun?{' '}
            <Link href="/auth/login" className="text-primary-400 hover:text-primary-300 font-semibold transition-colors">
              Masuk di sini
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
