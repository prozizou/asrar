// server/asrarChat/profiles.js — Profils, vitrine vendeur, blocages.
const { P, fail, key, read, audit, getProfile, publicProfile, assertNotSuspended } = require("./core");
const { publicUrl } = require("./media");
const {
  normalizeProfileInput, normalizeSellerInput, normalizeHandle, normalizeAsset, SELLER_ERRORS,
} = require("../../lib/asrarChat/logic");

const PROFILE_ERRORS = {
  handle: "Pseudonyme invalide : 3 à 24 caractères (lettres minuscules, chiffres, _).",
  displayName: "Indiquez le nom affiché.",
};

async function saveProfile(db, user, body) {
  await assertNotSuspended(db, user.uid);
  const norm = normalizeProfileInput(body);
  if (norm.error) fail(400, PROFILE_ERRORS[norm.error]);
  const { handle, displayName, bio } = norm.value;
  const current = (await getProfile(db, user.uid)) || {};

  if (current.handle !== handle) {
    // Réservation atomique du pseudonyme (unicité garantie).
    const claim = await db.ref(P.handles + "/" + handle).transaction((owner) => (owner && owner !== user.uid ? undefined : user.uid));
    if (!claim.committed) fail(409, "Ce pseudonyme est déjà pris.");
  }
  const update = { handle, displayName, bio, updatedAt: Date.now() };
  if (!current.createdAt) update.createdAt = Date.now();
  if (body.photo !== undefined) {
    if (!body.photo) update.photo = "";
    else {
      const asset = normalizeAsset(body.photo, user.uid, "public");
      if (!asset || asset.rt !== "image") fail(400, "Photo de profil invalide.");
      update.photo = publicUrl(asset, "c_fill,g_face,w_256,h_256,q_auto,f_auto");
    }
  }
  await db.ref(P.profiles + "/" + user.uid).update(update);
  if (current.handle && current.handle !== handle) {
    await db.ref(P.handles + "/" + current.handle).transaction((owner) => (owner === user.uid ? null : owner));
  }
  return { profile: publicProfile(user.uid, { ...current, ...update }, { includePayment: true }) };
}

async function saveSeller(db, user, body) {
  await assertNotSuspended(db, user.uid);
  const profile = await getProfile(db, user.uid);
  if (!profile || !profile.handle) fail(409, "Créez d'abord votre profil.");
  if (body.enabled === false) {
    await db.ref(P.profiles + "/" + user.uid + "/seller/enabled").set(false);
    return { ok: true };
  }
  const norm = normalizeSellerInput(body);
  if (norm.error) fail(400, SELLER_ERRORS[norm.error]);
  await db.ref(P.profiles + "/" + user.uid + "/seller").set({ ...norm.value, enabled: true, termsAt: Date.now() });
  await audit(db, user.uid, "seller.settings", { methods: Object.keys(norm.value).filter((k) => norm.value[k]) });
  return { ok: true };
}

async function getPublicProfile(db, user, body) {
  let uid = body.uid;
  if (!uid && body.handle) {
    const handle = normalizeHandle(body.handle);
    uid = handle ? await read(db, P.handles + "/" + handle) : null;
  }
  if (!uid) fail(404, "Profil introuvable.");
  key(uid, "Profil");
  const p = await getProfile(db, uid);
  if (!p || !p.handle) fail(404, "Profil introuvable.");
  const suspended = !!(await read(db, P.suspended + "/" + uid));
  const blocked = !!(await read(db, `${P.blocks}/${user.uid}/${uid}`));
  return { profile: { ...publicProfile(uid, p, { includePayment: uid === user.uid }), suspended }, blocked };
}

async function setBlock(db, user, body) {
  const uid = key(body.uid, "Profil");
  if (uid === user.uid) fail(400, "Vous ne pouvez pas vous bloquer vous-même.");
  await db.ref(`${P.blocks}/${user.uid}/${uid}`).set(body.blocked === false ? null : Date.now());
  return { ok: true, blocked: body.blocked !== false };
}

async function listBlocked(db, user) {
  const blocked = (await read(db, `${P.blocks}/${user.uid}`)) || {};
  const uids = Object.keys(blocked);
  const profiles = await Promise.all(uids.map(async (uid) => publicProfile(uid, await getProfile(db, uid))));
  return { blocked: profiles.filter(Boolean) };
}

module.exports = { saveProfile, saveSeller, getPublicProfile, setBlock, listBlocked };
