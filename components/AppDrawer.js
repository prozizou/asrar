'use client';
// Drawer principal de l'accueil : thème clair/sombre (contrôle désormais
// unique de l'app, ex-bouton flottant ThemeToggle), paramètres et version.
// Le thème initial est posé avant le rendu par le script anti-FOUC du layout ;
// ici on ne fait que lire/écrire l'attribut data-theme déjà en place.
import { useEffect, useState } from 'react';
import pkg from '@/package.json';

const APP_VERSION = pkg.version;
// SHA court du commit déployé (voir next.config.mjs) — change à chaque
// déploiement, contrairement à APP_VERSION (package.json), rarement bumpé.
const BUILD_SHA = process.env.NEXT_PUBLIC_BUILD_SHA || '';

export default function AppDrawer() {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState('dark');

  useEffect(() => {
    setTheme(document.documentElement.getAttribute('data-theme') || 'dark');
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

              <div className="drawer-row drawer-row-static">
                <span className="drawer-row-label">
                  <span className="drawer-row-icon">📦</span>
                  Version de l'app
                </span>
                <span className="drawer-row-hint">
                  v{APP_VERSION}
                  {BUILD_SHA ? ` · ${BUILD_SHA}` : ''}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
