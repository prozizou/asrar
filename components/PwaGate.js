'use client';
// PwaGate — rend l'app installable (PWA).
//   • Enregistre le service worker (/sw.js) pour tous les visiteurs.
//   • Android/Chromium : capte `beforeinstallprompt` — voir lib/installPrompt.js
//     (capture PARTAGÉE : le bouton « Installer l'application » du menu,
//     components/AppDrawer.js, déclenche la même invite native).
//   • L'écran d'installation plein écran BLOQUANT au démarrage est désactivé
//     (FORCE_INSTALL = false) : l'app s'ouvre toujours directement dans le
//     navigateur, installée ou non. Repasser à true pour le réactiver.
import { useEffect, useState } from 'react';
import Image from 'next/image';
import { isStandalone, isIOS, getInstallState, subscribeInstallState, promptInstall as promptInstallShared } from '@/lib/installPrompt';

const FORCE_INSTALL = false;

export default function PwaGate({ children }) {
  const [mounted, setMounted] = useState(false);
  const [standalone, setStandalone] = useState(true); // optimiste → pas de flash pour les installés
  const [installState, setInstallState] = useState(getInstallState); // { canInstall, installed }
  const [webFallback, setWebFallback] = useState(false); // échappatoire si install impossible

  useEffect(() => {
    setMounted(true);
    setStandalone(isStandalone());
    setInstallState(getInstallState());

    // Enregistrement du service worker (tous les visiteurs).
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});

      // public/sw.js appelle déjà self.skipWaiting() + clients.claim() : un
      // nouveau SW prend le contrôle de cet onglet dès qu'il est détecté, SANS
      // attendre la fermeture des onglets ouverts. Mais le JS déjà CHARGÉ en
      // mémoire dans cet onglet reste l'ancien tant qu'on ne recharge pas —
      // jusqu'ici rien ne le faisait, d'où le symptôme « après un déploiement,
      // il faut vider le cache à la main pour que l'app refonctionne ».
      // 'controllerchange' se déclenche exactement à ce moment (y compris à la
      // toute première visite, quand clients.claim() prend le contrôle d'une
      // page chargée avant l'enregistrement du SW — un rechargement de plus à
      // ce moment-là est sans conséquence). On recharge une seule fois.
      let reloaded = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (reloaded) return;
        reloaded = true;
        window.location.reload();
      });
    }

    const mql = window.matchMedia('(display-mode: standalone)');
    const onDisplay = () => setStandalone(isStandalone());
    if (mql.addEventListener) mql.addEventListener('change', onDisplay);

    const unsubscribe = subscribeInstallState(() => setInstallState(getInstallState()));

    return () => {
      if (mql.removeEventListener) mql.removeEventListener('change', onDisplay);
      unsubscribe();
    };
  }, []);

  const promptInstall = () => promptInstallShared();

  // Déjà installé, ou pas encore monté (SSR/hydratation) → app normale.
  const showGate = mounted && !standalone && FORCE_INSTALL && !webFallback;

  const ios = mounted && isIOS();
  const canPrompt = installState.canInstall;
  const installed = installState.installed;
  const cannotInstall = mounted && !ios && !canPrompt; // desktop/navigateur non supporté

  return (
    <>
      {children}
      {showGate && (
        <div style={ov}>
          <div style={card}>
            <Image
              src="/assets/logo-mark.png"
              alt="ASRAR PRO"
              width={84}
              height={84}
              style={{ borderRadius: 18, marginBottom: 12 }}
            />
            <h1 style={{ fontSize: '1.35rem', margin: '0 0 6px', color: '#fff' }}>ASRAR PRO</h1>

            {installed ? (
              <>
                <p style={txt}>✅ Application installée.</p>
                <p style={txt}>Ouvrez maintenant <b>ASRAR PRO</b> depuis votre écran d'accueil pour continuer.</p>
              </>
            ) : (
              <>
                <p style={{ ...txt, fontWeight: 600, color: '#fff' }}>
                  Installez l'application pour continuer
                </p>
                <p style={txt}>
                  ASRAR PRO fonctionne comme une véritable application (plus rapide, hors-ligne, sur votre écran
                  d'accueil).
                </p>

                {canPrompt && (
                  <button onClick={promptInstall} style={btn}>
                    📲 Installer l'application
                  </button>
                )}

                {ios && !canPrompt && (
                  <div style={steps}>
                    <div style={step}>
                      <span style={num}>1</span> Appuyez sur <b>Partager</b>{' '}
                      <span style={{ fontSize: '1.1em' }}>⎋</span> en bas de Safari
                    </div>
                    <div style={step}>
                      <span style={num}>2</span> Choisissez <b>« Sur l'écran d'accueil »</b>{' '}
                      <span style={{ fontSize: '1.1em' }}>➕</span>
                    </div>
                    <div style={step}>
                      <span style={num}>3</span> Ouvrez <b>ASRAR PRO</b> depuis votre écran d'accueil
                    </div>
                  </div>
                )}

                {cannotInstall && (
                  <>
                    <p style={{ ...txt, fontSize: '.85rem' }}>
                      Pour installer, ouvrez ce site dans <b>Chrome</b> (Android) ou <b>Safari</b> (iPhone/iPad), puis
                      « Ajouter à l'écran d'accueil ».
                    </p>
                    <button onClick={() => setWebFallback(true)} style={{ ...btn, background: 'rgba(255,255,255,.14)', color: '#fff' }}>
                      Continuer dans le navigateur
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

const ov = {
  position: 'fixed',
  inset: 0,
  zIndex: 100000,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 20,
  background: 'radial-gradient(ellipse at 50% 20%, #14303a 0%, #0a0a14 75%)',
};
const card = {
  maxWidth: 420,
  width: '100%',
  textAlign: 'center',
  background: 'rgba(255,255,255,.06)',
  border: '1px solid rgba(255,255,255,.15)',
  borderRadius: 20,
  padding: '28px 22px',
  boxShadow: '0 20px 50px rgba(0,0,0,.5)',
  backdropFilter: 'blur(12px)',
  fontFamily: 'system-ui, -apple-system, sans-serif',
};
const txt = { color: '#cfd8dc', fontSize: '.95rem', lineHeight: 1.55, margin: '0 0 12px' };
const btn = {
  width: '100%',
  border: 'none',
  borderRadius: 14,
  padding: '14px 18px',
  marginTop: 8,
  fontSize: '1rem',
  fontWeight: 700,
  cursor: 'pointer',
  color: '#04212b',
  background: 'linear-gradient(45deg,#4facfe,#00f2fe)',
};
const steps = { textAlign: 'left', marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 };
const step = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  color: '#e0e6ea',
  fontSize: '.92rem',
  background: 'rgba(255,255,255,.05)',
  border: '1px solid rgba(255,255,255,.12)',
  borderRadius: 12,
  padding: '10px 12px',
};
const num = {
  flex: '0 0 auto',
  width: 24,
  height: 24,
  borderRadius: '50%',
  background: 'linear-gradient(45deg,#4facfe,#00f2fe)',
  color: '#04212b',
  fontWeight: 700,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '.85rem',
};
