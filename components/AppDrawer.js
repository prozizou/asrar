'use client';
// Drawer principal de l'accueil : thème clair/sombre (contrôle désormais
// unique de l'app, ex-bouton flottant ThemeToggle), paramètres et version.
// Le thème initial est posé avant le rendu par le script anti-FOUC du layout ;
// ici on ne fait que lire/écrire l'attribut data-theme déjà en place.
import { useEffect, useState } from 'react';
import pkg from '@/package.json';
import { isStandalone, isIOS, getInstallState, subscribeInstallState, promptInstall } from '@/lib/installPrompt';

const APP_VERSION = pkg.version;

// Interroge le service worker ACTIF (celui qui contrôle réellement la page)
// pour sa version — plus fidèle que package.json/APP_VERSION, qui n'est
// presque jamais mis à jour alors que SW_VERSION l'est à chaque déploiement
// (voir public/sw.js). Résout `null` si aucun SW ne contrôle encore la page
// (premier chargement avant install) ou en l'absence de réponse.
function getSwVersion() {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.serviceWorker || !navigator.serviceWorker.controller) {
      resolve(null);
      return;
    }
    const channel = new MessageChannel();
    const timer = setTimeout(() => resolve(null), 1500);
    channel.port1.onmessage = (event) => {
      clearTimeout(timer);
      resolve((event.data && event.data.version) || null);
    };
    navigator.serviceWorker.controller.postMessage({ type: 'GET_VERSION' }, [channel.port2]);
  });
}

export default function AppDrawer() {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState('dark');
  const [swVersion, setSwVersion] = useState(null);
  const [standalone, setStandalone] = useState(true); // optimiste → pas de flash de la ligne pour les installés
  const [installState, setInstallState] = useState(getInstallState); // { canInstall, installed }
  const [ios, setIos] = useState(false);

  useEffect(() => {
    setTheme(document.documentElement.getAttribute('data-theme') || 'dark');
  }, []);

  // Voir lib/installPrompt.js : capture PARTAGÉE avec PwaGate (un seul
  // listener global), on ne fait ici que s'abonner à son état.
  useEffect(() => {
    setStandalone(isStandalone());
    setIos(isIOS());
    setInstallState(getInstallState());
    return subscribeInstallState(() => setInstallState(getInstallState()));
  }, []);

  useEffect(() => {
    getSwVersion().then(setSwVersion);
  }, []);

  // Échap ferme le drawer.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    document.documentElement.style.colorScheme = next;
    try {
      localStorage.setItem('asrar_theme', next);
    } catch {}
    setTheme(next);
  };

  return (
    <>
      <button
        type="button"
        className="signout-btn"
        onClick={() => setOpen(true)}
        aria-label="Ouvrir le menu"
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Menu"
      >
        ☰
      </button>

      {open && (
        <div className="drawer-overlay" onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className="drawer-panel" role="dialog" aria-modal="true" aria-label="Menu">
            <div className="drawer-header">
              <h3>✦ Menu ✦</h3>
              <button type="button" className="drawer-close" onClick={() => setOpen(false)} aria-label="Fermer le menu">
                ✕
              </button>
            </div>

            <div className="drawer-body">
              <div className="drawer-row">
                <span className="drawer-row-label">
                  <span className="drawer-row-icon">{theme === 'light' ? '☀️' : '🌙'}</span>
                  Mode {theme === 'light' ? 'clair' : 'sombre'}
                </span>
                <button
                  type="button"
                  className={'theme-switch' + (theme === 'light' ? ' is-light' : '')}
                  role="switch"
                  aria-checked={theme === 'light'}
                  aria-label="Basculer entre le mode clair et le mode sombre"
                  onClick={toggleTheme}
                >
                  <span className="theme-switch-thumb" />
                </button>
              </div>

              <div className="drawer-row drawer-row-static">
                <span className="drawer-row-label">
                  <span className="drawer-row-icon">⚙️</span>
                  Paramètres
                </span>
                <span className="drawer-row-hint">Bientôt disponible</span>
              </div>

              {!standalone &&
                (installState.canInstall ? (
                  <button type="button" className="drawer-row drawer-row-link" onClick={promptInstall}>
                    <span className="drawer-row-label">
                      <span className="drawer-row-icon">📲</span>
                      Installer l'application
                    </span>
                  </button>
                ) : (
                  <div className="drawer-row drawer-row-static">
                    <span className="drawer-row-label">
                      <span className="drawer-row-icon">📲</span>
                      Installer l'application
                    </span>
                    <span className="drawer-row-hint">
                      {ios ? 'Partager ⎋ → Écran d’accueil' : 'Non proposé par ce navigateur'}
                    </span>
                  </div>
                ))}

              <div className="drawer-row drawer-row-static">
                <span className="drawer-row-label">
                  <span className="drawer-row-icon">📦</span>
                  Version de l'app
                </span>
                {/* Version du service worker réellement actif sur l'appareil
                    (voir getSwVersion) — repli sur package.json tant qu'elle
                    n'est pas encore résolue ou hors contexte PWA/SW. Plus de
                    SHA de commit accolé ici (retiré à la demande) : ce
                    numéro seul suffit, voir public/sw.js. */}
                <span className="drawer-row-hint">{swVersion || `v${APP_VERSION}`}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
