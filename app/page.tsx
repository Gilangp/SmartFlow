'use client';

import Link from 'next/link';
import { useEffect, useState, useCallback } from 'react';
import { 
  TrendingUp, 
  Bot, 
  Wallet, 
  GraduationCap, 
  Play, 
  Rocket, 
  ShieldCheck, 
  Clock, 
  Check, 
  Star, 
  ArrowUp
} from 'lucide-react';

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [activeNav, setActiveNav] = useState('beranda');
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    setMounted(true);
    const storedTheme = (localStorage.getItem('sf-theme') || 'dark') as 'light' | 'dark';
    setTheme(storedTheme);
    document.documentElement.classList.toggle('dark', storedTheme === 'dark');
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 300);
      
      const sections = ['beranda', 'fitur', 'cara-kerja', 'testimoni'];
      const scrollPos = window.scrollY + 100;
      
      for (const section of sections) {
        const element = document.getElementById(section);
        if (element) {
          const { offsetTop, offsetHeight } = element;
          if (scrollPos >= offsetTop && scrollPos < offsetTop + offsetHeight) {
            setActiveNav(section);
            break;
          }
        }
      }
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('sf-theme', newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
  };

  const scrollToSection = useCallback((sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setMobileMenuOpen(false);
    }
  }, []);

  const features = [
    {
      icon: <TrendingUp className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />,
      title: 'Jatah Harian Otomatis',
      description: 'Sistem membagi penghasilan dengan sisa hari dalam bulan. Fokus ke batas harian, bukan total saldo.',
      metric: 'Update real-time'
    },
    {
      icon: <Bot className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />,
      title: 'AI Pintar',
      description: 'Cukup ketik "makan siang 25rb", AI otomatis mengisi kategori. Cepat dan praktis.',
      metric: 'Natural Language'
    },
    {
      icon: <Wallet className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />,
      title: '4 Kantong Keuangan',
      description: 'Main, Darurat, Tabungan, Wishlist. Masing-masing punya aturan berbeda.',
      metric: 'Smart allocation'
    }
  ];

  const steps = [
    { number: '01', title: 'Daftar Akun', description: 'Gunakan email kampus atau upload KTM. Verifikasi cepat.', duration: '2 menit' },
    { number: '02', title: 'Atur Penghasilan', description: 'Masukkan pemasukan bulanan, atur tanggal gajian.', duration: '1 menit' },
    { number: '03', title: 'Mulai Hemat', description: 'Catat transaksi dan ikuti jatah harianmu.', duration: '30 detik/hari' }
  ];

  const testimonials = [
    {
      name: 'Andi Wijaya',
      role: 'Teknik Informatika, UGM',
      quote: 'Dulu selalu boncos akhir bulan. Sekarang pakai SmartFlow, 3 bulan nabung 40% lebih banyak.',
      rating: 5
    },
    {
      name: 'Sari Dewi',
      role: 'Manajemen, UI',
      quote: 'Sistem jatah harian bikin sadar pengeluaran. Gak pernah lagi panik akhir bulan.',
      rating: 5
    },
    {
      name: 'Rizki Pratama',
      role: 'Kedokteran, UNAIR',
      quote: 'Input pakai AI super praktis. Sekarang malah rajin catat pengeluaran.',
      rating: 5
    }
  ];

  const faqs = [
    { 
      q: 'Apa itu sistem jatah harian?', 
      a: 'Kami membagi total penghasilanmu dengan sisa hari dalam bulan. Hasilnya adalah batas maksimal yang bisa kamu habiskan hari ini. Ini lebih realistis daripada lihat total saldo.' 
    },
    { 
      q: 'Apakah data keuanganku aman?', 
      a: 'Sangat aman. Kami menggunakan enkripsi end-to-end dan tidak menyimpan data sensitif. Data hanya bisa diakses oleh kamu sendiri.' 
    },
    { 
      q: 'Bagaimana cara verifikasi mahasiswa?', 
      a: 'Cukup gunakan email kampus (.ac.id) atau upload foto KTM. Proses verifikasi otomatis kurang dari 5 menit.' 
    },
    { 
      q: 'Apakah benar-benar gratis?', 
      a: 'Ya, 100% gratis untuk mahasiswa Indonesia. Tidak ada biaya tersembunyi atau iklan.' 
    }
  ];

  const packages = [
    {
      name: 'Trial',
      price: 'Gratis',
      period: '14 hari',
      description: 'Coba semua fitur tanpa ribet',
      features: [
        'Semua fitur lengkap',
        'AI Financial Assistant',
        'Input pakai bahasa sehari-hari',
        '4 Kantong + progress tracking'
      ],
      popular: false,
      buttonText: 'Coba Gratis',
      buttonVariant: 'outline'
    },
    {
      name: 'Student',
      price: 'Rp 0',
      period: 'selamanya',
      description: 'Untuk mahasiswa terverifikasi',
      features: [
        'Semua fitur lengkap',
        'AI Financial Assistant',
        'Input pakai bahasa sehari-hari',
        '4 Kantong + progress tracking',
        'Verifikasi mahasiswa'
      ],
      popular: true,
      buttonText: 'Daftar Sekarang',
      buttonVariant: 'primary'
    },
    {
      name: 'Premium',
      price: 'Rp 49.000',
      period: 'bulan',
      description: 'Untuk profesional muda',
      features: [
        'Semua fitur Student',
        'Export data ke Excel',
        'Prioritas support 24/7',
        'Analisis mendalam',
        'Tanpa batasan transaksi'
      ],
      popular: false,
      buttonText: 'Langganan',
      buttonVariant: 'outline'
    }
  ];

  if (!mounted) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-950 flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-slate-100 transition-colors duration-300">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 dark:bg-gray-950/95 backdrop-blur-md border-b border-gray-100 dark:border-gray-800">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex justify-between items-center h-14 sm:h-16">
            {/* Logo */}
            <button 
              onClick={() => scrollToSection('beranda')}
              className="flex items-center gap-2"
            >
              <div className="w-7 h-7 sm:w-8 sm:h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-xs sm:text-sm">SF</span>
              </div>
              <span className="font-bold text-lg sm:text-xl text-gray-900 dark:text-white">SmartFlow</span>
            </button>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-6">
              {[
                { id: 'fitur', label: 'Fitur' },
                { id: 'cara-kerja', label: 'Cara Kerja' },
                { id: 'testimoni', label: 'Testimoni' }
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => scrollToSection(item.id)}
                  className={`text-sm transition ${
                    activeNav === item.id 
                      ? 'text-indigo-600 dark:text-indigo-400 font-semibold' 
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {/* Right Actions */}
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-2">
                <Link href="/auth/login" className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white px-3 py-1.5 transition">
                  Masuk
                </Link>
                <Link href="/auth/register" className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition">
                  Daftar
                </Link>
              </div>

              {/* Theme Toggle Button */}
              <button
                onClick={toggleTheme}
                className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all"
                aria-label="Toggle theme"
              >
                {theme === 'dark' ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                )}
              </button>

              {/* Mobile Menu Button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
              >
                <span className="text-xl">{mobileMenuOpen ? '✕' : '☰'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        <div className={`md:hidden bg-white dark:bg-gray-950 border-t border-gray-100 dark:border-gray-800 transition-all duration-300 ${
          mobileMenuOpen ? 'opacity-100 visible' : 'opacity-0 invisible hidden'
        }`}>
          <div className="flex flex-col py-2">
            {[
              { id: 'fitur', label: 'Fitur' },
              { id: 'cara-kerja', label: 'Cara Kerja' },
              { id: 'testimoni', label: 'Testimoni' }
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => scrollToSection(item.id)}
                className="px-4 py-3 text-left text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900 transition"
              >
                {item.label}
              </button>
            ))}
            <div className="border-t border-gray-100 dark:border-gray-800 mt-2 pt-3 px-4 space-y-2">
              <Link href="/auth/login" className="block w-full text-center border border-indigo-600 text-indigo-600 dark:text-indigo-400 px-4 py-2 rounded-lg font-medium">
                Masuk
              </Link>
              <Link href="/auth/register" className="block w-full text-center bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium">
                Daftar Gratis
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section id="beranda" className="relative pt-20 pb-12 sm:pt-28 sm:pb-16 md:pt-32 md:pb-20 overflow-hidden">
        {/* Decorative Background Glows */}
        <div className="absolute top-12 left-1/2 -translate-x-1/2 w-[350px] sm:w-[600px] h-[350px] sm:h-[600px] bg-indigo-500/10 dark:bg-indigo-500/5 rounded-full blur-3xl pointer-events-none -z-10" />
        <div className="absolute top-24 left-1/4 w-[200px] sm:w-[400px] h-[200px] sm:h-[400px] bg-purple-500/10 dark:bg-purple-500/5 rounded-full blur-3xl pointer-events-none -z-10" />

        <div className="relative max-w-5xl mx-auto px-4 z-10">
          <div className="text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-100/80 dark:border-indigo-900/30 px-3.5 py-1.5 rounded-full text-xs sm:text-sm text-indigo-700 dark:text-indigo-300 font-medium mb-4 sm:mb-6 shadow-sm backdrop-blur-sm animate-fade-in">
              <span className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></span>
              Didukung AI untuk Mahasiswa Indonesia
            </div>
 
            {/* Heading */}
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold text-gray-900 dark:text-white leading-tight mb-4 sm:mb-6 tracking-tight">
              Berhenti Lihat
              <span className="text-indigo-600 dark:text-indigo-400"> Total Saldo</span>
              <br />
              Fokus ke{' '}
              <span className="bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400 bg-clip-text text-transparent">
                Jatah Harian
              </span>
            </h1>
 
            {/* Description */}
            <p className="text-base sm:text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto mb-6 sm:mb-8 leading-relaxed px-2">
              SmartFlow mengubah cara mahasiswa kelola uang. Dari sekadar lihat saldo 
              jadi strategi harian yang cerdas. Biar AI yang hitung, kamu fokus ke tujuan kuliahmu.
            </p>
 
            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-3.5 justify-center mb-10 sm:mb-12">
              <Link href="/auth/register" className="inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-semibold transition-all shadow-lg shadow-indigo-600/20 active:scale-95 hover:shadow-indigo-650/30">
                <Rocket className="w-4 h-4" />
                <span>Mulai Gratis</span>
              </Link>
              <button 
                onClick={() => scrollToSection('fitur')}
                className="inline-flex items-center justify-center gap-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 px-6 py-3 rounded-xl font-semibold hover:bg-gray-50 dark:hover:bg-gray-800/80 transition-all active:scale-95 shadow-sm"
              >
                <Play className="w-4 h-4 fill-current text-gray-600 dark:text-gray-400" />
                <span>Lihat Fitur</span>
              </button>
            </div>
 
            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 max-w-2xl mx-auto">
              {[
                { value: '4.8', label: 'Rating Playstore', suffix: '/5' },
                { value: '10rb+', label: 'Mahasiswa Aktif' },
                { value: '85%', label: 'Lebih Hemat Uang' },
                { value: '24/7', label: 'Asisten AI Aktif' }
              ].map((stat, idx) => (
                <div key={idx} className="text-center p-3 sm:p-4 rounded-2xl bg-white/50 dark:bg-gray-900/30 border border-gray-150 dark:border-gray-800/50 backdrop-blur-sm shadow-sm hover:shadow-md transition-all">
                  <div className="text-lg sm:text-xl font-bold bg-gradient-to-br from-gray-900 to-gray-700 dark:from-white dark:to-slate-350 bg-clip-text text-transparent">
                    {stat.value}{stat.suffix || ''}
                  </div>
                  <div className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 mt-0.5 font-medium">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="fitur" className="py-12 sm:py-16 bg-gray-50 dark:bg-gray-900/20 border-y border-gray-100 dark:border-gray-800">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-8 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-2 sm:mb-3">
              Fitur Andalan
            </h2>
            <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto text-sm sm:text-base">
              Dirancang khusus untuk masalah keuangan mahasiswa
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {features.map((feature, idx) => (
              <div 
                key={idx}
                className="bg-white dark:bg-gray-900 p-5 sm:p-6 rounded-2xl border border-gray-150 dark:border-gray-800/80 hover:shadow-lg transition-all duration-300 hover:-translate-y-1 group"
              >
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 flex items-center justify-center mb-4 border border-indigo-100/50 dark:border-indigo-900/20 group-hover:scale-110 transition-transform duration-300">
                  {feature.icon}
                </div>
                <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white mb-1 sm:mb-2">
                  {feature.title}
                </h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-2 sm:mb-3 leading-relaxed">
                  {feature.description}
                </p>
                <span className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">
                  {feature.metric}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="cara-kerja" className="py-12 sm:py-16">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-8 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-2 sm:mb-3">
              Cara Kerja
            </h2>
            <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto text-sm sm:text-base">
              Tiga langkah menuju kebebasan finansial
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-6 sm:gap-8">
            {steps.map((step, idx) => (
              <div key={idx} className="text-center">
                <div className="text-3xl sm:text-4xl font-extrabold text-indigo-600 dark:text-indigo-400 mb-3 tracking-tight">
                  {step.number}
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-1 sm:mb-2">
                  {step.title}
                </h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-2 px-2">
                  {step.description}
                </p>
                <div className="inline-flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 bg-gray-55 dark:bg-gray-900/50 px-2 py-1 rounded-md">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{step.duration}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimoni" className="py-12 sm:py-16 bg-gray-50 dark:bg-gray-900/20 border-y border-gray-100 dark:border-gray-800">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-8 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-2 sm:mb-3">
              Kata Pengguna
            </h2>
            <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto text-sm sm:text-base">
              Ribuan mahasiswa sudah merasakan manfaatnya
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {testimonials.map((testimonial, idx) => (
              <div key={idx} className="bg-white dark:bg-gray-900 p-5 sm:p-6 rounded-2xl border border-gray-150 dark:border-gray-800/80 shadow-sm flex flex-col justify-between hover:shadow-md transition-all duration-300">
                <div>
                  <div className="flex gap-0.5 mb-3.5">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 text-amber-400 fill-amber-400" />
                    ))}
                  </div>
                  <p className="text-gray-700 dark:text-gray-300 text-sm italic mb-4 leading-relaxed">
                    &ldquo;{testimonial.quote}&rdquo;
                  </p>
                </div>
                <div className="border-t border-gray-100 dark:border-gray-800/50 pt-3 mt-1">
                  <p className="font-semibold text-gray-900 dark:text-white text-sm">{testimonial.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-500">{testimonial.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing - 3 Packages */}
      <section className="py-12 sm:py-16">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-8 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-2 sm:mb-3">
              Pilihan Sesuai Kebutuhan
            </h2>
            <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto text-sm sm:text-base">
              Pilih paket yang paling cocok untukmu
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-5 sm:gap-6">
            {packages.map((pkg, idx) => (
              <div 
                key={idx}
                className={`bg-white dark:bg-gray-900 rounded-2xl border ${
                  pkg.popular 
                    ? 'border-indigo-300 dark:border-indigo-500/50 shadow-lg relative' 
                    : 'border-gray-200 dark:border-gray-800'
                } p-5 sm:p-6 transition-all duration-300 hover:shadow-md flex flex-col justify-between`}
              >
                <div>
                  {pkg.popular && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-[10px] font-bold tracking-wider uppercase px-3 py-1 rounded-full shadow-sm">
                      Paling Populer
                    </div>
                  )}
                  
                  <div className="text-center mb-4">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">{pkg.name}</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{pkg.description}</p>
                    <div className="mt-3">
                      <span className="text-3xl font-extrabold text-indigo-600 dark:text-indigo-400">{pkg.price}</span>
                      <span className="text-sm text-gray-500 dark:text-gray-400"> / {pkg.period}</span>
                    </div>
                  </div>

                  <ul className="space-y-2.5 mb-6 text-left text-sm">
                    {pkg.features.map((feature, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                        <span className="text-gray-700 dark:text-gray-300">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <Link 
                  href="/auth/register" 
                  className={`block w-full text-center py-2.5 rounded-lg font-medium transition ${
                    pkg.buttonVariant === 'primary'
                      ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md'
                      : 'border border-indigo-600 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/20'
                  }`}
                >
                  {pkg.buttonText}
                </Link>
              </div>
            ))}
          </div>

          <p className="text-center text-xs text-gray-500 dark:text-gray-400 mt-6">
            🔒 Privasi terjamin • Semua paket bebas iklan
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-12 sm:py-16 bg-gray-50 dark:bg-gray-900/20 border-t border-gray-100 dark:border-gray-800">
        <div className="max-w-2xl mx-auto px-4">
          <div className="text-center mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
              Pertanyaan Umum
            </h2>
          </div>

          <div className="space-y-2 sm:space-y-3">
            {faqs.map((faq, idx) => (
              <div key={idx} className="bg-white dark:bg-gray-900 rounded-lg border border-gray-100 dark:border-gray-800">
                <button
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                  className="w-full flex items-center justify-between p-3 sm:p-4 text-left"
                >
                  <span className="font-medium text-gray-900 dark:text-white text-sm sm:text-base">{faq.q}</span>
                  <span className={`text-gray-500 transition-transform duration-300 ${openFaq === idx ? 'rotate-180' : ''}`}>
                    ▼
                  </span>
                </button>
                <div className={`px-3 sm:px-4 pb-3 sm:pb-4 ${openFaq === idx ? 'block' : 'hidden'}`}>
                  <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">{faq.a}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-indigo-650 dark:bg-indigo-950/20 py-12 sm:py-16 border-t border-indigo-500/20 relative overflow-hidden">
        {/* Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-white/5 dark:bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-3xl mx-auto px-4 text-center z-10">
          <h2 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-white mb-3 tracking-tight">
            Siap Ubah Kebiasaan Keuanganmu?
          </h2>
          <p className="text-indigo-100 dark:text-indigo-200 text-sm sm:text-base mb-6 max-w-md mx-auto">
            Bergabung dengan 10.000+ mahasiswa Indonesia yang sudah lebih hemat dan punya tabungan.
          </p>
          <Link href="/auth/register" className="inline-flex items-center gap-2 bg-white hover:bg-gray-50 text-indigo-600 px-6 py-3 rounded-xl font-bold transition shadow-lg active:scale-95 text-sm sm:text-base">
            <GraduationCap className="w-5 h-5 text-indigo-600" />
            Daftar Gratis — Verifikasi KTM
          </Link>
          <div className="text-indigo-200 dark:text-indigo-300 text-xs mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
            <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Setup 2 menit</span>
            <span className="hidden xs:inline text-indigo-400">•</span>
            <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5" /> Verifikasi KTM</span>
            <span className="hidden xs:inline text-indigo-400">•</span>
            <span className="flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5" /> Mulai trial 14 hari</span>
          </div>
        </div>
      </section>

      {/* Footer - Lengkap dengan Logo, Links, Social Media */}
      <footer className="bg-gray-950 text-white py-10 sm:py-12 border-t border-gray-900">
        <div className="max-w-6xl mx-auto px-4">
          {/* Main Footer Content */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
            {/* Brand Column */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">SF</span>
                </div>
                <span className="font-bold text-lg">SmartFlow</span>
              </div>
              <p className="text-gray-400 text-sm leading-relaxed">
                Student Financial Companion — membantu mahasiswa Indonesia mengelola keuangan secara cerdas.
              </p>
            </div>

            {/* Quick Links */}
            <div>
              <h4 className="font-semibold text-white text-sm mb-3">Tautan</h4>
              <ul className="space-y-2">
                <li>
                  <button onClick={() => scrollToSection('fitur')} className="text-gray-400 hover:text-white text-sm transition">
                    Fitur
                  </button>
                </li>
                <li>
                  <button onClick={() => scrollToSection('cara-kerja')} className="text-gray-400 hover:text-white text-sm transition">
                    Cara Kerja
                  </button>
                </li>
                <li>
                  <button onClick={() => scrollToSection('testimoni')} className="text-gray-400 hover:text-white text-sm transition">
                    Testimoni
                  </button>
                </li>
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h4 className="font-semibold text-white text-sm mb-3">Legal</h4>
              <ul className="space-y-2">
                <li>
                  <Link href="/privacy" className="text-gray-400 hover:text-white text-sm transition">
                    Kebijakan Privasi
                  </Link>
                </li>
                <li>
                  <Link href="/terms" className="text-gray-400 hover:text-white text-sm transition">
                    Syarat & Ketentuan
                  </Link>
                </li>
              </ul>
            </div>

            {/* Social Media */}
            <div>
              <h4 className="font-semibold text-white text-sm mb-3">Ikuti Kami</h4>
              <div className="flex gap-2.5">
                <a href="#" aria-label="Instagram" className="w-9 h-9 bg-gray-900 hover:bg-indigo-600 hover:text-white rounded-lg flex items-center justify-center transition text-gray-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                    <rect x={2} y={2} width={20} height={20} rx={5} ry={5} />
                    <path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z" />
                    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                  </svg>
                </a>
                <a href="#" aria-label="Twitter" className="w-9 h-9 bg-gray-900 hover:bg-indigo-650 hover:text-white rounded-lg flex items-center justify-center transition text-gray-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                    <path d="M23 3a10.9 10.9 0 01-3.14 1.53 4.48 4.48 0 00-7.86 3v1A10.66 10.66 0 013 4s-4 9 5 13a11.64 11.64 0 01-7 2c9 5 20 0 20-11.5a4.5 4.5 0 00-.08-.83A7.72 7.72 0 0023 3z" />
                  </svg>
                </a>
                <a href="#" aria-label="Facebook" className="w-9 h-9 bg-gray-900 hover:bg-indigo-650 hover:text-white rounded-lg flex items-center justify-center transition text-gray-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                    <path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z" />
                  </svg>
                </a>
                <a href="#" aria-label="Message" className="w-9 h-9 bg-gray-900 hover:bg-indigo-650 hover:text-white rounded-lg flex items-center justify-center transition text-gray-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                  </svg>
                </a>
              </div>
              <p className="text-gray-500 text-xs mt-3">
                hello@smartflow.id
              </p>
            </div>
          </div>

          {/* Copyright */}
          <div className="border-t border-gray-900 pt-6 text-center">
            <p className="text-gray-500 text-xs">
              © 2024 SmartFlow — Student Financial Companion. Untuk mahasiswa Indonesia.
            </p>
          </div>
        </div>
      </footer>

      {/* Back to Top */}
      {showBackToTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-5 right-4 sm:bottom-6 sm:right-6 w-9 h-9 sm:w-10 sm:h-10 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg transition-all hover:scale-105 z-40 flex items-center justify-center"
          aria-label="Back to top"
        >
          <ArrowUp className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}