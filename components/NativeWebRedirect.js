'use client';
// Fin de l'application Android : invite les utilisateurs de l'APK à passer à
// la version web installée (PWA), utilisée par 95 % des visiteurs et seule
// encore mise à jour. Aucun nouvel APK n'est nécessaire : l'APK charge le
// site en direct (capacitor.config.ts → server.url), ce message y apparaît
// donc dès le déploiement.
//
// « Ouvrir la version web » pointe vers le domaine SANS www : Capacitor ouvre
// dans le navigateur du téléphone tout lien dont l'hôte diffère de celui de
// l'app (www.asrarpro.com), au lieu de le garder dans la WebView. Le domaine
// nu redirige ensuite vers www.asrarpro.com, où InstallBanner propose
// l'installation.
//
// Non bloquant (comme InstallBanner) : « Plus tard » le remet à demain.
import { useEffect, useState } from 'react';
import Modal from './Modal';

const WEB_URL = 'https://asrarpro.com/';
const SNOOZE_KEY = 'asrar_web_redirect_snooze';
const SNOOZE_MS = 24 * 60 * 60 * 1000;

export default function NativeWebRedirect() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { Capacitor } = await import('@capacitor/core');
        if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') return;
        const until = Number(localStorage.getItem(SNOOZE_KEY)) || 0;
        if (alive && Date.now() >= until) setOpen(true);
      } catch {
        /* pas de Capacitor : site ou PWA, rien à afficher */
      }
    })();
    return () => { alive = false; };
  }, []);

  const later = () => {
    try { localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_MS)); } catch {}
    setOpen(false);
  };

  if (!open) return null;
  return (
    <Modal className="sg-overlay" onClose={later} label="ASRAR PRO continue sur le web">
      <div className="sg-box">
        <button type="button" aria-label="Fermer la fenêtre" className="sg-close" onClick={later}>
          ✕
        </button>
        <div style={{ fontSize: '2.4rem' }}>🌐</div>
        <h2>ASRAR PRO continue sur le web</h2>
        <p className="sg-sub">
          L’application Android n’est plus mise à jour. Toutes les nouveautés arrivent désormais sur la version
          web, qui s’installe sur votre téléphone comme une application. Votre compte et votre abonnement restent
          les mêmes : connectez-vous simplement avec le même compte.
        </p>
        <ol className="sg-sub" style={{ textAlign: 'left', paddingLeft: 20 }}>
          <li>Touchez « Ouvrir la version web ».</li>
          <li>Dans le navigateur, touchez « Installer l’application ».</li>
          <li>Vous pourrez ensuite désinstaller cette application Android.</li>
        </ol>
        <p className="sg-note">
          ⏰ À savoir : le réveil sonore des heures planétaires n’existe que dans l’application Android. La version
          web vous prévient par notification.
        </p>
        <a className="sg-card best" style={{ display: 'block', width: '100%', marginTop: 8, textDecoration: 'none' }} href={WEB_URL}>
          Ouvrir la version web
        </a>
        <button type="button" className="sg-card" style={{ width: '100%', marginTop: 8 }} onClick={later}>
          Plus tard
        </button>
      </div>
    </Modal>
  );
}
