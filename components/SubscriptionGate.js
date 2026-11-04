'use client';
// Portail « abonnement requis » — port de showSubscriptionGate(), en composant
// React contrôlé par AccessProvider. Aucune injection de <style>/DOM manuelle.
//
// adEligible : alternative « regarder une publicité » (Unity Ads, APK
// uniquement) — une publicité regardée en entier débloque UNE utilisation
// (voir lib/unityAds.js, server/adReward.js).
import { useEffect, useState } from 'react';
import Modal from './Modal';
import { watchRewardedAd } from '@/lib/unityAds';
import SubscriptionPlans from './SubscriptionPlans';

const AD_MESSAGES = {
  no_fill: 'Aucune publicité disponible pour le moment. Réessayez dans quelques minutes.',
  skipped: "Publicité interrompue : regardez-la jusqu'au bout pour débloquer l'accès.",
  pending: 'Publicité validée en cours… Réessayez dans un instant : votre accès sera prêt.',
  error: 'Publicité indisponible pour le moment. Vérifiez votre connexion et réessayez.',
  unavailable: 'Publicité indisponible sur cet appareil.',
};

export default function SubscriptionGate({ open, reason, adEligible, onAdRewarded, onAdPending, onClose }) {
  const [adBusy, setAdBusy] = useState(false);
  const [adMessage, setAdMessage] = useState('');

  useEffect(() => {
    if (open) setAdMessage('');
  }, [open]);

  if (!open) return null;

  const watchAd = async () => {
    if (adBusy) return;
    setAdBusy(true);
    setAdMessage('');
    try {
      const result = await watchRewardedAd();
      if (result.ok) {
        if (!(await onAdRewarded())) setAdMessage(AD_MESSAGES.pending);
        return;
      }
      if (result.reason === 'pending') onAdPending();
      setAdMessage(AD_MESSAGES[result.reason] || AD_MESSAGES.error);
    } finally {
      setAdBusy(false);
    }
  };

  // reason === 'noads' : l'app est gratuite (lib/plans.js FREE_FOR_ALL),
  // l'abonnement retire les publicités (bouton « Retirer les publicités »,
  // components/AdsterraAds.js).
  const isNoAdsGate = reason === 'noads';

  // reason === 'level' : l'utilisateur a déjà un abonnement actif, mais pas le
  // palier requis par ce module (Al Qalam / Géomancie → forfait 1 An uniquement).
  const isLevelGate = reason === 'level';
  // reason === 'network' : la vérification d'accès a expiré (connexion lente),
  // on ne SAIT PAS si l'utilisateur est abonné ou non — lui proposer de payer
  // serait trompeur pour un abonné existant. Message honnête + réessayer.
  const isNetworkGate = reason === 'network';

  if (isNetworkGate) {
    return (
      <Modal className="sg-overlay" onClose={onClose} label={isNetworkGate ? 'Connexion trop lente' : 'Abonnement'}>
        <div className="sg-box">
          <button type="button" aria-label="Fermer la fenêtre" className="sg-close" onClick={onClose}>
            ✕
          </button>
          <div style={{ fontSize: '2.4rem' }}>📶</div>
          <h2>Connexion trop lente</h2>
          <p className="sg-sub">
            Impossible de vérifier votre accès pour le moment — vérifiez votre connexion et réessayez.
          </p>
          <button type="button" className="sg-card best" style={{ width: '100%', marginTop: 8 }} onClick={onClose}>
            Réessayer
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal className="sg-overlay" onClose={onClose} label={isNoAdsGate ? 'Retirer les publicités' : 'Abonnement'}>
      <div className="sg-box">
        <button type="button" aria-label="Fermer la fenêtre" className="sg-close" onClick={onClose}>
          ✕
        </button>
        <div style={{ fontSize: '2.4rem' }}>{isNoAdsGate ? '🚫' : '🔒'}</div>
        <h2>{isNoAdsGate ? 'ASRAR PRO sans publicité' : isLevelGate ? 'Réservé au forfait 1 An' : 'Abonnement requis'}</h2>
        <p className="sg-sub">
          {isNoAdsGate
            ? "L’application reste gratuite. Choisissez un abonnement sans publicités, par WhatsApp ou Wave. L’administration l’active après vérification du paiement."
            : isLevelGate
            ? "Ce module est réservé aux abonnés du forfait 1 An (45 000 FCFA). Passez à ce forfait, puis validez votre demande sur WhatsApp — l'accès est activé par l'administration."
            : "Choisissez une formule, puis validez votre demande sur WhatsApp. L'accès est activé par l'administration."}
        </p>
        {adEligible && !isLevelGate && !isNoAdsGate && (
          <div className="sg-ad">
            <button type="button" className="sg-ad-btn" onClick={watchAd} disabled={adBusy}>
              {adBusy ? 'Publicité en cours…' : '🎬 Regarder une publicité'}
            </button>
            <p className="sg-ad-hint">Gratuit : une publicité regardée en entier débloque cette utilisation.</p>
            {adMessage && <p className="sg-ad-msg" role="status">{adMessage}</p>}
            <p className="sg-ad-or">ou abonnez-vous</p>
          </div>
        )}
        <SubscriptionPlans />
      </div>
    </Modal>
  );
}
