const crypto = require("crypto");
const { emailKey, httpError } = require("./access");

const POINTS_FOR_REWARD = 1000;
const REWARD_DAYS = 90;
const REWARD_LEVEL = 15000;

// Réservation des points → octroi dédupliqué → historique déterministe →
// clôture. Une panne laisse une opération reprenable, jamais un accès offert
// et des points remboursés en parallèle.
async function redeemReferral(db, user, requestId = crypto.randomUUID()) {
  const accountRef = db.ref(`referrals/${user.uid}`);
  const reservation = await accountRef.transaction((account) => {
    if (!account || account.redemptions?.[requestId] || account.pendingRedemption) return account;
    if ((Number(account.points) || 0) < POINTS_FOR_REWARD) return account;
    return {
      ...account, points: account.points - POINTS_FOR_REWARD,
      pendingRedemption: { id: requestId, at: Date.now() },
    };
  });
  const account = reservation.snapshot.val();
  if (account?.redemptions?.[requestId]) return account.redemptions[requestId];
  const operation = account?.pendingRedemption;
  if (!operation) throw httpError(400, `Points insuffisants (${POINTS_FOR_REWARD} requis).`);

  const purchaseRef = db.ref(`purchased_user/${emailKey(user.email)}`);
  const grant = await purchaseRef.transaction((value) => {
    const purchase = value || {};
    if (purchase.referralRedemptions?.[operation.id] || purchase.expiresAt === "lifetime") return purchase;
    const now = Date.now();
    const base = Math.max(now,
      typeof purchase.expiresAt === "number" ? purchase.expiresAt : 0,
      Number(purchase.referralAccess?.expiresAt) || 0);
    const expiresAt = base + REWARD_DAYS * 86400000;
    return {
      ...purchase,
      referralAccess: {
        token: "REF-" + operation.id, plan: "sub_3m", level: REWARD_LEVEL,
        source: "referral", uid: user.uid, at: now, expiresAt,
      },
      referralRedemptions: { ...(purchase.referralRedemptions || {}), [operation.id]: { expiresAt } },
    };
  });
  const receipt = grant.snapshot.val()?.referralRedemptions?.[operation.id];
  if (!receipt) {
    // Aucun octroi pour cette opération (accès à vie préexistant).
    await accountRef.transaction((current) => {
      if (current?.pendingRedemption?.id !== operation.id) return current;
      const { pendingRedemption, ...rest } = current;
      return { ...rest, points: (Number(current.points) || 0) + POINTS_FOR_REWARD };
    });
    throw httpError(400, "Vous disposez déjà d'un accès à vie.");
  }

  const result = { expiresAt: receipt.expiresAt, days: REWARD_DAYS };
  await db.ref(`purchases/${user.uid}/REF-${operation.id}`).set({
    plan: "sub_3m", source: "referral", points: POINTS_FOR_REWARD,
    at: operation.at, expiresAt: receipt.expiresAt,
  });
  await accountRef.transaction((current) => {
    if (current?.pendingRedemption?.id !== operation.id) {
      // Deux appareils peuvent avoir rejoint la même opération en cours
      // avec des identifiants de requête distincts. Mémoriser aussi l'alias
      // pour qu'une réponse perdue ne provoque pas un deuxième débit.
      if (current?.redemptions?.[operation.id] && !current.redemptions[requestId]) {
        return { ...current, redemptions: { ...current.redemptions, [requestId]: result } };
      }
      return current;
    }
    const { pendingRedemption, ...rest } = current;
    return {
      ...rest, rewards: (Number(current.rewards) || 0) + 1,
      redemptions: { ...(current.redemptions || {}), [operation.id]: result, [requestId]: result },
    };
  });
  return result;
}

module.exports = { redeemReferral, POINTS_FOR_REWARD, REWARD_DAYS, REWARD_LEVEL };
