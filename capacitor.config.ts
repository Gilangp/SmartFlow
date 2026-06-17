import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.gilangp.smartflow',
  appName: 'SmartFlow',
  webDir: 'out',
  server: {
    // Jalankan Next.js dengan "npm run dev" lalu gunakan IP komputer Anda di sini untuk pengetesan di HP fisik.
    // Contoh: 'http://192.168.1.5:3000' atau 'http://10.0.2.2:3000' untuk Emulator Android.
    // Saat produksi, ganti ke domain production Anda (misal: 'https://smartflow.my.id')
    url: 'http://localhost:3000', 
    cleartext: true
  },
  plugins: {
    AdMob: {
      initializeOnJSInit: true,
      // PENTING: Ini adalah Test App ID resmi dari Google.
      // Ganti dengan App ID asli Anda ketika merilis ke Play Store/App Store.
      androidAppId: 'ca-app-pub-3940256099942544~3347511713',
      iosAppId: 'ca-app-pub-3940256099942544~1458002511'
    },
    Keyboard: {
      // 'none' = WebView TIDAK mengecil saat keyboard muncul.
      // Keyboard akan melayang di atas WebView secara alami.
      // Ini memastikan posisi iklan banner di bawah tidak bergerak ke atas.
      resize: 'none',
      resizeOnFullScreen: true,
    }
  }
};

export default config;
