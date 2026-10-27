'use client';
// Contexte d'accès (paywall) — remplace le cache global _accessStatus + les
// fonctions ensureAccess()/getSubscriptionLevel() éparpillées. Le portail
// d'abonnement est rendu ici et piloté par un simple état React.
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { checkAccess, levelFromStatus } from '@/lib/access';
import { consumeAdCredit, isUnityAdsAvailable } from '@/lib/unityAds';
import { useAuth } from './AuthProvider';
import SubscriptionGate from './SubscriptionGate';
import SubscriptionExpiryBanner from './SubscriptionExpiryBanner';

const AccessCtx = createContext(null);
export const useAccess = () => useContext(AccessCtx);

export default function AccessProvider({ children }) {
  const { user } = useAuth();
  const cacheAt = useRef(0);
  const cache = useRef(null); // équivalent de _accessStatus (cache borné à 60 s)
  const [gateOpen, setGateOpen] = useState(false);
  const [gateReason, setGateReason] = useState(null); // null | 'level' (palier insuffisant)
  // Publicité récompensée proposée dans le portail (APK, sans abonnement,
  // module hors forfait 1 An) — voir lib/unityAds.js.
  const [gateAdEligible, setGateAdEligible] = useState(false);
  const [allowed, setAllowed] = useState(null); // null = inconnu, true/false = résolu
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
      return false;
    }
    const cached = Date.now() - cacheAt.current < 60000 ? cache.current : null;
    const status = cached || (await checkAccess(user));
    // Ne met en cache QUE le résultat d'une lecture réussie — cf. ensureAccess.
    if (!status.unavailable) {
      cache.current = status;
      if (!cached) cacheAt.current = Date.now();
    }
    setAllowed(status.allowed);
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
    if (user) refreshAccess().catch(() => {});
  }, [user, refreshAccess]);

  // Vérifie l'accès à la demande. Résout true si autorisé (et si `minLevel`
  // est fourni, si le palier de l'utilisateur l'atteint — ex. PREMIUM_LEVEL
  // pour Al Qalam / Géomancie, réservés au forfait 1 An). Sinon ouvre le
  // portail (avec un motif adapté) et résout à sa fermeture : false, ou true
  // si une publicité récompensée (APK, sans palier requis) a débloqué cette
  // utilisation — un crédit déjà gagné est utilisé directement, sans portail.
  // Le cache expire après 60 s. Une panne réseau/serveur n'est jamais mise
  // en cache comme un refus d'abonnement ; l'utilisateur peut réessayer.
  const ensureAccess = useCallback(
    async (minLevel = 0) => {
      if (!user) return false;
      let status = Date.now() - cacheAt.current < 60000 ? cache.current : null;
      if (!status) {
        status = await checkAccess(user);
        if (!status.unavailable) { cache.current = status; cacheAt.current = Date.now(); }
      }
      if (status.allowed && (!minLevel || (status.level || 0) >= minLevel)) return true;
      if (status.unavailable) {
        openGate('network');
        return false;
      }
      // Publicité : jamais pour un palier (forfait 1 An), ni pour un abonné.
      const adEligible = !minLevel && !status.allowed && status.adsEnabled && (await isUnityAdsAvailable());
      if (adEligible && status.adCredits > 0 && (await spendAdCredit())) return true;
      const result = new Promise((resolve) => {
        openGate(status.allowed && minLevel ? 'level' : null, { adEligible });
        pendingGate.current = resolve;
      });
      return result;
    },
    [user, openGate, spendAdCredit]
  );

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
    <AccessCtx.Provider value={{ ensureAccess, getLevel, openGate, closeGate, invalidate, allowed, refreshAccess }}>
      {/* Avant {children} : en flux normal (voir .expiry-banner), doit apparaître
          au-dessus de tout, pas se glisser derrière le contenu de la page. */}
      <SubscriptionExpiryBanner expiresAt={expiresAt} />
      {children}
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
