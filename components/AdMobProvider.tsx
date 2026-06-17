'use client';

import { useEffect } from 'react';
import { initAdMob, showBanner } from '@/lib/admob';

export default function AdMobProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const startAds = async () => {
      try {
        await initAdMob();
        await showBanner();
      } catch (error) {
        console.error('Failed to initialize or show AdMob banner:', error);
      }
    };
    startAds();
  }, []);

  return <>{children}</>;
}
