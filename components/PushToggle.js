'use client';
// Bouton d'abonnement aux notifications push — nouveau secret, document ou
// produit ajouté (topic FCM "new-content", voir lib/push.js + api/push.js).
import { useEffect, useState } from 'react';
import { enablePush, disablePush, isPushEnabled } from '@/lib/push';

export default function PushToggle() {
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    setEnabled(isPushEnabled());
  }, []);

  useEffect(() => {
    if (!msg) return undefined;
    const t = setTimeout(() => setMsg(''), 3200);
    return () => clearTimeout(t);
  }, [msg]);

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (enabled) {
        await disablePush();
        setEnabled(false);
        setMsg('🔕 Notifications désactivées.');
      } else {
        await enablePush();
        setEnabled(true);
        setMsg('🔔 Notifications activées.');
      }
    } catch (e) {
      setMsg(e.message || 'Erreur notifications.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        className="signout-btn"
        onClick={toggle}
        disabled={busy}
        title={enabled ? 'Notifications activées (nouveaux secrets/documents/produits)' : 'Activer les notifications'}
        aria-label={enabled ? 'Désactiver les notifications' : 'Activer les notifications'}
      >
        {enabled ? '🔔' : '🔕'}
      </button>
      {msg && (
        <div
          style={{
            position: 'absolute',
            top: '110%',
            right: 0,
            whiteSpace: 'nowrap',
            zIndex: 20,
            background: 'rgba(0,0,0,.82)',
            color: '#fff',
            fontSize: '.78rem',
            padding: '6px 10px',
            borderRadius: 8,
          }}
        >
          {msg}
        </div>
      )}
    </div>
  );
}
