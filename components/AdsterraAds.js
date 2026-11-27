'use client';
// Publicités Adsterra — montées dans Providers, donc sur toutes les pages.
// Site (iPhone/iPad, ordinateur) seulement. JAMAIS dans l'application
// Android : elle n'affiche que les publicités AdMob (bannières natives,
// AdMobDisplayAds.java, et vidéos récompensées). Jamais pour un abonné valide
// (adFree === true — l'app étant gratuite, l'abonnement retire les pubs).
// adFree === null (statut pas encore résolu) : rien d'affiché, pour ne pas
// montrer une pub une fraction de seconde à un abonné.
//
// Codes des unités du site asrarpro.com (tableau de bord Adsterra → Sites →
// Ad Units), pubs adultes désactivées. Chaque valeur peut être remplacée par
// une variable d'environnement Vercel (NEXT_PUBLIC_*, lue au build) ; une
// variable définie à une chaîne VIDE désactive le format correspondant.
//  - NEXT_PUBLIC_ADSTERRA_SOCIALBAR_SRC : URL du script Social Bar.
//  - NEXT_PUBLIC_ADSTERRA_POPUNDER_SRC : surcharge du Popunder, configuré
//                                      par défaut pour iPhone et iPad.
//  - NEXT_PUBLIC_ADSTERRA_NATIVE_SRC    : URL du script Native Banner. Sa clé
//                                         (dernier segment) nomme le conteneur
//                                         « container-<clé> » attendu.
//  - NEXT_PUBLIC_ADSTERRA_BANNERS=0     : coupe les bannières (actives par
//                                         défaut, voir components/AdsterraBanner.js).
// Les clés des Banners sont dans BANNERS (components/AdsterraBanner.js).
import { Ban, ExternalLink } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useAccess } from './AccessProvider';
import { ADSTERRA_SMARTLINK, isIOSAdsterra } from '@/lib/actionAd';
import { ADS_PAUSED } from '@/lib/plans';
import { AD_HOST, BANNERS, BANNERS_CONFIGURED, BANNERS_ENABLED, Banner } from './AdsterraBanner';

const env = (value, fallback) => (value === undefined ? fallback : value);

const SOCIALBAR_SRC = env(process.env.NEXT_PUBLIC_ADSTERRA_SOCIALBAR_SRC, `${AD_HOST}/14/56ff6c976d7d264a3439f37c7d6ca8e5`);
const POPUNDER_SRC = process.env.NEXT_PUBLIC_ADSTERRA_POPUNDER_SRC;
const IOS_POPUNDER_SRC = 'https://afders.org/1/d5663adcf33b434a0bee2c6cd0625bb4';
const NATIVE_SRC = env(process.env.NEXT_PUBLIC_ADSTERRA_NATIVE_SRC, `${AD_HOST}/21/00684bfc5a8802ccbed95bf0c1fa25a3`);
const NATIVE_KEY = NATIVE_SRC.split('/').pop();
// Smartlink : simple lien (pas de script), affiché par <SponsoredLink /> sur
// la page 404 et sous les résultats des calculs (Combinaisons, Wafq,
// Géomancie, Planète, Hijri). Jamais dans les achats ni les pages religieuses.
export { ADSTERRA_SMARTLINK };

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

// Bandeau adapté à la largeur d'écran + pavé 300x250, en bas du contenu ;
// colonnes 160x600 (droite) et 160x300 (gauche) sur grand écran.
function Banners({ ios = false }) {
  const [width, setWidth] = useState(0);
  useEffect(() => { setWidth(window.innerWidth); }, []);
  if (!width) return null;
  const strip = width >= 768 ? BANNERS.b728x90 : width >= 480 ? BANNERS.b468x60 : BANNERS.b320x50;
  const side = { position: 'fixed', top: '50%', transform: 'translateY(-50%)', zIndex: 1 };
  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, margin: '16px auto' }}>
        <Banner ios={ios} banner={strip} />
        <Banner ios={ios} banner={BANNERS.b300x250} />
        <RemoveAdsButton ios={ios} />
      </div>
      {width >= SIDES_MIN_WIDTH ? (
        <>
          <Banner ios={ios} banner={BANNERS.b160x300} style={{ ...side, left: 12 }} />
          <Banner ios={ios} banner={BANNERS.b160x600} style={{ ...side, right: 12 }} />
        </>
      ) : null}
    </>
  );
}

