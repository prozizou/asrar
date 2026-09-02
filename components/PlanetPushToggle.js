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

  // Interrupteur plutôt qu'un second gros bouton turquoise identique à
  // « Déterminer les heures planétaires » (revue design, point 8) : recevoir
  // une notification est une PRÉFÉRENCE, pas l'action principale de la page
  // — un bouton de même poids visuel que l'action principale la faisait
  // passer, à tort, pour tout aussi prioritaire.
  const isOn = state === 'subscribed';
  return (
    <div className="push-toggle-row">
      <label className="push-toggle">
        <span className="push-toggle-label">Notifications des heures planétaires</span>
        <button
          type="button"
          role="switch"
          aria-checked={isOn}
          className={'switch' + (isOn ? ' on' : '')}
          onClick={toggle}
          disabled={busy || state === 'denied'}
        >
          <span className="switch-knob" />
        </button>
      </label>
      {state === 'denied' && (
        <p className="error-text">Notifications bloquées par le navigateur — autorisez-les dans ses réglages pour ce site.</p>
      )}
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}
