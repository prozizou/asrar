'use client';
// Zikr collectif : une vidéo récompensée à regarder tous les 100 grains pour continuer.
//
// À chaque centaine récitée (application Android, comptes sans abonnement), le compteur est figé
// et une fenêtre demande de regarder une courte vidéo. La vidéo ne démarre que sur « Regarder »
// (règle AdMob : lancée par l'utilisateur). Le verrou ne se lève QUE par une vidéo regardée
// jusqu'au bout ou par un abonnement (« S'abonner ») : une vidéo absente, une coupure réseau ou
// une erreur le laissent (lib/zikrAdGate.js). « Plus tard » ferme la fenêtre, le compteur reste
// en pause et toucher le chapelet la rouvre. Le verrou survit à un rechargement.
// Les abonnés, le site (iOS) et les restaurations de compteur ne verrouillent rien.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Clapperboard } from 'lucide-react';
import ModalUntyped from '@/components/Modal';
import { useAccess } from '@/components/AccessProvider';
import { watchRewardedAd, cancelRewardedAd } from '@/lib/unityAds';
import AdLoadingStateUntyped from '@/components/AdLoadingState';
import { crossedAdThreshold, adThresholdReached } from '@/lib/zikrAdPrompt';
import { readGate, writeGate, clearGate, resolveAttempt } from '@/lib/zikrAdGate';

const Modal = ModalUntyped as any;
const AdLoadingState = AdLoadingStateUntyped as any;
const ARM_DELAY_MS = 1000; // pas d'appui possible dès l'apparition : le pouce tape encore le chapelet
const NOTICE_MS = 5000;

type AccessApi = {
  getAdOffer?: () => Promise<{ points: number } | null>;
  invalidate?: () => void;
  openGate?: (reason?: string | null) => void;
  adFree?: boolean | null;
} | null;

export function useZikrAdGate({ total, groupId, uid }: { total: number; groupId: string; uid: string }) {
  const access = useAccess() as unknown as AccessApi;
  const accessRef = useRef(access);
  accessRef.current = access;

  const [threshold, setThreshold] = useState(0);   // palier verrouillé (0 = déverrouillé)
  const [open, setOpen] = useState(false);
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<'loading' | 'validating'>('loading');
  const [message, setMessage] = useState('');
  const [notice, setNotice] = useState('');
  const eligible = useRef<boolean | null>(null);   // null : pas encore connu
  const failures = useRef(0);
  const busyRef = useRef(false);
  const previous = useRef(total);
  const locked = threshold > 0;

  const unlock = useCallback(() => {
    clearGate(groupId, uid);
    failures.current = 0;
    setThreshold(0); setOpen(false); setMessage('');
  }, [groupId, uid]);

  // Éligibilité (application Android, sans abonnement, serveur configuré) et reprise d'un verrou.
  useEffect(() => {
    let alive = true;
    const stored = readGate(groupId, uid);
    Promise.resolve(accessRef.current?.getAdOffer?.())
      .then((offer) => {
        if (!alive) return;
        eligible.current = !!offer;
        if (!offer) { if (stored) clearGate(groupId, uid); return; }
        if (stored) { setThreshold(stored); setOpen(true); }
      })
      .catch(() => { if (alive) eligible.current = false; });
    return () => { alive = false; };
  }, [groupId, uid]);

  // Compte devenu abonné (abonnement activé) : le verrou n'a plus lieu d'être.
  const adFree = access?.adFree;
  useEffect(() => {
    if (adFree === true) { eligible.current = false; unlock(); }
  }, [adFree, unlock]);

  // Rouvrir la fenêtre (toucher le chapelet figé) : on revérifie d'abord l'abonnement.
  const reopen = useCallback(() => {
    setOpen(true);
    Promise.resolve(accessRef.current?.getAdOffer?.())
      .then((offer) => { if (!offer) { eligible.current = false; unlock(); } })
      .catch(() => { /* éligibilité inconnue : le verrou reste */ });
  }, [unlock]);

  const subscribe = useCallback(() => {
    setOpen(false);
    accessRef.current?.openGate?.(null);
  }, []);

  // Franchissement d'une centaine en tapant : figer tout de suite, vérifier ensuite.
  useEffect(() => {
    const crossed = crossedAdThreshold(previous.current, total);
    previous.current = total;
    if (!crossed || eligible.current === false) return;
    const reached = adThresholdReached(total);
    writeGate(groupId, uid, reached);
    failures.current = 0;
    setThreshold(reached); setMessage(''); setOpen(true);
    if (eligible.current === null) {
      Promise.resolve(accessRef.current?.getAdOffer?.())
        .then((offer) => { eligible.current = !!offer; if (!offer) unlock(); })
        .catch(() => { eligible.current = false; unlock(); });
    }
  }, [total, groupId, uid, unlock]);

  // Bouton armé après un court délai.
  useEffect(() => {
    if (!open) { setArmed(false); return undefined; }
    const timer = setTimeout(() => setArmed(true), ARM_DELAY_MS);
    return () => clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(''), NOTICE_MS);
    return () => clearTimeout(timer);
  }, [notice]);

  const watch = useCallback(async () => {
    if (busyRef.current || !armed) return;
    busyRef.current = true; setBusy(true); setPhase('loading'); setMessage('');
    try {
      const result = await watchRewardedAd(false, { onPhase: setPhase });
      const outcome = resolveAttempt(result, failures.current);
      failures.current = outcome.failures;
      if (result.ok || ('reason' in result && result.reason === 'pending')) accessRef.current?.invalidate?.();
      if (outcome.unlock) {
        unlock();
        setNotice(result.ok ? '+1 point gagné. Vous pouvez continuer.' : outcome.message);
      } else {
        setMessage(outcome.message);
      }
    } finally {
      busyRef.current = false; setBusy(false);
    }
  }, [armed, unlock]);

  const dialog = (
    <>
      {open && locked && (
        <Modal className="sg-overlay" label="Vidéo pour continuer le comptage" onClose={() => { if (!busyRef.current) setOpen(false); }}>
          <div className="sg-box zk-ad-gate">
            <div className="sg-hero-icon"><Clapperboard size={40} strokeWidth={1.8} aria-hidden="true" /></div>
            <h2>{threshold} grains récités</h2>
            <p className="sg-sub">Pour continuer le comptage, regardez une courte vidéo (1 point offert) ou abonnez-vous pour compter sans publicité.</p>
            {message && !busy && <p className="sg-ad-msg" role="status">{message}</p>}
            {busy ? (
              <AdLoadingState phase={phase} onCancel={() => { void cancelRewardedAd(); }} />
            ) : (
              <>
                <button type="button" className="sg-card best" style={{ width: '100%', marginTop: 8 }} onClick={watch} disabled={!armed}>
                  {failures.current > 0 ? 'Réessayer' : 'Regarder la vidéo'}
                </button>
                <button type="button" className="sg-card" style={{ width: '100%', marginTop: 8 }} onClick={subscribe}>
                  S’abonner
                </button>
                <button type="button" className="zk-ad-gate-later" onClick={() => setOpen(false)}>
                  Plus tard
                </button>
              </>
            )}
            <p className="zk-ad-gate-note">Le compteur reste en pause jusqu’à la vidéo ou l’abonnement.</p>
          </div>
        </Modal>
      )}
      {notice && !open && <p className="zk-ad-gate-notice" role="status">{notice}</p>}
    </>
  );

  return { locked, reopen, dialog };
}
