'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Crown, GraduationCap, Zap, ChevronRight } from 'lucide-react';
import Link from 'next/link';

interface SubscriptionData {
  plan: 'TRIAL' | 'STUDENT' | 'PREMIUM';
  isActive: boolean;
  isExpired: boolean;
  daysLeft: number | null;
  limits: {
    maxDaily: number;
    maxMonthly: number;
    canScanReceipt: boolean;
  };
}

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
  const [sub, setSub] = useState<SubscriptionData | null>(null);
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
      if (!token) { router.push('/login'); return; }
      
      try {
        const [profileRes, subRes] = await Promise.all([
          fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } }),
          fetch('/api/subscription', { headers: { Authorization: `Bearer ${token}` } })
        ]);
        
        const profileData = await profileRes.json();
        const subData = await subRes.json();
        
        if (profileData.success) {
          setProfile(profileData.data);
          setForm({
            name: profileData.data.name,
            paydayDate: profileData.data.paydayDate ? String(profileData.data.paydayDate) : '',
            allocationEmergency: profileData.data.allocationEmergency || 0,
            allocationSavings: profileData.data.allocationSavings || 0,
            allocationWishlist: profileData.data.allocationWishlist || 0,
          });
        } else {
          router.push('/login');
        }

        if (subData.success) {
          setSub(subData.data);
        }
      } catch {
        router.push('/login');
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
      } else {
        setMessage({ text: data.message || 'Gagal menyimpan', type: 'error' });
      }
    } catch {
      setMessage({ text: 'Terjadi kesalahan', type: 'error' });
    } finally {
      setIsSaving(false);
      setTimeout(() => setMessage({ text: '', type: '' }), 3000);
    }
  };

  const handleLogout = () => {
    setIsLoggingOut(true);
    setTimeout(() => {
      localStorage.removeItem('sf-token');
      localStorage.removeItem('sf-user');
      router.push('/');
    }, 500);
  };

  const totalAllocation = (form.allocationEmergency || 0) + (form.allocationSavings || 0) + (form.allocationWishlist || 0);
  const mainAllocation = Math.max(0, 100 - totalAllocation);
  const isOverAllocation = totalAllocation > 100;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Memuat profil...</p>
        </div>
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-gray-950">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-gray-950/80 backdrop-blur-xl border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-5 py-4">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Profil</h1>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-5 py-6 space-y-6">
        {/* Profile Avatar Card */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 text-center border border-gray-200 dark:border-gray-800 relative overflow-hidden">
          {/* Subscription Banner inside Profile */}
          <div className="w-20 h-20 rounded-full bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center mx-auto mb-3">
            <span className="text-2xl font-semibold text-indigo-600 dark:text-indigo-400">
              {profile.name.charAt(0).toUpperCase()}
            </span>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center justify-center gap-2">
            {profile.name}
          </h2>
          <p className="text-xs text-gray-500 mt-0.5 mb-4">{profile.email}</p>

          {/* Badge & Plan Info */}
          {sub && (
            <div className={`mx-auto max-w-xs p-3 rounded-xl border flex items-center justify-between text-left ${
              sub.plan === 'PREMIUM' ? 'bg-indigo-50 border-indigo-200 dark:bg-indigo-900/20 dark:border-indigo-800' :
              sub.plan === 'STUDENT' ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800' :
              'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full ${
                  sub.plan === 'PREMIUM' ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-800/50 dark:text-indigo-400' :
                  sub.plan === 'STUDENT' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-800/50 dark:text-emerald-400' :
                  'bg-amber-100 text-amber-600 dark:bg-amber-800/50 dark:text-amber-400'
                }`}>
                  {sub.plan === 'PREMIUM' && <Crown className="w-4 h-4" />}
                  {sub.plan === 'STUDENT' && <GraduationCap className="w-4 h-4" />}
                  {sub.plan === 'TRIAL' && <Zap className="w-4 h-4" />}
                </div>
                <div>
                  <p className={`text-xs font-bold uppercase tracking-wide ${
                    sub.plan === 'PREMIUM' ? 'text-indigo-700 dark:text-indigo-400' :
                    sub.plan === 'STUDENT' ? 'text-emerald-700 dark:text-emerald-400' :
                    'text-amber-700 dark:text-amber-400'
                  }`}>
                    {sub.plan} PLAN
                  </p>
                  <p className="text-[10px] text-gray-600 dark:text-gray-400">
                    {sub.plan === 'TRIAL' ? `Sisa ${sub.daysLeft} hari` : 'Aktif selamanya'}
                  </p>
                </div>
              </div>
              
              <Link href="/upgrade" className="flex items-center text-xs font-semibold px-3 py-1.5 rounded-lg bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition">
                Upgrade <ChevronRight className="w-3 h-3 ml-0.5" />
              </Link>
            </div>
          )}
        </div>

        {/* Settings Form */}
        <form onSubmit={handleSave} className="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-gray-200 dark:border-gray-800">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Pengaturan</h3>
          
          {message.text && (
            <div className={`mb-4 p-3 rounded-lg text-sm ${
              message.type === 'success' 
                ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-500/20' 
                : 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-100 dark:border-rose-500/20'
            }`}>
              {message.text}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Nama Lengkap
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Tanggal Gajian
              </label>
              <select
                value={form.paydayDate}
                onChange={(e) => setForm({ ...form, paydayDate: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
              >
                <option value="">Tidak diset</option>
                {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>Tanggal {d}</option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Membantu reset jatah harian otomatis
              </p>
            </div>

            {/* Income Allocation */}
            <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
              <h4 className="font-medium text-sm text-gray-900 dark:text-white mb-3">
                Alokasi Pemasukan
              </h4>
              
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Darurat
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={form.allocationEmergency}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 0;
                      setForm({ ...form, allocationEmergency: Math.min(100, val) });
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-center focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  />
                  <p className="text-xs text-gray-500 text-center mt-1">%</p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Tabungan
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={form.allocationSavings}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 0;
                      setForm({ ...form, allocationSavings: Math.min(100, val) });
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-center focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  />
                  <p className="text-xs text-gray-500 text-center mt-1">%</p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Wishlist
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={form.allocationWishlist}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 0;
                      setForm({ ...form, allocationWishlist: Math.min(100, val) });
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-center focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  />
                  <p className="text-xs text-gray-500 text-center mt-1">%</p>
                </div>
              </div>

              {/* Allocation Breakdown */}
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 space-y-2">
                {form.allocationEmergency > 0 && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-600 dark:text-gray-400">Dana Darurat</span>
                    <span className="font-medium text-rose-600 dark:text-rose-400">{form.allocationEmergency}%</span>
                  </div>
                )}
                {form.allocationSavings > 0 && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-600 dark:text-gray-400">Tabungan</span>
                    <span className="font-medium text-emerald-600 dark:text-emerald-400">{form.allocationSavings}%</span>
                  </div>
                )}
                {form.allocationWishlist > 0 && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-600 dark:text-gray-400">Wishlist</span>
                    <span className="font-medium text-indigo-600 dark:text-indigo-400">{form.allocationWishlist}%</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-xs pt-1 border-t border-gray-200 dark:border-gray-700">
                  <span className="text-gray-600 dark:text-gray-400">Dompet Utama</span>
                  <span className={`font-medium ${isOverAllocation ? 'text-rose-600' : 'text-gray-900 dark:text-white'}`}>
                    {isOverAllocation ? 'Melebihi 100%' : `${mainAllocation}%`}
                  </span>
                </div>
              </div>
              
              {isOverAllocation && (
                <p className="text-xs text-rose-600 dark:text-rose-400 mt-2">
                  Total alokasi tidak boleh melebihi 100%
                </p>
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={isSaving || isOverAllocation}
            className="w-full mt-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium text-sm transition-all disabled:opacity-50"
          >
            {isSaving ? 'Menyimpan...' : 'Simpan Perubahan'}
          </button>
        </form>

        {/* Category Link (Mobile) */}
        <Link
          href="/categories"
          className="md:hidden flex items-center justify-between w-full py-3 px-4 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 font-medium text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-all"
        >
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
            Kelola Kategori
          </div>
          <ChevronRight className="w-4 h-4 text-gray-400" />
        </Link>

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="md:hidden w-full py-3 rounded-lg border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 font-medium text-sm hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-all disabled:opacity-50"
        >
          {isLoggingOut ? 'Keluar...' : 'Keluar Akun'}
        </button>

        {/* Version Info */}
        <p className="text-center text-xs text-gray-400 py-4">
          Finto v1.0 — Untuk mahasiswa Indonesia
        </p>
      </main>
    </div>
  );
}