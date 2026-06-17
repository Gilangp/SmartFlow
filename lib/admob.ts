import { AdMob, BannerAdSize, BannerAdPosition, BannerAdPluginEvents } from '@capacitor-community/admob';
import { Capacitor } from '@capacitor/core';

// Test Ad Unit IDs (Google Official Test IDs)
const TEST_BANNER_ID = 'ca-app-pub-3940256099942544/6300978111';
const TEST_INTERSTITIAL_ID = 'ca-app-pub-3940256099942544/1033173712';

export async function initAdMob() {
  if (typeof window === 'undefined' || !Capacitor.isNativePlatform()) {
    return;
  }
  try {
    await AdMob.initialize({
      initializeForTesting: true,
    });
    console.log('AdMob Initialized Successfully with test mode');

    // Menambahkan listener untuk menyesuaikan padding bawah WebView secara dinamis
    // agar isi halaman tidak tertutup oleh iklan banner di bagian bawah.
    AdMob.addListener(BannerAdPluginEvents.SizeChanged, (info: any) => {
      const bannerHeight = info.height;
      if (typeof document !== 'undefined') {
        const safeHeight = bannerHeight > 0 ? bannerHeight : 0;
        document.documentElement.style.setProperty('--banner-height', `${safeHeight}px`);
        console.log(`Set CSS variable --banner-height to: ${safeHeight}px`);
      }
    });

  } catch (error) {
    console.error('Error initializing AdMob:', error);
  }
}

export async function showBanner() {
  if (typeof window === 'undefined' || !Capacitor.isNativePlatform()) {
    return;
  }
  try {
    await AdMob.showBanner({
      adId: TEST_BANNER_ID,
      adSize: BannerAdSize.BANNER,
      position: BannerAdPosition.BOTTOM_CENTER,
      margin: 0,
      isTesting: true,
    });
    console.log('Banner Ad shown successfully');
  } catch (error) {
    console.error('Error showing Banner Ad:', error);
  }
}

export async function hideBanner() {
  if (typeof window === 'undefined' || !Capacitor.isNativePlatform()) {
    return;
  }
  try {
    await AdMob.hideBanner();
    if (typeof document !== 'undefined') {
      document.documentElement.style.setProperty('--banner-height', '0px');
    }
  } catch (error) {
    console.error('Error hiding Banner Ad:', error);
  }
}

export async function showInterstitial() {
  if (typeof window === 'undefined' || !Capacitor.isNativePlatform()) {
    return;
  }
  try {
    await AdMob.prepareInterstitial({
      adId: TEST_INTERSTITIAL_ID,
      isTesting: true,
    });
    await AdMob.showInterstitial();
    console.log('Interstitial Ad shown successfully');
  } catch (error) {
    console.error('Error showing Interstitial Ad:', error);
  }
}
