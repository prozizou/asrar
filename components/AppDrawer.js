'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { UserRound, ShoppingBag, Moon, Sun, LogOut, X, Download, ChevronRight } from 'lucide-react';
import Modal from './Modal';
import { useAuth } from '@/components/AuthProvider';
import { isStandalone, isIOS, getInstallState, subscribeInstallState, promptInstall } from '@/lib/installPrompt';

function getSwVersion() {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.serviceWorker?.controller) { resolve(null); return; }
    const channel = new MessageChannel();
    const finish = (version) => { clearTimeout(timer); channel.port1.close(); resolve(version); };
    const timer = setTimeout(() => finish(null), 1500);
    channel.port1.onmessage = (event) => finish(event.data?.version || null);
    navigator.serviceWorker.controller.postMessage({ type: 'GET_VERSION' }, [channel.port2]);
  });
}

export default function AppDrawer({ trigger, triggerClassName, triggerLabel }) {
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false), [theme, setTheme] = useState('dark'), [swVersion, setSwVersion] = useState(null);
  const [standalone, setStandalone] = useState(true), [installState, setInstallState] = useState(getInstallState), [ios, setIos] = useState(false);
  const name = user?.displayName || user?.email?.split('@')[0] || 'Mon compte';
  useEffect(() => { setTheme(document.documentElement.getAttribute('data-theme') || 'dark'); }, []);
  useEffect(() => {
    setStandalone(isStandalone()); setIos(isIOS()); setInstallState(getInstallState());
    return subscribeInstallState(() => setInstallState(getInstallState()));
  }, []);
  useEffect(() => {
    let active = true;
    const update = () => getSwVersion().then((version) => { if (active) setSwVersion(version); });
    update(); navigator.serviceWorker?.addEventListener('controllerchange', update);
    return () => { active = false; navigator.serviceWorker?.removeEventListener('controllerchange', update); };
  }, [open]);
  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next); document.documentElement.style.colorScheme = next;
    try { localStorage.setItem('asrar_theme', next); } catch {}
    setTheme(next);
  };
  return <>
    <button type="button" className={triggerClassName || 'signout-btn'} onClick={() => setOpen(true)}
      aria-label={triggerLabel || 'Ouvrir le menu'} aria-haspopup="dialog" aria-expanded={open} title={triggerLabel || 'Menu'}>{trigger || '☰'}</button>
    {open && <Modal className="drawer-overlay" onClose={() => setOpen(false)} label="Menu">
      <div className="drawer-panel">
        <div className="drawer-header"><h2>Mon espace</h2><button type="button" className="drawer-close" onClick={() => setOpen(false)} aria-label="Fermer le menu"><X size={20} aria-hidden="true" /></button></div>
        <div className="drawer-identity"><span className="drawer-avatar" aria-hidden="true">{name.charAt(0).toUpperCase()}</span><div><strong dir="auto">{name}</strong><span>{user?.email}</span></div></div>
        <div className="drawer-body">
          <p className="drawer-section-label">Votre activité</p>
          <nav className="drawer-nav" aria-label="Espace personnel">
            <Link href="/compte" className="drawer-row drawer-row-link" onClick={() => setOpen(false)}><UserRound size={20} aria-hidden="true" /><span>Mon compte et mes données</span><ChevronRight size={16} aria-hidden="true" /></Link>
            <Link href="/commandes" className="drawer-row drawer-row-link" onClick={() => setOpen(false)}><ShoppingBag size={20} aria-hidden="true" /><span>Mes demandes et commandes</span><ChevronRight size={16} aria-hidden="true" /></Link>
          </nav>
          <p className="drawer-section-label">Préférences</p>
          <div className="drawer-row"><span className="drawer-row-label">{theme === 'light' ? <Sun size={20} aria-hidden="true" /> : <Moon size={20} aria-hidden="true" />} Mode {theme === 'light' ? 'clair' : 'sombre'}</span>
            <button type="button" className={'theme-switch' + (theme === 'light' ? ' is-light' : '')} role="switch" aria-checked={theme === 'light'} aria-label="Basculer entre le mode clair et le mode sombre" onClick={toggleTheme}><span className="theme-switch-thumb" /></button>
          </div>
          {!standalone && installState.canInstall && <button type="button" className="drawer-row drawer-row-link" onClick={promptInstall}><Download size={20} aria-hidden="true" /><span>Installer l’application</span></button>}
          {!standalone && !installState.canInstall && ios && <p className="drawer-install-tip">Pour installer l’application : Partager, puis « Sur l’écran d’accueil ».</p>}
        </div>
        <div className="drawer-footer"><div className="drawer-version"><span>Version de l’app</span><span>{swVersion || process.env.NEXT_PUBLIC_APP_VERSION || 'Version web'}</span></div>
          <button type="button" className="drawer-row drawer-row-link drawer-row-danger" onClick={signOut}><LogOut size={20} aria-hidden="true" /><span>Déconnexion</span></button>
        </div>
      </div>
    </Modal>}
  </>;
}
