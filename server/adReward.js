// server/adReward.js — Publicités récompensées Unity Ads : alternative à
// l'abonnement, « une publicité regardée = une utilisation » d'un module
// réservé aux abonnés (jamais les modules du forfait 1 An — cf. PREMIUM_LEVEL).
// Logique pure et constantes : lib/adReward.js.
//
// Nœuds écrits (Admin SDK uniquement — les règles RTDB refusent tout accès
// client par défaut, cf. rules/database.rules.json) :
//   adRewards/{uid}/{nonce} = { createdAt, rewarded?, rewardedAt?, oid?, used?, usedAt? }
//   adOffers/{sha1(oid)}    = { uid, nonce, at }   (dédoublonnage des rappels Unity)
//   adPass/{uid}            = { until, uses }      (passe à usage unique, get-content)
//
// Parcours : start (session + serverId) → l'app affiche la publicité → Unity
// appelle /api/unity-ads-callback (signé) → rewardFromCallback() crédite →
// l'app consomme le crédit (consumeAdCredit) au moment d'ouvrir le module.

const { app } = require("./grant");
const {
  newNonce, buildServerId, parseServerId, verifyUnityCallback, offerKey,
  countCredits, pickCredit, canReward, staleNonces,
  isPassUsable, MAX_UNUSED_CREDITS, PASS_TTL_MS,
} = require("../lib/adReward");

// Secret des rappels server-to-server, fourni par Unity (variable Vercel).
// Absent : les publicités restent désactivées (l'app n'affiche pas l'option).
const secret = () => process.env.UNITY_ADS_S2S_SECRET || "";
const adsEnabled = () => !!secret();

const rewardsRef = (uid) => app().database().ref("adRewards/" + uid);

// Transaction RTDB : la fonction est d'abord appelée avec la valeur en cache,
// souvent null — y renvoyer undefined abandonnerait sans jamais lire le
// serveur. On renvoie null pour forcer la relecture, puis on vérifie que
// l'écriture a bien eu lieu via un marqueur horodaté (`stamp`), un « commit »
// de null n'étant pas un succès.
async function txOnExisting(ref, update, stamp) {
  const res = await ref.transaction((cur) => (cur === null ? null : update(cur)));
  const v = res.committed && res.snapshot.val();
  return !!v && v[stamp.key] === stamp.value;
}

async function readRewards(uid) {
  return (await rewardsRef(uid).once("value")).val() || {};
}

async function startAdSession(uid) {
  const now = Date.now();
  const rewards = await readRewards(uid);
  const updates = {};
  for (const nonce of staleNonces(rewards, now)) updates[nonce] = null;
  const nonce = newNonce();
  updates[nonce] = { createdAt: now };
  await rewardsRef(uid).update(updates);
  return { nonce, serverId: buildServerId(uid, nonce) };
}

/**
 * Traite un rappel Unity. Renvoie { ok:false } si la signature est invalide
 * (à refuser), sinon { ok:true, credited } — `credited` false pour un rappel
 * déjà traité, une session inconnue/expirée ou un plafond atteint : Unity doit
 * quand même recevoir « 1 » pour cesser de réessayer.
 */
async function rewardFromCallback(params) {
  if (!verifyUnityCallback(params, secret())) return { ok: false };
  const parsed = parseServerId(params.sid);
  if (!parsed || !params.oid) return { ok: true, credited: false, reason: "params" };
  const { uid, nonce } = parsed;
  const db = app().database();
  const now = Date.now();

  const offer = await db.ref("adOffers/" + offerKey(params.oid)).transaction((cur) =>
    cur ? undefined : { uid, nonce, at: now }
  );
  if (!offer.committed) return { ok: true, credited: false, reason: "duplicate" };

  if (countCredits(await readRewards(uid), now) >= MAX_UNUSED_CREDITS) {
    return { ok: true, credited: false, reason: "cap" };
  }
  const credited = await txOnExisting(
    rewardsRef(uid).child(nonce),
    (s) => (canReward(s, now) ? { ...s, rewarded: true, rewardedAt: now, oid: String(params.oid) } : undefined),
    { key: "rewardedAt", value: now }
  );
  return { ok: true, credited, reason: credited ? undefined : "session" };
}

async function getAdSessionStatus(uid, nonce) {
  const s = (await rewardsRef(uid).child(nonce).once("value")).val();
  return { rewarded: !!(s && s.rewarded) };
}

async function countAdCredits(uid) {
  return countCredits(await readRewards(uid));
}

// Consomme un crédit et ouvre le passe à usage unique (get-content).
async function consumeAdCredit(uid) {
  const now = Date.now();
  const nonce = pickCredit(await readRewards(uid), now);
  if (!nonce) return false;
  const used = await txOnExisting(
    rewardsRef(uid).child(nonce),
    (s) => (s.rewarded && !s.used ? { ...s, used: true, usedAt: now } : undefined),
    { key: "usedAt", value: now }
  );
  if (!used) return false;
  await app().database().ref("adPass/" + uid).set({ until: now + PASS_TTL_MS, uses: 1 });
  return true;
}

// Utilise le passe (une seule fois) : appelé par get-content sans abonnement.
async function consumeAdPass(uid) {
  const now = Date.now();
  return txOnExisting(
    app().database().ref("adPass/" + uid),
    (p) => (isPassUsable(p, now) ? { ...p, uses: p.uses - 1, usedAt: now } : undefined),
    { key: "usedAt", value: now }
  );
}

module.exports = {
  adsEnabled,
  startAdSession,
  rewardFromCallback,
  getAdSessionStatus,
  countAdCredits,
  consumeAdCredit,
  consumeAdPass,
};
