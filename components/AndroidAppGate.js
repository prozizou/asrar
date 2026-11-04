'use client';
// Visiteurs Android du SITE : ASRAR PRO s'utilise avec l'application Google
// Play (lib/androidApp.js). À l'arrivée, redirection vers la page Google Play
// (une fois par visite) : elle propose « Ouvrir » si l'application est
// installée, sinon « Installer ». Au retour, la fenêtre reste affichée avec
// « Ouvrir l'application » (lien intent, qui exige un vrai clic : lancé
// automatiquement, le navigateur le refuse et la page ne répond plus aux
// clics), « Installer depuis Google Play » et une sortie pour qui ne peut pas
// installer.
// iPhone, ordinateur et l'application elle-même : rien ne s'affiche.
// Désactivable sans code : NEXT_PUBLIC_ANDROID_APP_REDIRECT=0 (Vercel).
import { useEffect, useState } from 'react';
import Image from 'next/image';
import Modal from './Modal';
import { openAppIntentUrl, PLAY_STORE_URL, shouldRedirectToApp, SKIP_KEY, SKIP_MS } from '@/lib/androidApp';

// Redirection automatique déjà faite pendant cette visite (onglet).
const REDIRECTED_KEY = 'asrar_android_play_redirected';

const FLAG = process.env.NEXT_PUBLIC_ANDROID_APP_REDIRECT;

function isNativeApp() {
  try { return !!window.Capacitor?.isNativePlatform?.(); } catch { return false; }
}

export default function AndroidAppGate() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let skipUntil = 0;
    try { skipUntil = Number(localStorage.getItem(SKIP_KEY)) || 0; } catch { /* stockage indisponible */ }
    if (!shouldRedirectToApp({ ua: navigator.userAgent, native: isNativeApp(), flag: FLAG, skipUntil })) return;
    setOpen(true);
    let redirected = false;
    try { redirected = sessionStorage.getItem(REDIRECTED_KEY) === '1'; sessionStorage.setItem(REDIRECTED_KEY, '1'); } catch { redirected = true; }
    if (!redirected) window.location.href = PLAY_STORE_URL;
  }, []);

  const skip = () => {
    try { localStorage.setItem(SKIP_KEY, String(Date.now() + SKIP_MS)); } catch { /* sans effet durable */ }
    setOpen(false);
  };

  if (!open) return null;
  return (
    <Modal className="sg-overlay" label="ASRAR PRO sur Google Play">
      <div className="sg-box">
        <Image src="/assets/logo-mark.png" alt="" width={64} height={64} style={{ margin: '0 auto 8px' }} />
        <h2>ASRAR PRO est sur Google Play</h2>
        <p className="sg-sub">
          Sur Android, ASRAR PRO s’utilise avec l’application. Ouvrez-la si elle est déjà installée, sinon
          installez-la depuis Google Play : votre compte et votre abonnement restent les mêmes.
        </p>
        <a className="sg-card best" style={{ display: 'block', width: '100%', marginTop: 8, textDecoration: 'none' }} href={openAppIntentUrl()}>
          Ouvrir l’application
        </a>
        <a className="sg-card" style={{ display: 'block', width: '100%', marginTop: 8, textDecoration: 'none' }} href={PLAY_STORE_URL}>
          Installer depuis Google Play
        </a>
        <button
          type="button"
          onClick={skip}
          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 12, marginTop: 14, cursor: 'pointer', textDecoration: 'underline' }}
        >
          Je ne peux pas installer l’application
        </button>
      </div>
    </Modal>
  );
}
