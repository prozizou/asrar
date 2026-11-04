'use client';
import { useEffect, useState } from 'react';

export default function NativeAdPrivacy() {
  const [plugin, setPlugin] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    let alive = true;
    const check = async () => {
      try {
        const { Capacitor, registerPlugin } = await import('@capacitor/core');
        if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable('UnityAds')) return;
        const native = registerPlugin('UnityAds');
        const capabilities = await native.getCapabilities();
        if (alive) setPlugin(capabilities.privacyRequired ? native : null);
      } catch { /* Earlier APKs do not expose the mediation consent API. */ }
    };
    void check();
    const resume = () => { if (!document.hidden) void check(); };
    document.addEventListener('visibilitychange', resume);
    return () => { alive = false; document.removeEventListener('visibilitychange', resume); };
  }, []);
  if (!plugin) return null;
  return <div>
    <button type="button" disabled={busy} onClick={async () => {
      setBusy(true); setMessage('');
      try { await plugin.showPrivacyOptions(); }
      catch { setMessage('Options indisponibles pour le moment. Réessayez.'); }
      finally { setBusy(false); }
    }}>Gérer mes choix publicitaires</button>
    {message && <p role="status">{message}</p>}
  </div>;
}
