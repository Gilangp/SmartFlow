'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function Home() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-surface-950 via-surface-900 to-surface-950 overflow-hidden relative">
      {/* Animated gradient background - optimized */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary-500/20 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-accent-500/20 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary-500/5 rounded-full blur-3xl" />
        
        {/* Enhanced grid pattern */}
        <div 
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)
            `,
            backgroundSize: '60px 60px'
          }}
        />
        
        {/* Subtle radial gradient overlay */}
        <div className="absolute inset-0 bg-gradient-radial from-transparent via-surface-950/20 to-surface-950" />
      </div>

      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Navbar - better spacing */}
        <nav className="flex items-center justify-between px-6 py-5 max-w-7xl mx-auto w-full">
          <Link href="/" className="flex items-center gap-2 group cursor-pointer">
            <div className="w-9 h-9 bg-gradient-to-br from-primary-500 to-accent-500 rounded-xl flex items-center justify-center shadow-lg transition-transform group-hover:scale-105">
              <span className="text-white text-sm font-bold">SF</span>
            </div>
            <span className="text-white font-bold text-xl tracking-tight">SmartFlow</span>
          </Link>
          <div className="flex gap-4">
            <Link 
              href="/auth/login" 
              className="text-slate-300 hover:text-white text-sm font-medium px-4 py-2 rounded-xl transition-all duration-200 hover:bg-white/5"
            >
              Masuk
            </Link>
            <Link 
              href="/auth/register" 
              className="bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-500 hover:to-primary-400 text-white text-sm font-semibold px-5 py-2 rounded-xl shadow-lg shadow-primary-500/20 transition-all duration-300 hover:scale-105 hover:shadow-primary-500/30"
            >
              Mulai Gratis
            </Link>
          </div>
        </nav>

        {/* Hero Section */}
        <main className="flex-1 flex flex-col items-center justify-center px-4 py-12 text-center max-w-6xl mx-auto w-full">
          <div className={`transition-all duration-1000 ease-out ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
            {/* Badge - more interactive */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-500/10 border border-primary-500/20 text-primary-300 text-sm font-medium mb-8 backdrop-blur-sm hover:border-primary-500/40 transition-all">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              Student Financial Companion — Powered by AI
            </div>

            {/* Headline - better typography */}
            <h1 className="text-5xl sm:text-6xl lg:text-7xl xl:text-8xl font-black text-white mb-8 leading-tight tracking-tighter">
              Stop Lihat{' '}
              <span className="bg-gradient-to-r from-primary-400 via-accent-400 to-primary-400 bg-clip-text text-transparent animate-gradient">
                Total Saldo,
              </span>
              <br />
              Fokus ke{' '}
              <span className="bg-gradient-to-r from-emerald-400 via-primary-400 to-emerald-400 bg-clip-text text-transparent animate-gradient">
                Jatah Hari Ini
              </span>
            </h1>

            {/* Subheadline - more readable */}
            <p className="text-lg sm:text-xl text-slate-300 max-w-3xl mx-auto mb-12 leading-relaxed">
              SmartFlow mengubah cara kamu kelola uang — dari sekadar lihat saldo ke{' '}
              <strong className="text-white font-bold">strategi harian yang cerdas</strong>. 
              Dengan AI yang jujur (dan agak nyebelin), kamu bakal sadar ke mana duit kamu pergi.
            </p>

            {/* CTA Buttons - better visual hierarchy */}
            <div className="flex flex-col sm:flex-row gap-5 justify-center mb-20">
              <Link
                href="/auth/register"
                className="group relative inline-flex items-center justify-center gap-2 bg-gradient-to-r from-primary-600 via-primary-500 to-accent-600 hover:from-primary-500 hover:via-primary-400 hover:to-accent-500 text-white px-8 py-4 rounded-2xl text-base font-bold shadow-2xl shadow-primary-500/25 transition-all duration-300 hover:scale-105 hover:shadow-primary-500/40 overflow-hidden"
              >
                <span className="relative z-10">🚀 Mulai Gratis Sekarang</span>
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
              </Link>
              <Link
                href="/auth/login"
                className="inline-flex items-center justify-center bg-white/5 hover:bg-white/10 text-white border border-white/20 hover:border-white/30 px-8 py-4 rounded-2xl text-base font-semibold backdrop-blur-sm transition-all duration-300 hover:scale-105"
              >
                Sudah punya akun? Masuk →
              </Link>
            </div>

            {/* Feature pills - more compact and scannable */}
            <div className="flex flex-wrap justify-center gap-3 mb-24">
              {[
                { icon: '✅', text: 'Gratis Selamanya' },
                { icon: '🤖', text: 'AI Smart Input' },
                { icon: '💰', text: '4 Kantong Pintar' },
                { icon: '📊', text: 'Daily Budget Tracker' },
                { icon: '🔒', text: 'Data Aman Terenkripsi' }
              ].map((feature) => (
                <span 
                  key={feature.text} 
                  className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-full text-sm text-slate-300 hover:bg-white/10 hover:border-white/20 transition-all cursor-default"
                >
                  {feature.icon} {feature.text}
                </span>
              ))}
            </div>
          </div>

          {/* Feature Cards - staggered animation */}
          <div className="grid sm:grid-cols-3 gap-6 w-full max-w-6xl">
            {[
              {
                gradient: "from-primary-600 to-primary-800",
                icon: "📅",
                title: "Jatah Harian Otomatis",
                description: "Sistem kalkulasi cerdas yang membagi saldo ke jatah per hari — bukan per bulan. Anti bokek akhir bulan!",
                delay: "delay-0"
              },
              {
                gradient: "from-emerald-600 to-teal-700",
                icon: "🏦",
                title: "4 Kantong Finansial",
                description: "Pisahkan uang jajan, dana darurat, tabungan, dan wishlist secara otomatis setiap terima kiriman.",
                delay: "delay-100"
              },
              {
                gradient: "from-accent-600 to-rose-700",
                icon: "🤖",
                title: "AI Financial Roaster",
                description: "AI yang siap 'nge-roast' kebiasaan belanja kamu dengan bahasa yang jujur tapi menghibur. Biar kapok!",
                delay: "delay-200"
              }
            ].map((card, idx) => (
              <div 
                key={idx}
                className={`transition-all duration-700 ease-out ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'} ${card.delay}`}
              >
                <FeatureCard {...card} />
              </div>
            ))}
          </div>

          {/* Stats - with animated counters */}
          <div className={`mt-20 grid grid-cols-1 sm:grid-cols-3 gap-12 max-w-3xl mx-auto transition-all duration-700 delay-300 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
            <StatCard value="3x" label="Lebih hemat" description="dari pengguna aktif" />
            <StatCard value="< 3" label="Langkah" description="catat transaksi" />
            <StatCard value="100%" label="Gratis" description="untuk mahasiswa" />
          </div>
        </main>

        {/* Footer - better spacing */}
        <footer className="text-center py-8 border-t border-white/5 mt-12">
          <p className="text-slate-500 text-sm">
            © 2025 SmartFlow • Dibuat dengan ❤️ untuk mahasiswa Indonesia
          </p>
        </footer>
      </div>
    </div>
  );
}

function FeatureCard({
  gradient,
  icon,
  title,
  description,
}: {
  gradient: string;
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="group relative p-6 rounded-2xl bg-gradient-to-br from-white/5 to-white/0 border border-white/10 hover:border-white/20 hover:bg-white/10 transition-all duration-500 text-left overflow-hidden">
      <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${gradient} opacity-70 group-hover:opacity-100 transition-all duration-500 group-hover:h-1.5`} />
      
      {/* Animated shine effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
      
      <div className="text-4xl mb-4 transform transition-transform group-hover:scale-110">{icon}</div>
      <h3 className="text-white font-bold text-lg mb-3">{title}</h3>
      <p className="text-slate-400 text-sm leading-relaxed">{description}</p>
    </div>
  );
}

function StatCard({ value, label, description }: { value: string; label: string; description: string }) {
  return (
    <div className="text-center group">
      <div className="text-4xl sm:text-5xl font-black text-transparent bg-gradient-to-r from-white to-slate-400 bg-clip-text mb-2 group-hover:scale-105 transition-transform">
        {value}
      </div>
      <div className="text-white font-semibold text-base mb-1">{label}</div>
      <div className="text-slate-500 text-sm">{description}</div>
    </div>
  );
}