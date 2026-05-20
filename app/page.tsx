'use client';

import Link from 'next/link';
import { useEffect, useState, useCallback } from 'react';

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [activeNav, setActiveNav] = useState('beranda');

  useEffect(() => {
    setMounted(true);
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

  const scrollToSection = useCallback((sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setMobileMenuOpen(false);
    }
  }, []);

  const features = [
    {
      icon: '📊',
      title: 'Jatah Harian Otomatis',
      description: 'Sistem membagi penghasilan dengan sisa hari dalam bulan. Fokus ke batas harian, bukan total saldo.',
      metric: 'Update real-time'
    },
    {
      icon: '🤖',
      title: 'AI Pintar',
      description: 'Cukup ketik "makan siang 25rb", AI otomatis mengisi kategori. Cepat dan praktis.',
      metric: 'Natural Language'
    },
    {
      icon: '👛',
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
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-100">
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
              <span className="font-bold text-lg sm:text-xl text-gray-900">SmartFlow</span>
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
                      ? 'text-indigo-600 font-semibold' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {/* Right Actions */}
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-2">
                <Link href="/auth/login" className="text-sm text-gray-600 hover:text-gray-900 px-3 py-1.5 transition">
                  Masuk
                </Link>
                <Link href="/auth/register" className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition">
                  Daftar
                </Link>
              </div>

              {/* Mobile Menu Button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition"
              >
                <span className="text-xl">{mobileMenuOpen ? '✕' : '☰'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        <div className={`md:hidden bg-white border-t border-gray-100 transition-all duration-300 ${
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
                className="px-4 py-3 text-left text-gray-700 hover:bg-gray-50 transition"
              >
                {item.label}
              </button>
            ))}
            <div className="border-t border-gray-100 mt-2 pt-3 px-4 space-y-2">
              <Link href="/auth/login" className="block w-full text-center border border-indigo-600 text-indigo-600 px-4 py-2 rounded-lg font-medium">
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
      <section id="beranda" className="pt-20 pb-12 sm:pt-28 sm:pb-16 md:pt-32 md:pb-20">
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-1.5 bg-indigo-50 border border-indigo-100 px-3 py-1 rounded-full text-xs sm:text-sm text-indigo-700 mb-4 sm:mb-6">
              <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></span>
              Didukung AI untuk Mahasiswa
            </div>

            {/* Heading */}
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight mb-4 sm:mb-6">
              Berhenti Lihat
              <span className="text-indigo-600"> Total Saldo</span>
              <br />
              Fokus ke{' '}
              <span className="bg-gradient-to-r from-indigo-600 to-indigo-500 bg-clip-text text-transparent">
                Jatah Harian
              </span>
            </h1>

            {/* Description */}
            <p className="text-base sm:text-lg text-gray-600 max-w-2xl mx-auto mb-6 sm:mb-8 leading-relaxed px-2">
              SmartFlow mengubah cara mahasiswa kelola uang. Dari sekadar lihat saldo 
              jadi strategi harian yang cerdas. Biar AI yang hitung, kamu fokus ke tujuan.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center mb-10 sm:mb-12">
              <Link href="/auth/register" className="inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 sm:px-6 py-2.5 sm:py-3 rounded-lg font-medium transition">
                <span>🚀</span>
                Mulai Gratis
              </Link>
              <button 
                onClick={() => scrollToSection('fitur')}
                className="inline-flex items-center justify-center gap-2 bg-white border border-gray-300 text-gray-700 px-5 sm:px-6 py-2.5 sm:py-3 rounded-lg font-medium hover:bg-gray-50 transition"
              >
                <span>▶</span>
                Lihat Fitur
              </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl mx-auto">
              {[
                { value: '4.8', label: 'Rating', suffix: '/5' },
                { value: '10rb+', label: 'Mahasiswa' },
                { value: '85%', label: 'Lebih Hemat' },
                { value: '24/7', label: 'AI Support' }
              ].map((stat, idx) => (
                <div key={idx} className="text-center p-2.5 sm:p-3 rounded-xl bg-gray-50">
                  <div className="text-lg sm:text-xl font-bold text-gray-900">
                    {stat.value}{stat.suffix || ''}
                  </div>
                  <div className="text-xs text-gray-500">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="fitur" className="py-12 sm:py-16 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-8 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-2 sm:mb-3">
              Fitur Andalan
            </h2>
            <p className="text-gray-600 max-w-md mx-auto text-sm sm:text-base">
              Dirancang khusus untuk masalah keuangan mahasiswa
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {features.map((feature, idx) => (
              <div 
                key={idx}
                className="bg-white p-5 sm:p-6 rounded-xl border border-gray-100 hover:shadow-md transition hover:-translate-y-0.5"
              >
                <div className="text-2xl sm:text-3xl mb-3 sm:mb-4">{feature.icon}</div>
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-1 sm:mb-2">
                  {feature.title}
                </h3>
                <p className="text-gray-600 text-sm mb-2 sm:mb-3 leading-relaxed">
                  {feature.description}
                </p>
                <span className="text-xs text-indigo-600 font-medium">
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
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-2 sm:mb-3">
              Cara Kerja
            </h2>
            <p className="text-gray-600 max-w-md mx-auto text-sm sm:text-base">
              Tiga langkah menuju kebebasan finansial
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-6 sm:gap-8">
            {steps.map((step, idx) => (
              <div key={idx} className="text-center">
                <div className="text-3xl sm:text-4xl font-bold text-indigo-600 mb-3">
                  {step.number}
                </div>
                <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-1 sm:mb-2">
                  {step.title}
                </h3>
                <p className="text-gray-600 text-sm mb-2 px-2">
                  {step.description}
                </p>
                <div className="inline-flex items-center gap-1 text-xs text-gray-400">
                  <span>⏱</span>
                  <span>{step.duration}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimoni" className="py-12 sm:py-16 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-8 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-2 sm:mb-3">
              Kata Pengguna
            </h2>
            <p className="text-gray-600 max-w-md mx-auto text-sm sm:text-base">
              Ribuan mahasiswa sudah merasakan manfaatnya
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {testimonials.map((testimonial, idx) => (
              <div key={idx} className="bg-white p-5 sm:p-6 rounded-xl border border-gray-100">
                <div className="flex gap-0.5 mb-3">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <span key={i} className="text-yellow-400 text-sm">★</span>
                  ))}
                </div>
                <p className="text-gray-700 text-sm italic mb-3 leading-relaxed">
                  "{testimonial.quote}"
                </p>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{testimonial.name}</p>
                  <p className="text-xs text-gray-500">{testimonial.role}</p>
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
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-2 sm:mb-3">
              Pilihan Sesuai Kebutuhan
            </h2>
            <p className="text-gray-600 max-w-md mx-auto text-sm sm:text-base">
              Pilih paket yang paling cocok untukmu
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-5 sm:gap-6">
            {packages.map((pkg, idx) => (
              <div 
                key={idx}
                className={`bg-white rounded-xl border ${
                  pkg.popular 
                    ? 'border-indigo-300 shadow-lg relative' 
                    : 'border-gray-200'
                } p-5 sm:p-6 transition hover:shadow-md`}
              >
                {pkg.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-xs font-medium px-3 py-1 rounded-full">
                    Paling Populer
                  </div>
                )}
                
                <div className="text-center mb-4">
                  <h3 className="text-xl font-bold text-gray-900 mb-1">{pkg.name}</h3>
                  <p className="text-xs text-gray-500">{pkg.description}</p>
                  <div className="mt-3">
                    <span className="text-3xl font-bold text-indigo-600">{pkg.price}</span>
                    <span className="text-sm text-gray-500"> / {pkg.period}</span>
                  </div>
                </div>

                <ul className="space-y-2 mb-5 text-left text-sm">
                  {pkg.features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <span className="text-emerald-500 text-sm">✓</span>
                      <span className="text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Link 
                  href="/auth/register" 
                  className={`block w-full text-center py-2.5 rounded-lg font-medium transition ${
                    pkg.buttonVariant === 'primary'
                      ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                      : 'border border-indigo-600 text-indigo-600 hover:bg-indigo-50'
                  }`}
                >
                  {pkg.buttonText}
                </Link>
              </div>
            ))}
          </div>

          <p className="text-center text-xs text-gray-500 mt-6">
            🔒 Privasi terjamin • Semua paket bebas iklan
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-12 sm:py-16 bg-gray-50">
        <div className="max-w-2xl mx-auto px-4">
          <div className="text-center mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
              Pertanyaan Umum
            </h2>
          </div>

          <div className="space-y-2 sm:space-y-3">
            {faqs.map((faq, idx) => (
              <div key={idx} className="bg-white rounded-lg border border-gray-100">
                <button
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                  className="w-full flex items-center justify-between p-3 sm:p-4 text-left"
                >
                  <span className="font-medium text-gray-900 text-sm sm:text-base">{faq.q}</span>
                  <span className={`text-gray-500 transition-transform duration-300 ${openFaq === idx ? 'rotate-180' : ''}`}>
                    ▼
                  </span>
                </button>
                <div className={`px-3 sm:px-4 pb-3 sm:pb-4 ${openFaq === idx ? 'block' : 'hidden'}`}>
                  <p className="text-gray-600 text-sm leading-relaxed">{faq.a}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-indigo-600 py-12 sm:py-16">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-3">
            Siap Ubah Kebiasaan Keuangan?
          </h2>
          <p className="text-indigo-100 text-sm sm:text-base mb-5">
            Bergabung dengan 10.000+ mahasiswa yang sudah lebih hemat
          </p>
          <Link href="/auth/register" className="inline-flex items-center gap-2 bg-white text-indigo-600 hover:bg-gray-100 px-5 sm:px-6 py-2.5 sm:py-3 rounded-lg font-medium transition shadow-lg">
            <span>🎓</span>
            Daftar Gratis — Tanpa Kartu Kredit
          </Link>
          <p className="text-indigo-200 text-xs mt-3 flex flex-wrap items-center justify-center gap-2">
            <span>⏱ Setup 2 menit</span>
            <span className="hidden xs:inline">•</span>
            <span>✓ Verifikasi mahasiswa</span>
            <span className="hidden xs:inline">•</span>
            <span>💯 Mulai dari trial 14 hari</span>
          </p>
        </div>
      </section>

      {/* Footer - Lengkap dengan Logo, Links, Social Media */}
      <footer className="bg-gray-900 text-white py-10 sm:py-12">
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
                Student Financial Companion — bantu mahasiswa Indonesia kelola keuangan dengan cerdas.
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
              <div className="flex gap-3">
                <a href="#" className="w-9 h-9 bg-gray-800 hover:bg-indigo-600 rounded-lg flex items-center justify-center transition">
                  <span className="text-sm">📷</span>
                </a>
                <a href="#" className="w-9 h-9 bg-gray-800 hover:bg-indigo-600 rounded-lg flex items-center justify-center transition">
                  <span className="text-sm">🐦</span>
                </a>
                <a href="#" className="w-9 h-9 bg-gray-800 hover:bg-indigo-600 rounded-lg flex items-center justify-center transition">
                  <span className="text-sm">📘</span>
                </a>
                <a href="#" className="w-9 h-9 bg-gray-800 hover:bg-indigo-600 rounded-lg flex items-center justify-center transition">
                  <span className="text-sm">💬</span>
                </a>
              </div>
              <p className="text-gray-500 text-xs mt-3">
                hello@smartflow.id
              </p>
            </div>
          </div>

          {/* Copyright */}
          <div className="border-t border-gray-800 pt-6 text-center">
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
          className="fixed bottom-5 right-4 sm:bottom-6 sm:right-6 w-9 h-9 sm:w-10 sm:h-10 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-lg transition-all hover:scale-105 z-40 flex items-center justify-center text-sm"
        >
          ↑
        </button>
      )}
    </div>
  );
}