// Offre « sans publicité » : ouvre le portail d'abonnement (paiement validé
// sur WhatsApp, cf. components/SubscriptionGate.js, motif 'noads').
function RemoveAdsButton({ ios }) {
  const access = useAccess();
  return (
    <button
      type="button"
      onClick={() => access?.openGate(ios ? null : 'noads')}
      style={{ background: 'none', border: '1px solid var(--text-muted)', color: 'var(--text-muted)', borderRadius: 999, padding: '6px 14px', fontSize: 13, cursor: 'pointer' }}
    >
      <Ban size={14} aria-hidden="true" style={{ verticalAlign: -2 }} /> Retirer les publicités
    </button>
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

// Mêmes règles pour tous les formats : site web, visiteur non abonné.
// Où afficher des pubs : null (aucune — abonné, statut inconnu, ou pas
// encore déterminé), 'web' (site) ou 'app' (application Android, qui charge ce
// même site). Dans l'application, seuls les formats compatibles avec les
// règles de Google Play sont affichés (voir AdsterraAds) ; la pub plein écran
// aux actions y est celle d'Unity (lib/unityAds.js), pas l'onglet Smartlink.
// Application Android : aucun format Adsterra (AdMob uniquement).
function useAdPlace() {
  const access = useAccess();
  const [platform, setPlatform] = useState(null);
  useEffect(() => { setPlatform(isIOSAdsterra() ? 'ios' : isNativeApp() ? 'app' : 'web'); }, []);
  if (!platform || access?.adFree !== false) return null;
  if (platform === 'ios') return 'ios';
  // Ordinateur pendant la pause : bannières et Native Banner seulement (ni
  // Social Bar, ni Popunder). Android n'atteint pas ce cas : application →
  // null, navigateur Android → dérouté vers Google Play (lib/storeRedirect.js).
  if (ADS_PAUSED) return platform === 'web' ? 'desktop' : null;
  return platform === 'app' ? null : 'web';
}
function useShowAds() {
  const place = useAdPlace();
  return place === 'ios' || place === 'web';
}

export function SponsoredLink({ label = 'Découvrir une offre partenaire' }) {
  if (!useShowAds() || !ADSTERRA_SMARTLINK) return null;
  return (
    <p style={{ textAlign: 'center', margin: '20px 0 8px', fontSize: 13 }}>
      <a href={ADSTERRA_SMARTLINK} target="_blank" rel="sponsored noopener noreferrer" style={{ color: 'var(--text-muted)' }}>
        <span style={{ textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 11, marginRight: 6 }}>Sponsorisé</span>
        {label} <ExternalLink size={13} aria-hidden="true" style={{ verticalAlign: -2 }} />
      </a>
    </p>
  );
}

export default function AdsterraAds() {
  const place = useAdPlace();
  if (!place) return null;
  if (place === 'desktop') {
    return (
      <>
        {NATIVE_SRC ? <NativeBanner /> : null}
        {BANNERS_CONFIGURED ? <Banners /> : null}
      </>
    );
  }
  const popunder = env(POPUNDER_SRC, place === 'ios' ? IOS_POPUNDER_SRC : '');
  return (
    <>
      {SOCIALBAR_SRC ? <BodyScript src={SOCIALBAR_SRC} /> : null}
      {popunder ? <BodyScript src={popunder} /> : null}
      {NATIVE_SRC ? <NativeBanner /> : null}
      {(place === 'ios' ? BANNERS_CONFIGURED : BANNERS_ENABLED) ? <Banners ios={place === 'ios'} /> : null}
    </>
  );
}
