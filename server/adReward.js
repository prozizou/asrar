// Les rappels signés alimentent les points. Le débit et le passe à usage unique
// sont écrits ensemble sous adRewards/{uid}, avec repli sur les anciens adPass.
// adOffers déduplique chaque transaction de régie entre comptes et sessions.

const { app } = require("./grant");
const { AD_POINTS_PER_ACTION } = require("../lib/adPoints");
const { ADS_PAUSED } = require("../lib/plans");
const {
  newNonce, buildServerId, parseServerId, verifyUnityCallback, offerKey,
  countCredits, pickCredits, canReward, staleNonces,
  isPassUsable, MAX_UNUSED_CREDITS, PASS_TTL_MS,
} = require("../lib/adReward");

// Secret des rappels server-to-server, fourni par Unity (variable Vercel).
// Absent : les publicités restent désactivées (l'app n'affiche pas l'option).
const secret = () => process.env.UNITY_ADS_S2S_SECRET || "";
const PASS_KEY = "_pass";
const adsEnabled = () => true; // Google SSV is verified with public keys; Unity remains paused.
const usableRewards = rewards => ADS_PAUSED ? Object.fromEntries(Object.entries(rewards).filter(([, r]) => r && r.provider === "admob")) : rewards;

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

async function startAdSession(uid, provider = "unity", interstitial = false) {
  const now = Date.now();
  const nonce = newNonce();
  await rewardsRef(uid).transaction((current) => {
    const rewards = { ...current };
    for (const expired of staleNonces(rewards, now)) {
      if (expired !== PASS_KEY && expired !== "lastDebit") delete rewards[expired];
    }
    rewards[nonce] = { createdAt: now, provider, ...(interstitial ? { interstitial: true } : {}) };
    return rewards;
  });
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
  return countCredits(usableRewards(await readRewards(uid)));
}

// Les points et le passe sont écrits ensemble pour éviter un débit partiel.
async function consumeAdCredit(uid, contentPath = null) {
  const now = Date.now();
  const operation = newNonce();
  return txOnExisting(rewardsRef(uid), (rewards) => {
    const nonces = pickCredits(usableRewards(rewards), AD_POINTS_PER_ACTION, now);
    if (nonces.length !== AD_POINTS_PER_ACTION) return undefined;
    const updated = { ...rewards };
    for (const nonce of nonces) updated[nonce] = { ...rewards[nonce], used: true, usedAt: now };
    if (contentPath) {
      const passes = Object.fromEntries(Object.entries(rewards[PASS_KEY] || {}).filter(([, pass]) => isPassUsable(pass, now)));
      const key = offerKey(contentPath);
      const provider = rewards[nonces[0]].provider || "unity";
      const uses = passes[key]?.provider === provider ? passes[key].uses : 0;
      passes[key] = { until: now + PASS_TTL_MS, uses: uses + 1, provider };
      updated[PASS_KEY] = passes;
    }
    updated.lastDebit = operation;
    return updated;
  }, { key: "lastDebit", value: operation });
}

async function consumeAdPass(uid, contentPath) {
  const now = Date.now();
  const use = newNonce();
  const consume = (pass) => (
    isPassUsable(pass, now) && (!ADS_PAUSED || pass.provider === "admob")
      ? { ...pass, uses: pass.uses - 1, usedAt: now, use }
      : undefined
  );
  const stamp = { key: "use", value: use };
  if (contentPath && await txOnExisting(rewardsRef(uid).child(PASS_KEY).child(offerKey(contentPath)), consume, stamp)) return true;
  // Compatibilité avec les passes émis avant le passage au débit atomique.
  return txOnExisting(app().database().ref("adPass/" + uid), consume, stamp);
}

// Called only after cryptographic Google SSV verification, never by the client.
async function rewardFromAdMob(params) {
  const parsed = parseServerId(params.sid);
  if (!parsed) return false;
  const { uid, nonce } = parsed;
  const now = Date.now(), db = app().database();
  const session = (await rewardsRef(uid).child(nonce).once("value")).val();
  if (!session || session.provider !== "admob" || !!session.interstitial !== !!params.interstitial || !canReward(session, now)) return false;
  const offer = await db.ref("adOffers/" + offerKey(params.oid)).transaction(cur => {
    if (!cur) return { uid, nonce, at: now };
    // Retry after a transient write failure may finish this SAME session only.
    return cur.uid === uid && cur.nonce === nonce ? cur : undefined;
  });
  if (!offer.committed) return false;
  return txOnExisting(rewardsRef(uid).child(nonce), s => s.provider === "admob" && !!s.interstitial === !!params.interstitial && canReward(s, now) ? { ...s, rewarded: true, rewardedAt: now, oid: params.oid } : undefined, { key: "rewardedAt", value: now });
}
module.exports = {
  rewardFromAdMob,
  adsEnabled,
  startAdSession,
  rewardFromCallback,
  getAdSessionStatus,
  countAdCredits,
  consumeAdCredit,
  consumeAdPass,
};
