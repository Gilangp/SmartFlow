'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Home, ClipboardList, Wallet, Tag, TrendingUp, User, LogOut } from 'lucide-react';

const navItems = [
  {
    href: '/dashboard',
    label: 'Beranda',
    icon: (active: boolean) => (
      <Home className={`w-6 h-6 transition-all duration-200 ${active ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-500 dark:text-gray-400'}`} strokeWidth={1.8} />
    ),
  },
  {
    href: '/transactions',
    label: 'Transaksi',
    icon: (active: boolean) => (
      <ClipboardList className={`w-6 h-6 transition-all duration-200 ${active ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-500 dark:text-gray-400'}`} strokeWidth={1.8} />
    ),
  },
  {
    href: '/pockets',
    label: 'Kantong',
    icon: (active: boolean) => (
      <Wallet className={`w-6 h-6 transition-all duration-200 ${active ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-500 dark:text-gray-400'}`} strokeWidth={1.8} />
    ),
  },
  {
    href: '/categories',
    label: 'Kategori',
    icon: (active: boolean) => (
      <Tag className={`w-6 h-6 transition-all duration-200 ${active ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-500 dark:text-gray-400'}`} strokeWidth={1.8} />
    ),
  },
  {
    href: '/profile',
    label: 'Profil',
    icon: (active: boolean) => (
      <User className={`w-6 h-6 transition-all duration-200 ${active ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-500 dark:text-gray-400'}`} strokeWidth={1.8} />
    ),
  },
];

export default function Navigation() {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = () => {
    localStorage.removeItem('sf-token');
    localStorage.removeItem('sf-user');
    router.push('/');
  };

  return (
    <>
      {/* Mobile Bottom Nav */}
      <nav className="mobile-bottom-nav md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-gray-950/95 backdrop-blur-xl border-t border-gray-100 dark:border-gray-800 pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-center justify-around px-2 py-2">
          {navItems.filter(i => !(i as any).hideOnMobile).map((item) => {
            const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  relative flex flex-col items-center gap-1 py-2 px-2 rounded-xl transition-all duration-200
                  ${isActive 
                    ? 'text-indigo-600 dark:text-indigo-400' 
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                  }
                `}
              >
                {item.icon(isActive)}
                <span className="text-[10px] font-medium">
                  {item.label}
                </span>
                {isActive && (
                  <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-indigo-600 dark:bg-indigo-400" />
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Desktop Sidebar Nav */}
      <aside className="hidden md:flex flex-col fixed top-0 left-0 h-screen w-64 bg-white/80 dark:bg-gray-950/80 backdrop-blur-3xl border-r border-gray-100 dark:border-gray-800 z-50">
        <div className="p-6 pb-2">
          <div className="flex items-center gap-2.5">
            <img src="/icon-512x512.png" alt="Finto" className="w-10 h-10 object-contain rounded-xl" />
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-indigo-400">
              Finto
            </h1>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-8 px-4 space-y-2">
          <p className="px-3 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-4">
            Menu Utama
          </p>
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  flex items-center gap-4 px-4 py-3 rounded-2xl transition-all duration-300 group
                  ${isActive 
                    ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shadow-sm' 
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-gray-200'
                  }
                `}
              >
                <div className={`${isActive ? 'scale-110' : 'group-hover:scale-110'} transition-transform duration-300`}>
                  {item.icon(isActive)}
                </div>
                <span className="font-medium text-sm">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>

        {/* Desktop Logout Button */}
        <div className="p-4 border-t border-gray-100 dark:border-gray-800">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-4 px-4 py-3 rounded-2xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-all duration-300 group font-medium text-sm"
          >
              <LogOut className="w-6 h-6 text-rose-600 dark:text-rose-400" strokeWidth={1.8} />
            <span>Keluar</span>
          </button>
        </div>
      </aside>
    </>
  );
}
