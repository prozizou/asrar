'use client';
// Contexte d'accès (paywall) — remplace le cache global _accessStatus + les
// fonctions ensureAccess()/getSubscriptionLevel() éparpillées. Le portail
// d'abonnement est rendu ici et piloté par un simple état React.
import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { checkAccess, levelFromStatus } from '@/lib/access';
import { useAuth } from './AuthProvider';
import SubscriptionGate from './SubscriptionGate';

const AccessCtx = createContext(null);
export const useAccess = () => useContext(AccessCtx);

export default function AccessProvider({ children }) {
  const { user } = useAuth();
  const cache = useRef(null); // équivalent de _accessStatus (cache par session)
  const [gateOpen, setGateOpen] = useState(false);
  const [gateReason, setGateReason] = useState(null); // null | 'level' (palier insuffisant)
  const [allowed, setAllowed] = useState(null); // null = inconnu, true/false = résolu

  const openGate = useCallback((reason) => {
    setGateReason(reason || null);
    setGateOpen(true);
  }, []);
  const closeGate = useCallback(() => setGateOpen(false), []);

  // Résout l'accès SANS ouvrir le portail (verrouillage passif : cartes « nom
  // seul » tant que l'abonnement n'est pas confirmé). Met à jour `allowed`.
  const refreshAccess = useCallback(async () => {
    if (!user) {
      setAllowed(false);
      return false;
    }
    const status = cache.current || (await checkAccess(user));
    cache.current = status;
    setAllowed(status.allowed);
    return status.allowed;
  }, [user]);

  // Vérifie l'accès à la demande. Résout true si autorisé (et si `minLevel`
  // est fourni, si le palier de l'utilisateur l'atteint — ex. PREMIUM_LEVEL
  // pour Al Qalam / Géomancie, réservés au forfait 1 An). Sinon ouvre le
  // portail (avec un motif adapté) et résout false. Résultat mis en cache
  // pour la session.
  const ensureAccess = useCallback(
    async (minLevel = 0) => {
      if (!user) return false;
      let status = cache.current;
      if (!status) {
        status = await checkAccess(user);
        cache.current = status;
      }
      if (status.allowed && (!minLevel || (status.level || 0) >= minLevel)) return true;
      openGate(status.allowed && minLevel ? 'level' : null);
      return false;
    },
    [user, openGate]
  );

  const getLevel = useCallback(() => levelFromStatus(cache.current), []);
  const invalidate = useCallback(() => {
    cache.current = null;
  }, []);

  return (
    <AccessCtx.Provider value={{ ensureAccess, getLevel, openGate, closeGate, invalidate, allowed, refreshAccess }}>
      {children}
      <SubscriptionGate open={gateOpen} reason={gateReason} onClose={closeGate} />
    </AccessCtx.Provider>
  );
}
