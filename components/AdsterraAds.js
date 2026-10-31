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
//  - NEXT_PUBLIC_ADSTERRA_SOCIALBAR_SRC : URL du script Social Bar.
//  - NEXT_PUBLIC_ADSTERRA_POPUNDER_SRC  : URL du script Popunder.
//  - NEXT_PUBLIC_ADSTERRA_NATIVE_SRC    : URL du script Native Banner. Sa clé
//                                         (dernier segment) nomme le conteneur
//                                         « container-<clé> » attendu.
// Les clés des Banners sont dans BANNERS ci-dessous.
import { useEffect, useRef, useState } from 'react';
import { useAccess } from './AccessProvider';

const env = (value, fallback) => (value === undefined ? fallback : value);

const AD_HOST = 'https://bicea.org';
const SOCIALBAR_SRC = env(process.env.NEXT_PUBLIC_ADSTERRA_SOCIALBAR_SRC, `${AD_HOST}/14/56ff6c976d7d264a3439f37c7d6ca8e5`);
const POPUNDER_SRC = env(process.env.NEXT_PUBLIC_ADSTERRA_POPUNDER_SRC, 'https://afders.org/1/d5663adcf33b434a0bee2c6cd0625bb4');
const NATIVE_SRC = env(process.env.NEXT_PUBLIC_ADSTERRA_NATIVE_SRC, `${AD_HOST}/21/00684bfc5a8802ccbed95bf0c1fa25a3`);
const NATIVE_KEY = NATIVE_SRC.split('/').pop();
// Smartlink : simple lien (pas de script) — exporté pour qu'un bouton ou un
// lien « Sponsorisé » puisse s'en servir ; il n'est placé nulle part d'office.
export const ADSTERRA_SMARTLINK = 'https://arwf.org/4/c12b8f66b93c495d8d8a836d32401474';

const BANNERS = {
  b320x50: { key: '563c98782ed872bff3a559ced174eb4e', width: 320, height: 50 },
  b468x60: { key: '4e6dae61157b6b11ee648226d05336c6', width: 468, height: 60 },
  b728x90: { key: '58908a49d51073409be1bb6dac283f9b', width: 728, height: 90 },
  b300x250: { key: 'd691104dc0fe411adbaedd982a916508', width: 300, height: 250 },
  b160x300: { key: '4d2141d8a51d186c4ed329a1a9013dde', width: 160, height: 300 },
  b160x600: { key: '59ac401eb38177b992c5300da8969816', width: 160, height: 600 },
};
// Colonnes latérales (160 px) seulement si elles tiennent à côté du contenu,
// large au plus de 800 px : 800 + 2 × (160 + marges) ≈ 1200 px.
const SIDES_MIN_WIDTH = 1200;

function isNativeApp() {
  try {
    return !!window.Capacitor?.isNativePlatform?.();
  } catch {
    return false;
  }
}

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

function Banner({ banner, style }) {
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

// Bandeau adapté à la largeur d'écran + pavé 300x250, en bas du contenu ;
// colonnes 160x600 (droite) et 160x300 (gauche) sur grand écran.
function Banners() {
  const [width, setWidth] = useState(0);
  useEffect(() => { setWidth(window.innerWidth); }, []);
  if (!width) return null;
  const strip = width >= 768 ? BANNERS.b728x90 : width >= 480 ? BANNERS.b468x60 : BANNERS.b320x50;
  const side = { position: 'fixed', top: '50%', transform: 'translateY(-50%)', zIndex: 1 };
  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, margin: '16px auto' }}>
        <Banner banner={strip} />
        <Banner banner={BANNERS.b300x250} />
      </div>
      {width >= SIDES_MIN_WIDTH ? (
        <>
          <Banner banner={BANNERS.b160x300} style={{ ...side, left: 12 }} />
          <Banner banner={BANNERS.b160x600} style={{ ...side, right: 12 }} />
        </>
      ) : null}
    </>
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

function BodyScript({ src }) {
  useEffect(() => {
    const s = document.createElement('script');
    s.src = src;
    s.setAttribute('data-cfasync', 'false');
    document.body.appendChild(s);
    return () => { s.remove(); };
  }, [src]);
  return null;
}

export default function AdsterraAds() {
  const access = useAccess();
  const [native, setNative] = useState(true);
  useEffect(() => { setNative(isNativeApp()); }, []);

  if (native || !access || access.allowed !== false) return null;
  return (
    <>
      {SOCIALBAR_SRC ? <BodyScript src={SOCIALBAR_SRC} /> : null}
      {POPUNDER_SRC ? <BodyScript src={POPUNDER_SRC} /> : null}
      {NATIVE_SRC ? <NativeBanner /> : null}
      <Banners />
    </>
  );
}
