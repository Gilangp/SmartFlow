/**
 * SmartFlow Icon Generator
 * ========================
 * Jalankan: node scripts/generate-icons.js
 *
 * Syarat: Taruh icon sumber di public/icon-source.png (min 512x512 px)
 */

const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const SOURCE = path.join(__dirname, '../public/icon-source.png');
const OUT_DIR = path.join(__dirname, '../public');

// Android res folder
const ANDROID_RES = path.join(__dirname, '../android/app/src/main/res');

// ── Daftar icon yang akan di-generate ───────────────────────────────────────
const PWA_ICONS = [
  { name: 'icon-192x192.png',          size: 192, maskable: false },
  { name: 'icon-512x512.png',          size: 512, maskable: false },
  { name: 'icon-maskable-192x192.png', size: 192, maskable: true  },
  { name: 'icon-maskable-512x512.png', size: 512, maskable: true  },
  { name: 'icon-add.png',              size: 192, maskable: false },
  { name: 'icon-dashboard.png',        size: 192, maskable: false },
  { name: 'apple-touch-icon.png',      size: 180, maskable: false },
  { name: 'favicon.ico',               size: 32,  maskable: false }, // PNG renamed, didukung browser modern
];

const ANDROID_ICONS = [
  { folder: 'mipmap-mdpi',    size: 48  },
  { folder: 'mipmap-hdpi',    size: 72  },
  { folder: 'mipmap-xhdpi',   size: 96  },
  { folder: 'mipmap-xxhdpi',  size: 144 },
  { folder: 'mipmap-xxxhdpi', size: 192 },
];

// ── Warna background app (untuk maskable) ───────────────────────────────────
// Ubah ini sesuai brand color kamu
const BRAND_COLOR = { r: 79, g: 70, b: 229, alpha: 1 }; // #4f46e5 (Indigo)

// ── Helper: buat maskable (logo + padding 20% + background brand color) ─────
async function generateMaskable(inputPath, outputPath, size) {
  const padding = Math.floor(size * 0.2); // 20% safe zone
  const innerSize = size - padding * 2;

  const resizedLogo = await sharp(inputPath)
    .resize(innerSize, innerSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: BRAND_COLOR,
    },
  })
    .composite([{ input: resizedLogo, gravity: 'center' }])
    .png()
    .toFile(outputPath);
}

// ── Helper: generate icon biasa ──────────────────────────────────────────────
async function generateIcon(inputPath, outputPath, size) {
  await sharp(inputPath)
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(outputPath);
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  if (!fs.existsSync(SOURCE)) {
    console.error('❌ File sumber tidak ditemukan:', SOURCE);
    console.error('   Taruh icon kamu di: public/icon-source.png (min 512x512 px)');
    process.exit(1);
  }

  console.log('🎨 SmartFlow Icon Generator');
  console.log('============================');
  console.log('📂 Sumber:', SOURCE);
  console.log('');

  // 1. Generate PWA icons
  console.log('📱 Generating PWA icons...');
  for (const icon of PWA_ICONS) {
    if (icon.ico) {
      // favicon: generate PNG dulu, rename ke .ico (simple approach)
      const tmpPng = path.join(OUT_DIR, '_favicon_tmp.png');
      await generateIcon(SOURCE, tmpPng, icon.size);
      fs.renameSync(tmpPng, path.join(OUT_DIR, icon.name));
    } else if (icon.maskable) {
      await generateMaskable(SOURCE, path.join(OUT_DIR, icon.name), icon.size);
    } else {
      await generateIcon(SOURCE, path.join(OUT_DIR, icon.name), icon.size);
    }
    console.log(`   ✅ ${icon.name} (${icon.size}x${icon.size})`);
  }

  // 2. Generate Android icons
  console.log('');
  console.log('🤖 Generating Android launcher icons...');
  for (const icon of ANDROID_ICONS) {
    const folderPath = path.join(ANDROID_RES, icon.folder);
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }
    const outputPath = path.join(folderPath, 'ic_launcher.png');
    await generateIcon(SOURCE, outputPath, icon.size);
    console.log(`   ✅ ${icon.folder}/ic_launcher.png (${icon.size}x${icon.size})`);
  }

  console.log('');
  console.log('✨ Semua icon berhasil di-generate!');
  console.log('');
  console.log('📁 PWA icons → /public/');
  console.log('📁 Android icons → /android/app/src/main/res/mipmap-*/');
}

main().catch((err) => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
