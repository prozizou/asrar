'use client';
// Publicités Adsterra — SITE WEB UNIQUEMENT. Montées dans Providers, donc sur
// toutes les pages. Jamais dans l'APK/Capacitor (Google Play : l'APK utilise
// Unity Ads, cf. lib/unityAds.js) et jamais pour un abonné (allowed === true).
// allowed === null (accès pas encore résolu) : rien d'affiché, pour ne pas
// montrer une pub une fraction de seconde à un abonné.
//
// Les clés viennent du tableau de bord Adsterra (Sites → Ad Units) et se posent
// dans les variables d'environnement Vercel (NEXT_PUBLIC_*, lues au build).
// Variable absente = format désactivé, aucun script chargé :
//  - NEXT_PUBLIC_ADSTERRA_SOCIALBAR_SRC : URL complète du script Social Bar.
//  - NEXT_PUBLIC_ADSTERRA_BANNER_KEY    : clé du Banner (invoke.js).
//  - NEXT_PUBLIC_ADSTERRA_BANNER_SIZE   : « 320x50 » (défaut) ou 300x250,
//                                         468x60, 728x90, 160x300, 160x600.
//  - NEXT_PUBLIC_ADSTERRA_BANNER_HOST   : domaine d'invoke.js si Adsterra en
//                                         donne un autre (défaut ci-dessous).
import { useEffect, useRef } from 'react';
import { useAccess } from './AccessProvider';

const SOCIALBAR_SRC = process.env.NEXT_PUBLIC_ADSTERRA_SOCIALBAR_SRC || '';
const BANNER_KEY = process.env.NEXT_PUBLIC_ADSTERRA_BANNER_KEY || '';
const BANNER_SIZE = process.env.NEXT_PUBLIC_ADSTERRA_BANNER_SIZE || '320x50';
const BANNER_HOST = process.env.NEXT_PUBLIC_ADSTERRA_BANNER_HOST || 'www.highperformanceformat.com';

function isNativeApp() {
  try {
    return !!window.Capacitor?.isNativePlatform?.();
  } catch {
    return false;
  }
}

function Banner() {
  const box = useRef(null);
  useEffect(() => {
    const el = box.current;
    if (!el || !BANNER_KEY) return undefined;
    const [width, height] = BANNER_SIZE.split('x').map(Number);
    // invoke.js lit window.atOptions au moment de son exécution : un script
    // inline le pose juste avant, dans le même conteneur.
    const opts = document.createElement('script');
    opts.text = `atOptions = {'key':'${BANNER_KEY}','format':'iframe','height':${height},'width':${width},'params':{}};`;
    const invoke = document.createElement('script');
    invoke.src = `https://${BANNER_HOST}/${BANNER_KEY}/invoke.js`;
    invoke.async = true;
    el.append(opts, invoke);
    return () => { el.replaceChildren(); };
  }, []);
  const [w, h] = BANNER_SIZE.split('x').map(Number);
  return (
    <div
      ref={box}
      aria-label="Publicité"
      style={{ display: 'flex', justifyContent: 'center', minHeight: h, maxWidth: '100%', overflow: 'hidden', margin: '16px auto', width: w }}
    />
  );
}

function SocialBar() {
  useEffect(() => {
    if (!SOCIALBAR_SRC) return undefined;
    const s = document.createElement('script');
    s.src = SOCIALBAR_SRC;
    s.async = true;
    document.body.appendChild(s);
    return () => { s.remove(); };
  }, []);
  return null;
}

export default function AdsterraAds() {
  const access = useAccess();
  if (!SOCIALBAR_SRC && !BANNER_KEY) return null;
  if (typeof window !== 'undefined' && isNativeApp()) return null;
  if (!access || access.allowed !== false) return null;
  return (
    <>
      {SOCIALBAR_SRC ? <SocialBar /> : null}
      {BANNER_KEY ? <Banner /> : null}
    </>
  );
}
