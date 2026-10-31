'use client';
// Publicités Adsterra — SITE WEB UNIQUEMENT. Montées dans Providers, donc sur
// toutes les pages. Jamais dans l'APK/Capacitor (Google Play : l'APK utilise
// Unity Ads, cf. lib/unityAds.js) et jamais pour un abonné (allowed === true).
// allowed === null (accès pas encore résolu) : rien d'affiché, pour ne pas
// montrer une pub une fraction de seconde à un abonné.
//
// Codes des unités du site asrarpro.com (tableau de bord Adsterra → Sites →
// Ad Units), pubs adultes désactivées. Chaque valeur peut être remplacée par
// une variable d'environnement Vercel (NEXT_PUBLIC_*, lue au build) ; une
// variable définie à une chaîne VIDE désactive le format correspondant.
//  - NEXT_PUBLIC_ADSTERRA_SOCIALBAR_SRC  : URL du script Social Bar.
//  - NEXT_PUBLIC_ADSTERRA_NATIVE_SRC     : URL du script Native Banner. Sa clé
//                                          (dernier segment) nomme le conteneur
//                                          « container-<clé> » attendu.
//  - NEXT_PUBLIC_ADSTERRA_BANNER_MOBILE  : clé du Banner 320x50 (< 768 px).
//  - NEXT_PUBLIC_ADSTERRA_BANNER_DESKTOP : clé du Banner 300x250 (≥ 768 px).
import { useEffect, useRef, useState } from 'react';
import { useAccess } from './AccessProvider';

const env = (value, fallback) => (value === undefined ? fallback : value);

const AD_HOST = 'https://bicea.org';
const SOCIALBAR_SRC = env(process.env.NEXT_PUBLIC_ADSTERRA_SOCIALBAR_SRC, `${AD_HOST}/14/56ff6c976d7d264a3439f37c7d6ca8e5`);
const NATIVE_SRC = env(process.env.NEXT_PUBLIC_ADSTERRA_NATIVE_SRC, `${AD_HOST}/21/00684bfc5a8802ccbed95bf0c1fa25a3`);
const NATIVE_KEY = NATIVE_SRC.split('/').pop();
const BANNERS = {
  mobile: { key: env(process.env.NEXT_PUBLIC_ADSTERRA_BANNER_MOBILE, '563c98782ed872bff3a559ced174eb4e'), width: 320, height: 50 },
  desktop: { key: env(process.env.NEXT_PUBLIC_ADSTERRA_BANNER_DESKTOP, 'd691104dc0fe411adbaedd982a916508'), width: 300, height: 250 },
};

function isNativeApp() {
  try {
    return !!window.Capacitor?.isNativePlatform?.();
  } catch {
    return false;
  }
}

// Un SEUL Banner par page : le script lit la variable GLOBALE atOptions à son
// exécution, deux bannières chargées en parallèle se la disputeraient.
function Banner() {
  const box = useRef(null);
  const [banner, setBanner] = useState(null);

  useEffect(() => {
    setBanner(window.matchMedia('(min-width: 768px)').matches ? BANNERS.desktop : BANNERS.mobile);
  }, []);

  useEffect(() => {
    const el = box.current;
    if (!el || !banner?.key) return undefined;
    const opts = document.createElement('script');
    opts.text = `atOptions = {'key':'${banner.key}','format':'iframe','height':${banner.height},'width':${banner.width},'params':{}};`;
    const invoke = document.createElement('script');
    invoke.src = `${AD_HOST}/22/${banner.key}`;
    el.append(opts, invoke);
    return () => { el.replaceChildren(); };
  }, [banner]);

  if (!banner?.key) return null;
  return (
    <div
      ref={box}
      aria-label="Publicité"
      style={{ display: 'flex', justifyContent: 'center', minHeight: banner.height, maxWidth: '100%', overflow: 'hidden', margin: '16px auto', width: banner.width }}
    />
  );
}

// Native Banner : le script remplit <div id="container-<clé>">, qui doit donc
// exister AVANT son exécution — d'où l'injection depuis l'effet, après rendu.
function NativeBanner() {
  const box = useRef(null);
  useEffect(() => {
    const el = box.current;
    if (!el) return undefined;
    const s = document.createElement('script');
    s.src = NATIVE_SRC;
    s.async = true;
    s.setAttribute('data-cfasync', 'false');
    el.before(s);
    return () => { s.remove(); el.replaceChildren(); };
  }, []);
  return <div ref={box} id={`container-${NATIVE_KEY}`} aria-label="Publicité" style={{ margin: '16px auto', maxWidth: 728 }} />;
}

function SocialBar() {
  useEffect(() => {
    const s = document.createElement('script');
    s.src = SOCIALBAR_SRC;
    s.setAttribute('data-cfasync', 'false');
    document.body.appendChild(s);
    return () => { s.remove(); };
  }, []);
  return null;
}

export default function AdsterraAds() {
  const access = useAccess();
  const [native, setNative] = useState(true);
  useEffect(() => { setNative(isNativeApp()); }, []);

  if (native || !access || access.allowed !== false) return null;
  return (
    <>
      {SOCIALBAR_SRC ? <SocialBar /> : null}
      {NATIVE_SRC ? <NativeBanner /> : null}
      <Banner />
    </>
  );
}
