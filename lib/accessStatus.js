import { parseAllowed } from './plans';

// Les récompenses au palier de base ont leur propre échéance. Elles ne
// prolongent ni ne réactivent le palier premium d'un achat historique.
export function purchaseRights(purchase, now = Date.now()) {
  return [purchase, purchase?.referralAccess].filter((p) => p && p.token &&
    (p.expiresAt == null || p.expiresAt === 'lifetime' ||
      (typeof p.expiresAt === 'number' && Number.isFinite(p.expiresAt) && p.expiresAt > now)));
}

export function effectiveAccess(purchase, allowedValue, now = Date.now()) {
  const rights = purchaseRights(purchase, now).map((p) => ({
    level: Number(p.level) || 0,
    until: typeof p.expiresAt === 'number' ? p.expiresAt : null,
  }));
  const manual = parseAllowed(allowedValue, now);
  if (manual.active) {
    const until = typeof allowedValue === 'object' ? allowedValue.until : allowedValue;
    rights.push({ level: manual.level, until: typeof until === 'number' ? until : null });
  }
  return {
    allowed: rights.length > 0,
    level: Math.max(0, ...rights.map((r) => r.level)),
    expiresAt: !rights.length || rights.some((r) => r.until === null)
      ? null : Math.max(...rights.map((r) => r.until)),
  };
}
