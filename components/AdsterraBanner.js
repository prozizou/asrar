'use client';
// Bannières Adsterra (atOptions + script /22/<clé>) — sans dépendance au
// contexte d'accès, pour servir aussi bien au bas des pages
// (components/AdsterraAds.js) qu'à la fenêtre de compte à rebours des actions
// (components/AccessProvider.js), sans import circulaire.
import { useEffect, useRef } from 'react';

export const AD_HOST = 'https://bicea.org';

export const BANNERS = {
  b320x50: { key: '563c98782ed872bff3a559ced174eb4e', width: 320, height: 50 },
  b468x60: { key: '4e6dae61157b6b11ee648226d05336c6', width: 468, height: 60 },
  b728x90: { key: '58908a49d51073409be1bb6dac283f9b', width: 728, height: 90 },
  b300x250: { key: 'd691104dc0fe411adbaedd982a916508', width: 300, height: 250 },
  b160x300: { key: '4d2141d8a51d186c4ed329a1a9013dde', width: 160, height: 300 },
  b160x600: { key: '59ac401eb38177b992c5300da8969816', width: 160, height: 600 },
};

// Le script d'un Banner lit la variable GLOBALE atOptions à son exécution :
// plusieurs bannières chargées en parallèle se la disputeraient. On les
// charge donc l'une APRÈS l'autre (file d'attente partagée).
let bannerQueue = Promise.resolve();
function loadBanner(el, banner) {
  let cancelled = false;
  bannerQueue = bannerQueue.then(() => new Promise((done) => {
    if (cancelled || !el.isConnected) return done();
    const opts = document.createElement('script');
    opts.text = `atOptions = {'key':'${banner.key}','format':'iframe','height':${banner.height},'width':${banner.width},'params':{}};`;
    const invoke = document.createElement('script');
    invoke.src = `${AD_HOST}/22/${banner.key}`;
    invoke.onload = invoke.onerror = () => done();
    el.append(opts, invoke);
  }));
  return () => { cancelled = true; el.replaceChildren(); };
}

export function Banner({ banner, style }) {
  const box = useRef(null);
  useEffect(() => (box.current ? loadBanner(box.current, banner) : undefined), [banner]);
  return (
    <div
      ref={box}
      aria-label="Publicité"
      style={{ display: 'flex', justifyContent: 'center', width: banner.width, height: banner.height, maxWidth: '100%', overflow: 'hidden', ...style }}
    />
  );
}

