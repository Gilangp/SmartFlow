# SmartFlow - Student Financial Companion

Aplikasi manajemen keuangan berbasis web yang dirancang khusus untuk mahasiswa. Fokus pada pengelolaan pengeluaran harian daripada total saldo.

## Fitur Utama

- **Jatah Harian Pintar**: Kalkulasi otomatis berapa yang boleh dibelanjakan per hari
- **4 Kantong Finansial**: Dompet Utama, Dana Darurat, Tabungan Aset, & Wishlist
- **Input Cerdas**: Input transaksi dengan Natural Language Processing
- **AI Roaster**: Analisis perilaku finansial dengan feedback humoristik
- **Dashboard Real-time**: Visualisasi status pengeluaran dengan indikator warna
- **PWA Ready**: Bisa diinstal sebagai aplikasi di smartphone

## Tech Stack

- **Frontend**: Next.js 14, React 18, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: MySQL (via Prisma ORM)
- **Authentication**: JWT
- **Security**: Bcrypt untuk password hashing

## Prerequisites

- Node.js 18+
- MySQL 5.7+
- npm atau yarn

## Setup Lokal

### 1. Clone Repository & Install Dependencies

```bash
cd c:\laragon\www\smartflowV2
npm install
```

### 2. Setup Database

```bash
# Copy environment file
cp .env.example .env.local
```

Edit `.env.local` dan masukkan PostgreSQL connection string:
```
DATABASE_URL="postgresql://user:password@localhost:5432/smartflow_db"
NEXTAUTH_SECRET="generate-random-secret-here"
```

### 3. Jalankan Migrasi Database

```bash
npx prisma migrate dev --name init
```

### 4. Jalankan Development Server

```bash
npm run dev
```

Aplikasi akan berjalan di `http://localhost:3000`

## API Documentation

### Authentication

- `POST /api/auth/register` - Registrasi pengguna baru
- `POST /api/auth/login` - Login pengguna
- `GET /api/auth/me` - Get current user (memerlukan token)
- `PUT /api/auth/profile` - Update profil pengguna

### Dashboard

- `GET /api/dashboard` - Get dashboard data dengan perhitungan jatah harian

### Pockets

- `GET /api/pockets` - Dapatkan semua kantong pengguna
- `PUT /api/pockets` - Update target dan nama kantong

### Transactions

- `POST /api/transactions` - Buat transaksi baru
- `GET /api/transactions` - Dapatkan daftar transaksi (dengan pagination)

### Categories

- `POST /api/categories` - Buat kategori baru
- `GET /api/categories` - Dapatkan semua kategori
- `PUT /api/categories/[id]` - Update kategori
- `DELETE /api/categories/[id]` - Hapus kategori

## Struktur Folder

```
smartflowV2/
├── app/
│   ├── api/              # API routes
│   ├── auth/             # Auth pages (login, register)
│   ├── dashboard/        # Dashboard pages
│   ├── layout.tsx        # Root layout
│   ├── page.tsx          # Home page
│   └── globals.css       # Global styles
├── components/
│   └── providers/        # React providers
├── lib/
│   ├── auth.ts           # Auth utilities
│   ├── db.ts             # Prisma client
│   └── financial-calculations.ts  # Business logic
├── prisma/
│   └── schema.prisma     # Database schema
├── types/
│   └── index.ts          # TypeScript types
├── public/               # Static files
├── .env.example          # Environment template
└── package.json          # Dependencies
```

## Fitur yang Akan Datang

- [ ] Smart Input dengan AI/NLP
- [ ] AI Roaster Widget
- [ ] Daily Rollover Logic
- [ ] Income Distribution Simulator
- [ ] Advanced Analytics & Reports
- [ ] Mobile App (React Native)
- [ ] Push Notifications
- [ ] Offline Mode

## Database Schema

Lihat `prisma/schema.prisma` untuk detail lengkap skema database.

### Tabel Utama:
- `users` - Data pengguna
- `pockets` - 4 kantong finansial
- `categories` - Kategori transaksi
- `transactions` - Riwayat transaksi
- `income_records` - Log distribusi pemasukan
- `daily_performance` - Metrik harian untuk AI

## Keamanan

- Password di-hash menggunakan Bcrypt (10 rounds)
- API routes dilindungi dengan JWT token
- CORS dan CSRF protection
- Input validation di setiap endpoint

## Kontribusi

Silakan buat issue atau pull request untuk berkontribusi!

## License

MIT License - lihat file LICENSE untuk detail.

---

**Dibuat dengan ❤️ untuk mahasiswa Indonesia**
