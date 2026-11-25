'use client';
// Invitation à regarder une publicité récompensée tous les 100 grains (Zikr collectif).
//
// FACULTATIVE : la règle AdMob impose qu'une publicité récompensée soit proposée,
// jamais imposée — la vidéo ne démarre que sur « Regarder ». La récitation n'est
// jamais interrompue : bannière flottante (aucun décalage de la mise en page, donc
// aucun risque d'appui accidentel sous le pouce), repliée seule après quelques secondes.
// Application Android uniquement, comptes sans abonnement (components/AccessProvider.js
// getAdOffer). Un point par vidéo confirmée par le serveur (lib/unityAds.js).
import { useCallback, useEffect, useRef, useState } from 'react';
import { Clapperboard, X } from 'lucide-react';
import { useAccess } from '@/components/AccessProvider';
import { watchRewardedAd } from '@/lib/unityAds';
import { AD_POINTS_PER_ACTION } from '@/lib/adPoints';
import { crossedAdThreshold, adThresholdReached } from '@/lib/zikrAdPrompt';

const VISIBLE_MS = 20_000;     // l'invitation se replie seule
const ARM_DELAY_MS = 700;      // pas d'appui possible dès l'apparition
const MESSAGE_MS = 5_000;

const FAILURE: Record<string, string> = {
  no_fill: 'Aucune publicité disponible pour le moment.',
  skipped: 'Publicité interrompue : regardez-la jusqu’au bout pour gagner 1 point.',
  pending: 'Point en cours de confirmation.',
  error: 'Publicité indisponible. Vérifiez votre connexion.',
  unavailable: 'Publicité indisponible sur cet appareil.',
};

type AccessApi = { getAdOffer?: () => Promise<{ points: number } | null>; invalidate?: () => void } | null;

export default function ZikrAdOffer({ total }: { total: number }) {
  const access = useAccess() as unknown as AccessApi;
  const accessRef = useRef(access);
  accessRef.current = access;

  const [offer, setOffer] = useState<{ points: number; threshold: number } | null>(null);
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const offerRef = useRef(offer);
  offerRef.current = offer;
  const busyRef = useRef(busy);
  busyRef.current = busy;
  const previous = useRef(total);
  const ticket = useRef(0);

  // Franchissement d'une centaine en tapant : on vérifie l'éligibilité, puis on invite.
  useEffect(() => {
    const crossed = crossedAdThreshold(previous.current, total);
    previous.current = total;
    if (!crossed || offerRef.current || busyRef.current) return;
    const current = ++ticket.current;
    const threshold = adThresholdReached(total);
    accessRef.current?.getAdOffer?.()
      .then((result) => { if (current === ticket.current && result) { setOffer({ points: result.points, threshold }); setMessage(''); } })
      .catch(() => { /* éligibilité inconnue : aucune invitation */ });
  }, [total]);

  // Armement différé du bouton + repli automatique de l'invitation.
  useEffect(() => {
    if (!offer) { setArmed(false); return undefined; }
    const arm = setTimeout(() => setArmed(true), ARM_DELAY_MS);
    const hide = setTimeout(() => { if (!busyRef.current) setOffer(null); }, VISIBLE_MS);
    return () => { clearTimeout(arm); clearTimeout(hide); };
  }, [offer]);

  // Le message d'issue (point gagné, échec) disparaît seul.
  useEffect(() => {
    if (!message) return undefined;
    const timer = setTimeout(() => setMessage(''), MESSAGE_MS);
    return () => clearTimeout(timer);
  }, [message]);

  const watch = useCallback(async () => {
    if (busyRef.current || !armed) return;
    setBusy(true); setMessage('');
    try {
      const result = await watchRewardedAd(false);
      if (result.ok) {
        accessRef.current?.invalidate?.();
        setOffer(null);
        setMessage(`+1 point gagné. ${AD_POINTS_PER_ACTION} points ouvrent une action.`);
      } else {
        const reason = 'reason' in result ? result.reason : 'error';
        setMessage(FAILURE[reason] || FAILURE.error);
        if (reason === 'pending') accessRef.current?.invalidate?.();
      }
    } finally {
      setBusy(false);
    }
  }, [armed]);

  if (!offer && !message) return null;
  return (
    <div className="zk-ad-offer" role="status" aria-live="polite">
      {offer && (
        <>
          <p className="zk-ad-offer-text">
            <Clapperboard size={16} strokeWidth={2} aria-hidden="true" />
            <span><strong>{offer.threshold} grains</strong> — regardez une courte vidéo pour gagner 1 point.</span>
          </p>
          <div className="zk-ad-offer-actions">
            <button type="button" className="zk-ad-offer-go" onClick={watch} disabled={busy || !armed}>
              {busy ? 'Chargement…' : 'Regarder'}
            </button>
            <button type="button" className="zk-ad-offer-later" onClick={() => setOffer(null)} disabled={busy}>
              <X size={14} strokeWidth={2.4} aria-hidden="true" /> Plus tard
            </button>
          </div>
        </>
      )}
      {message && <p className="zk-ad-offer-msg">{message}</p>}
    </div>
  );
}
