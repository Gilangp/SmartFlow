import type { Metadata, Viewport } from 'next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import AdMobProvider from '@/components/AdMobProvider';
import OfflineStatusDetector from '@/components/OfflineStatusDetector';
import InstallPrompt from '@/components/InstallPrompt';
import './globals.css';

export const metadata: Metadata = {
  title: 'Finto - Student Financial Companion',
  description: 'Kelola keuangan mahasiswa dengan Jatah Harian cerdas dan AI Roaster. Stop boros, mulai nabung!',
  manifest: '/manifest.json',
  keywords: ['keuangan mahasiswa', 'manajemen keuangan', 'jatah harian', 'tabungan', 'budgeting'],
  authors: [{ name: 'Finto Team' }],
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Finto',
  },
  openGraph: {
    title: 'Finto - Student Financial Companion',
    description: 'Kelola keuangan mahasiswa dengan Jatah Harian cerdas',
    type: 'website',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#020617' },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon.ico?v=2" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icon-192x192.png?v=2" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png?v=2" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const theme = localStorage.getItem('sf-theme') || 'dark';
                document.documentElement.classList.toggle('dark', theme === 'dark');
              } catch (e) {}
            `,
          }}
        />
        <style
          dangerouslySetInnerHTML={{
            __html: `
              :root {
                --banner-height: 0px;
              }

              /* === GLOBAL: Semua halaman mendapat padding bawah otomatis sesuai tinggi iklan === */
              body {
                padding-bottom: var(--banner-height, 0px) !important;
                transition: padding-bottom 0.2s ease;
              }

              /* === NAVIGASI BAWAH (Mobile): Terdorong ke atas iklan otomatis === */
              @media (max-width: 767px) {
                .mobile-bottom-nav {
                  bottom: var(--banner-height, 0px) !important;
                  transition: bottom 0.2s ease;
                }
                .mobile-content-container {
                  padding-bottom: calc(var(--banner-height, 0px) + 80px) !important;
                }
              }

              /* Animasi PWA */
              @keyframes slideUp {
                from { opacity: 0; transform: translateY(20px); }
                to { opacity: 1; transform: translateY(0); }
              }
              .animate-slide-up {
                animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
              }
            `,
          }}
        />
      </head>
      <body>
        <AdMobProvider>
          <OfflineStatusDetector />
          <InstallPrompt />
          {children}
          <SpeedInsights />
        </AdMobProvider>
      </body>
    </html>
  );
}
