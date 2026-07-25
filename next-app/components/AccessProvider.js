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

  const openGate = useCallback(() => setGateOpen(true), []);
  const closeGate = useCallback(() => setGateOpen(false), []);

  // Vérifie l'accès à la demande. Résout true si autorisé, sinon ouvre le
  // portail et résout false. Le résultat est mis en cache pour la session.
  const ensureAccess = useCallback(
    async () => {
      if (!user) return false;
      let status = cache.current;
      if (!status) {
        status = await checkAccess(user);
        cache.current = status;
      }
      if (status.allowed) return true;
      openGate();
      return false;
    },
    [user, openGate]
  );

  const getLevel = useCallback(() => levelFromStatus(cache.current), []);
  const invalidate = useCallback(() => {
    cache.current = null;
  }, []);

  return (
    <AccessCtx.Provider value={{ ensureAccess, getLevel, openGate, closeGate, invalidate }}>
      {children}
      <SubscriptionGate open={gateOpen} onClose={closeGate} />
    </AccessCtx.Provider>
  );
}
