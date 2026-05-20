'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import BottomNav from '@/components/BottomNav';
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
      }
    } catch { /* ignore */ }
  };

  const needs = categories.filter((c) => c.type === 'NEED');
  const wants = categories.filter((c) => c.type === 'WANT');

  return (
    <div className="page-shell">
      <header className="page-header">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-surface-900 dark:text-white">Kategori</h1>
            <p className="text-sm text-slate-400">{categories.length} kategori aktif</p>
          </div>
          <button
            id="btn-add-category"
            onClick={handleOpenAdd}
            className="btn btn-primary text-sm"
          >
            + Tambah
          </button>
        </div>
      </header>

      <main className="page-content space-y-5">
        {/* Info */}
        <div className="card p-4 border-l-4 border-l-primary-500">
          <p className="text-sm font-semibold text-surface-900 dark:text-white mb-1">💡 Need vs Want</p>
          <p className="text-xs text-slate-400 leading-relaxed">
            <strong className="text-primary-500">Need</strong> = Kebutuhan pokok (makan, transportasi, kos, dll).<br />
            <strong className="text-accent-400">Want</strong> = Keinginan (hiburan, fashion, ngopi, dll). AI menggunakan label ini untuk analisis.
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => <div key={i} className="skeleton h-14 rounded-xl" />)}
          </div>
        ) : (
          <>
            {/* Need Categories */}
            <section>
              <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary-500" />
                Kebutuhan (Need) — {needs.length}
              </h2>
              <div className="card overflow-hidden">
                {needs.length === 0 ? (
                  <div className="p-4 text-center text-sm text-slate-400">Belum ada kategori kebutuhan</div>
                ) : (
                  <div className="divide-y divide-surface-100 dark:divide-surface-700/50">
                    {needs.map((cat) => (
                      <div key={cat.id} className="flex items-center justify-between px-4 py-3 hover:bg-surface-50 dark:hover:bg-surface-700/30 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-primary-100 dark:bg-primary-900/30 rounded-lg flex items-center justify-center">
                            <span className="text-primary-600 dark:text-primary-400 text-sm font-bold">
                              {cat.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="font-semibold text-sm text-surface-900 dark:text-white">{cat.name}</p>
                            <span className="badge-need">Need</span>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleOpenEdit(cat)}
                            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => setDeleteItem(cat)}
                            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            {/* Want Categories */}
            <section>
              <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-accent-500" />
                Keinginan (Want) — {wants.length}
              </h2>
              <div className="card overflow-hidden">
                {wants.length === 0 ? (
                  <div className="p-4 text-center text-sm text-slate-400">Belum ada kategori keinginan</div>
                ) : (
                  <div className="divide-y divide-surface-100 dark:divide-surface-700/50">
                    {wants.map((cat) => (
                      <div key={cat.id} className="flex items-center justify-between px-4 py-3 hover:bg-surface-50 dark:hover:bg-surface-700/30 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-accent-100 dark:bg-accent-900/30 rounded-lg flex items-center justify-center">
                            <span className="text-accent-600 dark:text-accent-400 text-sm font-bold">
                              {cat.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="font-semibold text-sm text-surface-900 dark:text-white">{cat.name}</p>
                            <span className="badge-want">Want</span>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <button onClick={() => handleOpenEdit(cat)} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                          </button>
                          <button onClick={() => setDeleteItem(cat)} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </>
        )}
      </main>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="modal-backdrop" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="text-lg font-bold text-surface-900 dark:text-white">
                {editItem ? 'Edit Kategori' : 'Kategori Baru'}
              </h2>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">✕</button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              {error && (
                <div className="p-3 rounded-xl bg-rose-100 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-700/50 text-rose-600 dark:text-rose-300 text-sm">
                  {error}
                </div>
              )}
              <div>
                <label className="form-label">Nama Kategori</label>
                <input
                  id="cat-name"
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Contoh: Makan, Transportasi, Hobi..."
                  className="form-input"
                  required
                />
              </div>
              <div>
                <label className="form-label">Tipe</label>
                <div className="grid grid-cols-2 gap-3">
                  {(['NEED', 'WANT'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, type: t }))}
                      className={`py-3 rounded-xl font-semibold text-sm border-2 transition-all ${
                        form.type === t
                          ? t === 'NEED'
                            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                            : 'border-accent-500 bg-accent-50 dark:bg-accent-900/20 text-accent-700 dark:text-accent-300'
                          : 'border-surface-200 dark:border-surface-600 text-slate-500'
                      }`}
                    >
                      {t === 'NEED' ? '🔵 Kebutuhan (Need)' : '🟣 Keinginan (Want)'}
                    </button>
                  ))}
                </div>
              </div>
              <button
                id="cat-submit"
                type="submit"
                disabled={isSaving}
                className="w-full py-3.5 bg-primary-600 hover:bg-primary-500 text-white rounded-xl font-bold text-sm disabled:opacity-50 transition-all"
              >
                {isSaving ? 'Menyimpan...' : editItem ? '✅ Simpan Perubahan' : '✅ Tambah Kategori'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteItem && (
        <div className="modal-backdrop" onClick={() => setDeleteItem(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 text-center">
              <div className="text-4xl mb-3">🗑️</div>
              <h2 className="text-lg font-bold text-surface-900 dark:text-white mb-2">Hapus Kategori?</h2>
              <p className="text-sm text-slate-400 mb-5">
                Kategori <strong className="text-surface-900 dark:text-white">"{deleteItem.name}"</strong> akan dihapus. 
                Transaksi yang terkait mungkin terpengaruh.
              </p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteItem(null)} className="flex-1 py-3 bg-surface-100 dark:bg-surface-700 rounded-xl font-semibold text-sm text-slate-600 dark:text-slate-300">
                  Batal
                </button>
                <button onClick={handleDelete} className="flex-1 py-3 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-bold text-sm transition-all">
                  Hapus
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
