import type { Metadata, Viewport } from 'next';
import AdMobProvider from '@/components/AdMobProvider';
import './globals.css';

export const metadata: Metadata = {
  title: 'SmartFlow - Student Financial Companion',
  description: 'Kelola keuangan mahasiswa dengan Jatah Harian cerdas dan AI Roaster. Stop boros, mulai nabung!',
  manifest: '/manifest.json',
  keywords: ['keuangan mahasiswa', 'manajemen keuangan', 'jatah harian', 'tabungan', 'budgeting'],
  authors: [{ name: 'SmartFlow Team' }],
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'SmartFlow',
  },
  openGraph: {
    title: 'SmartFlow - Student Financial Companion',
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
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
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
              /* Ini memastikan TIDAK ADA konten/tombol apapun yang tertutup iklan di halaman manapun */
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
                /* Konten utama: padding tambahan untuk menu bawah + iklan */
                .mobile-content-container {
                  padding-bottom: calc(var(--banner-height, 0px) + 80px) !important;
                }
              }
            `,
          }}
        />
      </head>
      <body>
        <AdMobProvider>
          {children}
        </AdMobProvider>
      </body>
    </html>
  );
}
