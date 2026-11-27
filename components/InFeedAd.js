'use client';
// Encarts publicitaires web (Adsterra) intégrés aux listes — Secrets
// mystiques, Bibliothèque, Marché — toutes les IN_FEED_EVERY cartes
// (lib/inFeedAds.js), et bandeau sous l'en-tête de la discussion Zikr.
//
// Adsterra est réservé au site (iPhone/iPad et ordinateur) : l'application
// Android n'affiche QUE des bannières AdMob (en bas des écrans). Aucun encart
// sur Android, ni dans l'application ni dans un navigateur Android.
// Seulement pour un visiteur non abonné (adFree === false).
// NEXT_PUBLIC_ADSTERRA_BANNERS=0 coupe tout. Chaque encart est un iframe
// sandboxé (pas d'accès à la page) chargé à l'approche de l'écran.
import { useEffect, useRef, useState } from 'react';
import { useAccess } from './AccessProvider';
import { isIOSAdsterra } from '@/lib/actionAd';
import { AD_HOST, BANNERS, BANNERS_CONFIGURED } from './AdsterraBanner';

function platform() {
  try {
    if (isIOSAdsterra()) return 'ios';
    if (window.Capacitor?.isNativePlatform?.() || /android/i.test(navigator.userAgent || '')) return 'android';
  } catch { /* navigateur sans Capacitor */ }
  return 'desktop';
}

export function useInFeedAds() {
  const { adFree } = useAccess();
  const [where, setWhere] = useState(null);
  useEffect(() => { setWhere(platform()); }, []);
  return BANNERS_CONFIGURED && adFree === false && (where === 'ios' || where === 'desktop');
}

export default function InFeedAd({ format = 'b300x250', className = 'in-feed-ad' }) {
  const box = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = box.current;
    if (!el) return undefined;
    if (typeof IntersectionObserver === 'undefined') { setVisible(true); return undefined; }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) { setVisible(true); observer.disconnect(); }
    }, { rootMargin: '300px 0px' });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const { key, width, height } = BANNERS[format];
  return (
    <aside ref={box} className={className} aria-label="Publicité" data-format={format}>
      <span className="in-feed-ad-label">Publicité</span>
      <div className="in-feed-ad-slot" style={{ width, maxWidth: '100%', height }}>
        {visible && (
          <iframe
            title="Publicité"
            sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
            width={width}
            height={height}
            loading="lazy"
            srcDoc={`<style>html,body{margin:0;overflow:hidden}</style><script>window.atOptions = {key:"${key}",format:"iframe",width:${width},height:${height},params:{}};</script><script src="${AD_HOST}/22/${key}"></script>`}
          />
        )}
      </div>
    </aside>
  );
}
