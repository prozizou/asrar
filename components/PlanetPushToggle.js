'use client';
// Bouton d'activation des notifications push d'heure planétaire (lib/push.js)
// — isolé du reste de /planete pour garder son état (permission/abonnement)
// séparé de l'horloge/GPS de la page.
import { useEffect, useState } from 'react';
import { pushSupported, getPushSubscriptionState, subscribeToPush, unsubscribeFromPush } from '@/lib/push';

export default function PlanetPushToggle() {
  const [state, setState] = useState('checking'); // checking | unsupported | denied | subscribed | unsubscribed
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!pushSupported()) {
      setState('unsupported');
      return;
    }
    getPushSubscriptionState().then(setState);
  }, []);

  if (state === 'checking' || state === 'unsupported') return null; // rien à proposer sur cet appareil

  const toggle = async () => {
    setBusy(true);
    setError('');
    try {
      if (state === 'subscribed') {
        await unsubscribeFromPush();
        setState('unsubscribed');
      } else {
        await subscribeToPush();
        setState('subscribed');
      }
    } catch (e) {
      setError(e.message || "Impossible d'activer les notifications.");
      setState(await getPushSubscriptionState()); // reflète l'état réel (ex. permission refusée)
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ marginTop: 10 }}>
      <button className="access-btn" onClick={toggle} disabled={busy || state === 'denied'}>
        {state === 'subscribed' ? '🔕 Désactiver les notifications d’heure' : '🔔 Recevoir l’heure planétaire'}
      </button>
      {state === 'denied' && (
        <p className="error-text">Notifications bloquées par le navigateur — autorisez-les dans ses réglages pour ce site.</p>
      )}
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}
