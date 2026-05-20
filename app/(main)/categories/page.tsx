'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { CategoryRecord } from '@/types';

export default function CategoriesPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editItem, setEditItem] = useState<CategoryRecord | null>(null);
  const [deleteItem, setDeleteItem] = useState<CategoryRecord | null>(null);
  const [form, setForm] = useState({ name: '', type: 'NEED' as 'NEED' | 'WANT' });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const getToken = useCallback(() => localStorage.getItem('sf-token'), []);

  const fetchCategories = useCallback(async () => {
    const token = getToken();
    if (!token) { router.push('/auth/login'); return; }
    try {
      const res = await fetch('/api/categories', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.success) setCategories(data.data);
      else router.push('/auth/login');
    } catch { router.push('/auth/login'); }
    finally { setIsLoading(false); }
  }, [getToken, router]);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  const handleOpenAdd = () => {
    setForm({ name: '', type: 'NEED' });
    setError('');
    setEditItem(null);
    setShowAddModal(true);
  };

  const handleOpenEdit = (cat: CategoryRecord) => {
    setForm({ name: cat.name, type: cat.type });
    setEditItem(cat);
    setError('');
    setShowAddModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Nama kategori wajib diisi'); return; }
    setIsSaving(true);
    setError('');
    const token = getToken();
    try {
      let res;
      if (editItem) {
        res = await fetch(`/api/categories/${editItem.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(form),
        });
      } else {
        res = await fetch('/api/categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(form),
        });
      }
      const data = await res.json();
      if (data.success) {
        setShowAddModal(false);
        fetchCategories();
      } else {
        setError(data.message || 'Gagal menyimpan');
      }
    } catch { setError('Terjadi kesalahan'); }
    finally { setIsSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteItem) return;
    const token = getToken();
    try {
      const res = await fetch(`/api/categories/${deleteItem.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setDeleteItem(null);
        fetchCategories();
      } else {
        setError(data.message || 'Gagal menghapus');
      }
    } catch { /* ignore */ }
  };

  const needs = categories.filter((c) => c.type === 'NEED');
  const wants = categories.filter((c) => c.type === 'WANT');

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-gray-950">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-gray-950/80 backdrop-blur-xl border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-5 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Kategori</h1>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">
              {categories.length} kategori aktif
            </p>
          </div>
          <button
            onClick={handleOpenAdd}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium transition-all"
          >
            + Tambah
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-5 py-6 space-y-6">
        {/* Info Card */}
        <div className="bg-indigo-50 dark:bg-indigo-500/5 rounded-xl p-4 border-l-4 border-indigo-500">
          <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">
            Need vs Want
          </p>
          <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
            <span className="font-semibold text-indigo-600 dark:text-indigo-400">Need</span> = Kebutuhan pokok (makan, transportasi, kos)
            <br />
            <span className="font-semibold text-indigo-600 dark:text-indigo-400">Want</span> = Keinginan (hiburan, fashion, kopi)
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            {/* Need Categories */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-600" />
                <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Kebutuhan (Need)
                </h2>
                <span className="text-xs text-gray-400">{needs.length}</span>
              </div>
              
              <div className="space-y-2">
                {needs.length === 0 ? (
                  <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-6 text-center">
                    <p className="text-sm text-gray-500 dark:text-gray-500">Belum ada kategori kebutuhan</p>
                  </div>
                ) : (
                  needs.map((cat) => (
                    <div
                      key={cat.id}
                      className="group flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-indigo-100 dark:bg-indigo-500/10 flex items-center justify-center">
                          <span className="text-indigo-600 dark:text-indigo-400 text-sm font-medium">
                            {cat.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-sm text-gray-900 dark:text-white">
                            {cat.name}
                          </p>
                          <span className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">
                            Need
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleOpenEdit(cat)}
                          className="w-8 h-8 rounded-lg text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-all"
                        >
                          <svg className="w-4 h-4 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setDeleteItem(cat)}
                          className="w-8 h-8 rounded-lg text-gray-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-all"
                        >
                          <svg className="w-4 h-4 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            {/* Want Categories */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-600" />
                <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Keinginan (Want)
                </h2>
                <span className="text-xs text-gray-400">{wants.length}</span>
              </div>
              
              <div className="space-y-2">
                {wants.length === 0 ? (
                  <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-6 text-center">
                    <p className="text-sm text-gray-500 dark:text-gray-500">Belum ada kategori keinginan</p>
                  </div>
                ) : (
                  wants.map((cat) => (
                    <div
                      key={cat.id}
                      className="group flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-indigo-100 dark:bg-indigo-500/10 flex items-center justify-center">
                          <span className="text-indigo-600 dark:text-indigo-400 text-sm font-medium">
                            {cat.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-sm text-gray-900 dark:text-white">
                            {cat.name}
                          </p>
                          <span className="text-xs text-indigo-400 font-medium">
                            Want
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleOpenEdit(cat)}
                          className="w-8 h-8 rounded-lg text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-all"
                        >
                          <svg className="w-4 h-4 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setDeleteItem(cat)}
                          className="w-8 h-8 rounded-lg text-gray-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-all"
                        >
                          <svg className="w-4 h-4 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </>
        )}
      </main>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-4" onClick={() => setShowAddModal(false)}>
          <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-800">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editItem ? 'Edit Kategori' : 'Kategori Baru'}
              </h2>
              <button onClick={() => setShowAddModal(false)} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition">
                ✕
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-5 space-y-4">
              {error && (
                <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-rose-600 dark:text-rose-400 text-sm">
                  {error}
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Nama Kategori
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Contoh: Makan, Transportasi, Hobi"
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Tipe
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {(['NEED', 'WANT'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, type: t }))}
                      className={`py-2.5 rounded-lg font-medium text-sm transition-all ${
                        form.type === t
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                      }`}
                    >
                      {t === 'NEED' ? 'Kebutuhan' : 'Keinginan'}
                    </button>
                  ))}
                </div>
              </div>
              
              <button
                type="submit"
                disabled={isSaving}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium text-sm transition-all disabled:opacity-50"
              >
                {isSaving ? 'Menyimpan...' : (editItem ? 'Simpan Perubahan' : 'Tambah Kategori')}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteItem && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setDeleteItem(null)}>
          <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-sm p-6 text-center shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Hapus Kategori?
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
              Kategori <span className="font-medium text-gray-900 dark:text-white">"{deleteItem.name}"</span> akan dihapus secara permanen.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteItem(null)} className="flex-1 py-2.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium text-sm transition-all">
                Batal
              </button>
              <button onClick={handleDelete} className="flex-1 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-medium text-sm transition-all">
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}