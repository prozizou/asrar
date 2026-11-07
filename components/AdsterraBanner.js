'use client';
// Bannières Adsterra (atOptions + script /22/<clé>) — sans dépendance au
// contexte d'accès, pour servir aussi bien au bas des pages
// (components/AdsterraAds.js) qu'à la fenêtre de compte à rebours des actions
// (components/AccessProvider.js), sans import circulaire.
import { useEffect, useRef } from 'react';
import { ADS_PAUSED } from '@/lib/plans';

export const AD_HOST = 'https://bicea.org';

// Bannières ACTIVES (bas des pages, colonnes latérales, fenêtre de compte à
// rebours). Coupées un temps (v46.41) à cause d'annonces de casino, puis
// réactivées à la demande du propriétaire (seules les pubs adultes restent
// bloquées chez Adsterra). Pour les couper sans toucher au code :
// NEXT_PUBLIC_ADSTERRA_BANNERS=0 (variable Vercel, au prochain déploiement).
export const BANNERS_ENABLED = !ADS_PAUSED && process.env.NEXT_PUBLIC_ADSTERRA_BANNERS !== '0';

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
function loadBanner(el, banner, onError) {
  let cancelled = false;
  let finish = () => {};
  bannerQueue = bannerQueue.then(() => new Promise((done) => {
    if (cancelled || !el.isConnected) return done();
    const opts = document.createElement('script');
    opts.text = `atOptions = {'key':'${banner.key}','format':'iframe','height':${banner.height},'width':${banner.width},'params':{}};`;
    const invoke = document.createElement('script');
    invoke.src = `${AD_HOST}/22/${banner.key}`;
    const timer = setTimeout(() => { if (!cancelled) onError?.(); finish(); }, 12000);
    finish = () => { clearTimeout(timer); done(); };
    invoke.onload = finish;
    invoke.onerror = () => { if (!cancelled) onError?.(); finish(); };
    el.append(opts, invoke);
  }));
  return () => { cancelled = true; finish(); el.replaceChildren(); };
}

export function Banner({ banner, style, onStateChange }) {
  const box = useRef(null);
  useEffect(() => {
    if (ADS_PAUSED) return undefined;
    const el = box.current;
    if (!el) return undefined;
    let ready = false;
    onStateChange?.('loading');
    const error = () => { ready = false; onStateChange?.('error'); };
    let timer = onStateChange ? setTimeout(error, 15000) : null;
    const loaded = (event) => {
      const frame = event.target;
      if (frame?.tagName !== 'IFRAME' || !el.contains(frame) || !/^https?:\/\//.test(frame.src)) return;
      const rect = frame.getBoundingClientRect();
      if (rect.width < banner.width / 2 || rect.height < banner.height / 2) return;
      ready = true; clearTimeout(timer); onStateChange?.('ready');
    };
    const observer = onStateChange ? new MutationObserver((records) => {
      if (ready && !el.querySelector('iframe')) error();
      else if (ready && records.some((record) => record.type === 'attributes' && record.attributeName === 'src')) {
        ready = false; onStateChange('loading'); clearTimeout(timer); timer = setTimeout(error, 15000);
      }
    }) : null;
    if (onStateChange) el.addEventListener('load', loaded, true);
    observer?.observe(el, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });
    const cleanup = loadBanner(el, banner, error);
    return () => { clearTimeout(timer); observer?.disconnect(); el.removeEventListener('load', loaded, true); cleanup(); };
  }, [banner, onStateChange]);
  if (ADS_PAUSED) return null;
  return (
    <div
      ref={box}
      aria-label="Publicité"
      style={{ display: 'flex', justifyContent: 'center', width: banner.width, height: banner.height, maxWidth: '100%', overflow: 'hidden', ...style }}
    />
  );
}

