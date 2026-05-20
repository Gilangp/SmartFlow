'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import BottomNav from '@/components/BottomNav';

interface UserProfile {
  id: string;
  name: string;
  email: string;
  themePreference: 'light' | 'dark';
  paydayDate: number | null;
  allocationEmergency: number;
  allocationSavings: number;
  allocationWishlist: number;
}

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  
  const [form, setForm] = useState({
    name: '',
    paydayDate: '',
    allocationEmergency: 0,
    allocationSavings: 0,
    allocationWishlist: 0,
  });

  const getToken = useCallback(() => localStorage.getItem('sf-token'), []);

  useEffect(() => {
    const fetchProfile = async () => {
      const token = getToken();
      if (!token) { router.push('/auth/login'); return; }
      
      try {
        const res = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        
        if (data.success) {
          setProfile(data.data);
          setForm({
            name: data.data.name,
            paydayDate: data.data.paydayDate ? String(data.data.paydayDate) : '',
            allocationEmergency: data.data.allocationEmergency || 0,
            allocationSavings: data.data.allocationSavings || 0,
            allocationWishlist: data.data.allocationWishlist || 0,
          });
        } else {
          router.push('/auth/login');
        }
      } catch {
        router.push('/auth/login');
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, [getToken, router]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setMessage({ text: 'Nama tidak boleh kosong', type: 'error' });
      return;
    }
    
    setIsSaving(true);
    setMessage({ text: '', type: '' });
    
    try {
      const token = getToken();
      const res = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({
          name: form.name,
          paydayDate: form.paydayDate ? parseInt(form.paydayDate) : null,
          allocationEmergency: parseInt(String(form.allocationEmergency)) || 0,
          allocationSavings: parseInt(String(form.allocationSavings)) || 0,
          allocationWishlist: parseInt(String(form.allocationWishlist)) || 0,
        })
      });
      
      const data = await res.json();
      
      if (data.success) {
        setMessage({ text: 'Profil berhasil diperbarui', type: 'success' });
        setProfile(prev => prev ? { ...prev, ...data.data } : null);
        
        // Update user cache if needed
        const cachedUser = localStorage.getItem('sf-user');
        if (cachedUser) {
          const user = JSON.parse(cachedUser);
          localStorage.setItem('sf-user', JSON.stringify({ ...user, ...data.data }));
        }
      } else {
        setMessage({ text: data.message || 'Gagal menyimpan', type: 'error' });
      }
    } catch {
      setMessage({ text: 'Terjadi kesalahan jaringan', type: 'error' });
    } finally {
      setIsSaving(false);
      setTimeout(() => setMessage({ text: '', type: '' }), 3000);
    }
  };

  const handleLogout = () => {
    setIsLoggingOut(true);
    // Add small delay for animation/UX
    setTimeout(() => {
      localStorage.removeItem('sf-token');
      localStorage.removeItem('sf-user');
      router.push('/');
    }, 800);
  };

  return (
    <div className="page-shell">
      <header className="page-header">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <h1 className="text-xl font-bold text-surface-900 dark:text-white">Profil</h1>
        </div>
      </header>

      <main className="page-content space-y-5">
        {isLoading ? (
          <div className="space-y-4">
            <div className="card p-6 flex flex-col items-center">
              <div className="skeleton w-24 h-24 rounded-full mb-4" />
              <div className="skeleton h-6 w-48 rounded mb-2" />
              <div className="skeleton h-4 w-32 rounded" />
            </div>
            <div className="skeleton h-64 rounded-2xl" />
          </div>
        ) : profile ? (
          <>
            {/* Profile Avatar Card */}
            <div className="card p-6 flex flex-col items-center relative overflow-hidden">
              <div className="absolute top-0 w-full h-24 bg-gradient-to-r from-primary-600 to-accent-600 opacity-20" />
              
              <div className="relative z-10">
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary-500 to-accent-500 p-1 mb-4 mx-auto shadow-glow-primary">
                  <div className="w-full h-full bg-surface-900 rounded-full flex items-center justify-center text-3xl font-bold text-white border-4 border-surface-900">
                    {profile.name.charAt(0).toUpperCase()}
                  </div>
                </div>
                <h2 className="text-xl font-bold text-surface-900 dark:text-white text-center">{profile.name}</h2>
                <p className="text-slate-400 text-sm text-center mt-1">{profile.email}</p>
                <div className="flex justify-center mt-3">
                  <span className="badge-need">SmartFlow Member</span>
                </div>
              </div>
            </div>

            {/* Settings Form */}
            <form onSubmit={handleSave} className="card p-5">
              <h3 className="font-bold text-base text-surface-900 dark:text-white mb-4">Pengaturan Akun</h3>
              
              {message.text && (
                <div className={`mb-4 p-3 rounded-xl text-sm ${
                  message.type === 'success' 
                    ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800' 
                    : 'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
                }`}>
                  {message.text}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="form-label">Nama Lengkap</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="form-input"
                    required
                  />
                </div>

                <div>
                  <label className="form-label">Tanggal Kiriman / Gajian</label>
                  <select
                    value={form.paydayDate}
                    onChange={(e) => setForm({ ...form, paydayDate: e.target.value })}
                    className="form-select"
                  >
                    <option value="">Tidak di set (Opsional)</option>
                    {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                      <option key={d} value={d}>Tanggal {d} setiap bulan</option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-400 mt-1.5">
                    Membantu reset siklus jatah harian kamu secara otomatis.
                  </p>
                </div>

                {/* Income Allocation Section */}
                <div className="pt-4 border-t border-surface-200 dark:border-surface-700">
                  <h4 className="font-semibold text-sm text-surface-900 dark:text-white mb-4">Alokasi Gajian / Bonus</h4>
                  <p className="text-xs text-slate-400 mb-4">
                    Atur persentase pembagian otomatis uang masuk ke kantong yang berbeda. Sisanya masuk ke kantong MAIN.
                  </p>

                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div>
                      <label className="form-label text-xs">Darurat</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={String(form.allocationEmergency)}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          setForm({ ...form, allocationEmergency: Math.min(100, val) });
                        }}
                        className="form-input text-center"
                        placeholder="0"
                      />
                      <p className="text-xs text-slate-400 mt-1">%</p>
                    </div>

                    <div>
                      <label className="form-label text-xs">Tabungan</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={String(form.allocationSavings)}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          setForm({ ...form, allocationSavings: Math.min(100, val) });
                        }}
                        className="form-input text-center"
                        placeholder="0"
                      />
                      <p className="text-xs text-slate-400 mt-1">%</p>
                    </div>

                    <div>
                      <label className="form-label text-xs">Wishlist</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={String(form.allocationWishlist)}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          setForm({ ...form, allocationWishlist: Math.min(100, val) });
                        }}
                        className="form-input text-center"
                        placeholder="0"
                      />
                      <p className="text-xs text-slate-400 mt-1">%</p>
                    </div>
                  </div>

                  {/* Allocation Breakdown */}
                  <div className="bg-surface-50 dark:bg-surface-800 rounded-lg p-3 space-y-2">
                    {(() => {
                      const emergency = form.allocationEmergency || 0;
                      const savings = form.allocationSavings || 0;
                      const wishlist = form.allocationWishlist || 0;
                      const main = 100 - emergency - savings - wishlist;
                      
                      return (
                        <>
                          {emergency > 0 && (
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-slate-600 dark:text-slate-400">Darurat</span>
                              <span className="font-semibold text-rose-600 dark:text-rose-400">{emergency}%</span>
                            </div>
                          )}
                          {savings > 0 && (
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-slate-600 dark:text-slate-400">Tabungan</span>
                              <span className="font-semibold text-emerald-600 dark:text-emerald-400">{savings}%</span>
                            </div>
                          )}
                          {wishlist > 0 && (
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-slate-600 dark:text-slate-400">Wishlist</span>
                              <span className="font-semibold text-blue-600 dark:text-blue-400">{wishlist}%</span>
                            </div>
                          )}
                          {main > 0 && (
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-slate-600 dark:text-slate-400">MAIN</span>
                              <span className="font-semibold text-primary-600 dark:text-primary-400">{main}%</span>
                            </div>
                          )}
                          {main < 0 && (
                            <div className="text-xs text-rose-600 dark:text-rose-400 font-semibold">
                              ⚠️ Total exceeds 100%
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSaving}
                className="w-full mt-6 py-3 bg-primary-600 hover:bg-primary-500 text-white rounded-xl font-bold text-sm transition-all disabled:opacity-50"
              >
                {isSaving ? 'Menyimpan...' : 'Simpan Perubahan'}
              </button>
            </form>

            {/* App Info & Danger Zone */}
            <div className="space-y-3">
              <button
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="w-full card p-4 flex items-center justify-center gap-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/10 transition-colors cursor-pointer disabled:opacity-50 font-semibold"
              >
                {isLoggingOut ? (
                  <span className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
                    Keluar...
                  </span>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Keluar Akun
                  </>
                )}
              </button>
              
              <div className="text-center py-4">
                <p className="text-xs text-slate-500 font-medium">SmartFlow v1.0.0</p>
                <p className="text-xs text-slate-400 mt-1">Dibuat dengan ❤️ untuk mahasiswa</p>
              </div>
            </div>
          </>
        ) : null}
      </main>

      <BottomNav />
    </div>
  );
}
