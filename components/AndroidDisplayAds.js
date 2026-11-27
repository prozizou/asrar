'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { configureDisplayAds } from '@/lib/unityAds';
import { displaySurface } from '@/lib/inFeedAds';
import { useAccess } from './AccessProvider';
import { useAuth } from './AuthProvider';

export default function AndroidDisplayAds() {
  const path = usePathname();
  const { user, loading } = useAuth();
  const { adFree } = useAccess();
  const revision = useRef(0);

  useEffect(() => {
    const configure = (enabled, surface) => {
      const current = ++revision.current;
      void configureDisplayAds(enabled, surface, () => revision.current === current);
    };
    const enabled = !!user && !loading && adFree === false;
    const surface = displaySurface(path);
    configure(enabled, surface);
    return () => configure(false, '');
  }, [user, loading, adFree, path]);

  return null;
}
