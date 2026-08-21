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
    // Ne met en cache QUE le résultat d'une lecture réussie — cf. ensureAccess.
    if (!status.networkTimeout) cache.current = status;
    setAllowed(status.allowed);
    return status.allowed;
  }, [user]);

  // Vérifie l'accès à la demande. Résout true si autorisé (et si `minLevel`
  // est fourni, si le palier de l'utilisateur l'atteint — ex. PREMIUM_LEVEL
  // pour Al Qalam / Géomancie, réservés au forfait 1 An). Sinon ouvre le
  // portail (avec un motif adapté) et résout false. Résultat mis en cache
  // pour la session — SAUF un timeout réseau (cf. lib/access.js) : sans
  // cette exception, un premier clic malchanceux sur une connexion lente
  // figeait « pas d'accès » pour TOUTE la session (le cache ne se
  // réinitialise qu'à un rechargement complet de la page), même une fois la
  // connexion redevenue bonne — symptôme observé : « ça marche puis plus
  // rien, il faut vider le cache pour que ça remarche ».
  const ensureAccess = useCallback(
    async (minLevel = 0) => {
      if (!user) return false;
      let status = cache.current;
      if (!status) {
        status = await checkAccess(user);
        if (!status.networkTimeout) cache.current = status;
      }
      if (status.allowed && (!minLevel || (status.level || 0) >= minLevel)) return true;
      if (status.networkTimeout) {
        openGate('network');
        return false;
      }
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
