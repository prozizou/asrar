'use client';
// Portail « abonnement requis » — port de showSubscriptionGate(), en composant
// React contrôlé par AccessProvider. Aucune injection de <style>/DOM manuelle.
import { SUB_PLANS } from '@/lib/access';
import { openAccess } from '@/lib/whatsapp';
import { useAuth } from './AuthProvider';

export default function SubscriptionGate({ open, reason, onClose }) {
  const { user } = useAuth();
  if (!open) return null;

  const request = (planId) => openAccess({ planId, email: user?.email });

  // reason === 'level' : l'utilisateur a déjà un abonnement actif, mais pas le
  // palier requis par ce module (Al Qalam / Géomancie → forfait 1 An uniquement).
  const isLevelGate = reason === 'level';

  return (
    <div className="sg-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sg-box">
        <span className="sg-close" onClick={onClose}>
          ✕
        </span>
        <div style={{ fontSize: '2.4rem' }}>🔒</div>
        <h2>{isLevelGate ? 'Réservé au forfait 1 An' : 'Abonnement requis'}</h2>
        <p className="sg-sub">
          {isLevelGate
            ? "Ce module est réservé aux abonnés du forfait 1 An (45 000 FCFA). Passez à ce forfait, puis validez votre demande sur WhatsApp — l'accès est activé par l'administration."
            : "Choisissez une formule, puis validez votre demande sur WhatsApp. L'accès est activé par l'administration."}
        </p>
        <div className="sg-grid">
          {SUB_PLANS.map((p) => (
            <div
              key={p.id}
              className={'sg-card' + (p.best ? ' best' : '') + (isLevelGate && !p.best ? ' sg-card-dim' : '')}
              onClick={() => request(p.id)}
            >
              {p.badge && <span className="sg-badge">{p.badge}</span>}
              <div className="sg-dur">{p.dur}</div>
              <div className="sg-price">
                {p.price} <small>FCFA</small>
              </div>
            </div>
          ))}
        </div>
        <p className="sg-note">💬 Cliquez sur une formule pour envoyer votre demande via WhatsApp.</p>
      </div>
    </div>
  );
}
