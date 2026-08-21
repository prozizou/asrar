'use client';
// Bandeau de rappel d'expiration d'abonnement (J-3) — sans lui, l'accès
// venait juste à échouer silencieusement (bloqué par le paywall) le jour de
// l'expiration, sans que l'utilisateur n'ait été prévenu ni n'ait eu
// l'occasion de renouveler avant de perdre l'accès.
import { useEffect, useState } from 'react';
import { openAccess } from '@/lib/whatsapp';
import { useAuth } from './AuthProvider';

const WARN_DAYS = 3;
const DAY_MS = 86400000;
const DISMISS_KEY = 'asrar_expiry_banner_dismissed_until';

export default function SubscriptionExpiryBanner({ expiresAt }) {
  const { user } = useAuth();
  const [dismissedUntil, setDismissedUntil] = useState(0);

  // Lu au montage seulement (pas de risque de mismatch SSR : ce composant
  // ne rend jamais rien au premier rendu serveur, `expiresAt` démarre à null).
  useEffect(() => {
    try {
      setDismissedUntil(parseInt(localStorage.getItem(DISMISS_KEY), 10) || 0);
    } catch {}
  }, []);

  if (typeof expiresAt !== 'number') return null; // pas d'expiration connue (admin/vip/à vie/pas d'accès)

  const daysLeft = Math.ceil((expiresAt - Date.now()) / DAY_MS);
  if (daysLeft > WARN_DAYS || daysLeft < 0) return null; // trop tôt, ou déjà expiré (le paywall gère alors)
  if (Date.now() < dismissedUntil) return null;

  const dismiss = () => {
    // Réapparaît le lendemain (pas "pour toujours") : un abonnement qui
    // expire dans 3 jours mérite un rappel chaque jour, pas juste une fois.
    const until = Date.now() + DAY_MS;
    try {
      localStorage.setItem(DISMISS_KEY, String(until));
    } catch {}
    setDismissedUntil(until);
  };

  const label =
    daysLeft <= 0 ? "Votre abonnement expire aujourd'hui" : `Votre abonnement expire dans ${daysLeft} jour${daysLeft > 1 ? 's' : ''}`;

  return (
    <div className="expiry-banner" role="status">
      <span className="expiry-banner-text">
        ⏳ {label}.{' '}
        <button
          className="expiry-banner-link"
          onClick={() => openAccess({ email: user?.email, section: 'Renouvellement (rappel J-' + Math.max(daysLeft, 0) + ')' })}
        >
          Renouveler sur WhatsApp
        </button>
      </span>
      <button className="expiry-banner-close" aria-label="Fermer" onClick={dismiss}>
        ✕
      </button>
    </div>
  );
}
