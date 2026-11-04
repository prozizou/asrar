'use client';
// Contexte d'accès (paywall) — remplace le cache global _accessStatus + les
// fonctions ensureAccess()/getSubscriptionLevel() éparpillées. Le portail
// d'abonnement est rendu ici et piloté par un simple état React.
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { checkAccess, levelFromStatus, isAccessCacheValid } from '@/lib/access';
import { consumeAdCredit, isUnityAdsAvailable, showNativeActionAd } from '@/lib/unityAds';
import { useAuth } from './AuthProvider';
import SubscriptionGate from './SubscriptionGate';
import SubscriptionExpiryBanner from './SubscriptionExpiryBanner';
import { openActionAd, recordAdOutcome } from '@/lib/actionAd';
import { apiPost } from '@/lib/api';
import Modal from './Modal';
import AdCountdown from './AdCountdown';

const AccessCtx = createContext(null);
export const useAccess = () => useContext(AccessCtx);

export default function AccessProvider({ children }) {
  const { user, loading: authLoading } = useAuth();
  const cacheAt = useRef(0);
  const cache = useRef(null); // équivalent de _accessStatus (cache borné à 60 s)
  const [gateOpen, setGateOpen] = useState(false);
  // Pub au clic bloquée par le navigateur (lib/actionAd.ts) : l'action est
  // refusée et cette fenêtre explique comment autoriser les pop-ups.
  const [adBlocked, setAdBlocked] = useState(false);
  // Une tentative publicitaire ne donne pas d’accès : le bloc chargé doit
  // rester visible avant que l’action en cours puisse continuer.
  const pendingAdAt = useRef(0);
  const actionBusy = useRef(false), adResolve = useRef(null), userRef = useRef(user);
  const sessionVersion = useRef(0);
  userRef.current = user;
  const [countdown, setCountdown] = useState(null); // { start, resolve } | null
  const [gateReason, setGateReason] = useState(null); // null | 'level' (palier insuffisant)
  // Publicité récompensée proposée dans le portail (APK, sans abonnement,
  // module hors forfait 1 An) — voir lib/unityAds.js.
  const [gateAdEligible, setGateAdEligible] = useState(false);
  const [allowed, setAllowed] = useState(null); // null = inconnu, true/false = résolu
  // Abonnement valide → pas de publicité (components/AdsterraAds.js). Distinct
  // de `allowed` quand l'app est gratuite pour tous (lib/plans.js FREE_FOR_ALL).
  // null = inconnu (aucune pub tant que ce n'est pas résolu).
  const [adFree, setAdFree] = useState(null);
  const [expiresAt, setExpiresAt] = useState(null); // pour SubscriptionExpiryBanner
  // ensureAccess() en attente de la fermeture du portail : résolu true si une
  // publicité a débloqué l'utilisation, false si le portail est fermé.
  const pendingGate = useRef(null);

  const settleGate = useCallback((result) => {
    const resolve = pendingGate.current;
    pendingGate.current = null;
    if (resolve) resolve(result);
  }, []);

  const openGate = useCallback((reason, { adEligible = false } = {}) => {
    settleGate(false);
    setGateReason(reason || null);
    setGateAdEligible(adEligible);
    setGateOpen(true);
  }, [settleGate]);
  const closeGate = useCallback(() => {
    setGateOpen(false);
    settleGate(false);
  }, [settleGate]);

  // Utilise un crédit publicitaire (gagné à l'instant ou plus tôt) et met à
  // jour le cache : l'utilisation est accordée si le serveur l'a consommé.
  const spendAdCredit = useCallback(async () => {
    const ok = await consumeAdCredit();
    if (cache.current) cache.current = { ...cache.current, adCredits: Math.max(0, (cache.current.adCredits || 0) - (ok ? 1 : 0)) };
    return ok;
  }, []);

  // Portail : publicité regardée et validée par Unity → l'action demandée
  // s'exécute (une utilisation). Sans ensureAccess() en attente (portail
  // ouvert directement par openGate), le crédit reste pour la prochaine.
  const onAdRewarded = useCallback(async () => {
    if (!pendingGate.current) {
      cache.current = null;
      setGateOpen(false);
      return true;
    }
    const ok = await spendAdCredit();
    if (ok) {
      setGateOpen(false);
      settleGate(true);
    }
    return ok;
  }, [spendAdCredit, settleGate]);

  // Publicité regardée mais rappel Unity pas encore reçu : le crédit arrivera
  // côté serveur — relire l'accès à la prochaine demande.
  const onAdPending = useCallback(() => {
    cache.current = null;
  }, []);

  // Résout l'accès SANS ouvrir le portail (verrouillage passif : cartes « nom
  // seul » tant que l'abonnement n'est pas confirmé). Met à jour `allowed`.
  const refreshAccess = useCallback(async () => {
    if (!user) {
      setAllowed(false);
      setAdFree(false);
      return false;
    }
    const cached = isAccessCacheValid(cache.current, cacheAt.current) ? cache.current : null;
    const status = cached || (await checkAccess(user));
    // Ne met en cache QUE le résultat d'une lecture réussie — cf. ensureAccess.
    if (!status.unavailable) {
      cache.current = status;
      if (!cached) cacheAt.current = Date.now();
    }
    setAllowed(status.allowed);
    if (!status.unavailable) setAdFree(!!status.adFree);
    setExpiresAt(status.expiresAt ?? null);
    return status.allowed;
  }, [user]);

  // Rappel d'expiration (SubscriptionExpiryBanner) : contrairement à
  // ensureAccess/refreshAccess (appelés à la demande par chaque module), il
  // doit s'afficher partout — un seul contrôle par connexion, ici, garantit
  // qu'il ne dépend pas de la page ouverte en premier.
  useEffect(() => {
    cache.current = null;
    cacheAt.current = 0;
    setAllowed(null);
    // Visiteur non connecté (session Firebase résolue) : jamais abonné, donc
    // publicités. Pendant le chargement de la session : inconnu.
    setAdFree(user || authLoading ? null : false);
    if (user) refreshAccess().catch(() => {});
  }, [user, authLoading, refreshAccess]);

  // Vérifie l'accès à la demande. Résout true si autorisé (et si `minLevel`
  // est fourni, si le palier de l'utilisateur l'atteint — ex. PREMIUM_LEVEL
  // pour Al Qalam / Géomancie, réservés au forfait 1 An). Sinon ouvre le
  // portail (avec un motif adapté) et résout à sa fermeture : false, ou true
  // si une publicité récompensée (APK, sans palier requis) a débloqué cette
  // utilisation — un crédit déjà gagné est utilisé directement, sans portail.
  // Le cache expire après 60 s. Une panne réseau/serveur n'est jamais mise
  // en cache comme un refus d'abonnement ; l'utilisateur peut réessayer.
  // Réserver l’onglet pendant le clic, puis valider séparément l’affichage
  // dans la page. Un échec d’ouverture n’est jamais une autorisation.
  const requireActionAd = useCallback(() => {
    if (adFree === true) return true;
    if (adFree === null) { setAdBlocked({ reason: 'checking' }); refreshAccess().catch(() => {}); return false; }
    const result = openActionAd();
    // A blocked popup may fall back to the mandatory on-page ad. Neither
    // result grants access: AdCountdown still requires a visible creative.
    if (result !== 'native') pendingAdAt.current = Date.now();
    return true;
  }, [adFree, refreshAccess]);

  const waitForAd = useCallback(() => {
    const start = pendingAdAt.current;
    pendingAdAt.current = 0;
    if (!start) { setAdBlocked({ reason: 'unavailable' }); return Promise.resolve(false); }
    return new Promise((resolve) => { adResolve.current = resolve; setCountdown({ start, resolve }); });
  }, []);

  const ensureAccess = useCallback(async (minLevel = 0) => {
    if (actionBusy.current || !user) return false;
    actionBusy.current = true;
    const session = sessionVersion.current;
    try {
      if (!requireActionAd()) return false;
      let status = isAccessCacheValid(cache.current, cacheAt.current) ? cache.current : null;
      if (!status) {
        status = await checkAccess(user);
        if (sessionVersion.current !== session || userRef.current?.uid !== user.uid) return false;
        if (!status.unavailable) { cache.current = status; cacheAt.current = Date.now(); setAdFree(!!status.adFree); }
      }
      if (status.unavailable) { pendingAdAt.current = 0; openGate('network'); return false; }
      if (!status.adFree) {
        const native = window.Capacitor?.isNativePlatform?.();
        if (native) {
          const shown = await showNativeActionAd();
          if (sessionVersion.current !== session || userRef.current?.uid !== user.uid) return false;
          if (!shown.ok) { setAdBlocked(shown); return false; }
        } else {
          if (!pendingAdAt.current) pendingAdAt.current = Date.now();
          if (!(await waitForAd())) return false;
        }
      } else { pendingAdAt.current = 0; }
      if (sessionVersion.current !== session || userRef.current?.uid !== user.uid) return false;
      if (status.allowed && (!minLevel || (status.level || 0) >= minLevel)) return true;
      const adEligible = !minLevel && !status.allowed && status.adsEnabled && (await isUnityAdsAvailable());
      if (adEligible && status.adCredits > 0 && (await spendAdCredit())) return true;
      return await new Promise((resolve) => {
        openGate(status.allowed && minLevel ? 'level' : null, { adEligible });
        pendingGate.current = resolve;
      });
    } catch {
      setAdBlocked({ reason: 'unavailable' });
      return false;
    } finally { actionBusy.current = false; }
  }, [user, requireActionAd, waitForAd, openGate, spendAdCredit]);

  useEffect(() => {
    setCountdown(null); setAdBlocked(false); pendingAdAt.current = 0;
    return () => {
      sessionVersion.current += 1;
      adResolve.current?.(false); adResolve.current = null;
      pendingGate.current?.(false); pendingGate.current = null;
    };
  }, [user?.uid]);

  const getLevel = useCallback(() => levelFromStatus(cache.current), []);
  // Vide le cache ET redéclenche tout de suite le contrôle (ex. après un
  // parrainage redeem qui prolonge l'abonnement) — sans ça, la bannière
  // d'expiration restait sur l'ancienne date jusqu'au prochain rechargement
  // de page, malgré un abonnement déjà prolongé côté serveur.
  const invalidate = useCallback(() => {
    cache.current = null;
    refreshAccess().catch(() => {});
  }, [refreshAccess]);

  return (
    <AccessCtx.Provider value={{ ensureAccess, requireActionAd, getLevel, openGate, closeGate, invalidate, allowed, adFree, refreshAccess }}>
      {/* Avant {children} : en flux normal (voir .expiry-banner), doit apparaître
          au-dessus de tout, pas se glisser derrière le contenu de la page. */}
      <SubscriptionExpiryBanner expiresAt={expiresAt} />
      {children}
      {countdown && (
        <AdCountdown
          onDone={(completed) => {
            const { resolve } = countdown;
            // Envoi groupé et rare des compteurs (respecte le réglage « statistiques »
            // du compte : le serveur les ignore sinon).
            recordAdOutcome((adStats) => apiPost('track', { type: 'ad_stats', adStats }).catch(() => {}));
            setCountdown(null); adResolve.current = null;
            resolve(completed === true);
          }}
          onRemoveAds={() => { countdown.resolve(false); adResolve.current = null; setCountdown(null); openGate('noads'); }}
        />
      )}
      {adBlocked && (
        <Modal className="sg-overlay" onClose={() => setAdBlocked(false)} label="Publicité nécessaire">
          <div className="sg-box">
            <button type="button" aria-label="Fermer la fenêtre" className="sg-close" onClick={() => setAdBlocked(false)}>
              ✕
            </button>
            <div style={{ fontSize: '2.4rem' }}>📢</div>
            <h2>Une publicité est nécessaire</h2>
            <p className="sg-sub">
              {adBlocked.reason === 'blocked'
                ? 'La publicité n’a pas pu être ouverte. Autorisez les fenêtres pop-up, puis réessayez l’action.'
                : adBlocked.reason === 'checking'
                ? 'Vérification de votre abonnement en cours. Patientez puis réessayez l’action.'
                : adBlocked.reason === 'update_required'
                ? 'Mettez à jour l’application pour valider l’affichage des publicités, ou choisissez un abonnement sans publicités.'
                : adBlocked.retryAfterMs
                ? `La prochaine publicité sera disponible dans environ ${Math.ceil(adBlocked.retryAfterMs / 1000)} secondes. Patientez puis réessayez l’action, ou choisissez un abonnement sans publicités.`
                : 'Aucune publicité n’a été validée pour cette action. Patientez puis réessayez, ou choisissez un abonnement sans publicités.'}
            </p>
            <button type="button" className="sg-card best" style={{ width: '100%', marginTop: 8 }} onClick={() => setAdBlocked(false)}>
              Fermer et réessayer plus tard
            </button>
            <button
              type="button"
              className="sg-card"
              style={{ width: '100%', marginTop: 8 }}
              onClick={() => { setAdBlocked(false); openGate('noads'); }}
            >
              🚫 Retirer les publicités
            </button>
          </div>
        </Modal>
      )}
      <SubscriptionGate
        open={gateOpen}
        reason={gateReason}
        adEligible={gateAdEligible}
        onAdRewarded={onAdRewarded}
        onAdPending={onAdPending}
        onClose={closeGate}
      />
    </AccessCtx.Provider>
  );
}
