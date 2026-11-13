// server/asrarChat/posts.js — Publications gratuites ou payantes.
//
// ac_posts/{pid}        : partie PUBLIQUE (titre, description, aperçu, prix…)
// ac_post_content/{pid} : contenu intégral { contentText, assets } — lu
//                         uniquement pour le vendeur, l'administration, ou un
//                         acheteur dont l'accès est actif (paiement confirmé).
const { isValidKey } = require("../http");
const {
  P, fail, key, read, audit, getProfile, requireProfile, assertNotSuspended, publicProfile, profilesByUid,
} = require("./core");
const { deliver, publicUrl } = require("./media");
const {
  normalizePostInput, POST_ERRORS, entitlementActive, assetKind, cleanLine, CATEGORIES, POST_KINDS,
} = require("../../lib/asrarChat/logic");

const EXPLORE_SCAN = 400;

function mediaSummary(assets) {
  const kinds = {};
  let duration = 0;
  for (const a of assets) { const k = assetKind(a); kinds[k] = (kinds[k] || 0) + 1; duration += a.duration || 0; }
  return { count: assets.length, kinds, ...(duration ? { duration } : {}) };
}

async function sellerOk(db, uid) {
  const p = await getProfile(db, uid);
  return !!(p && p.seller && p.seller.enabled);
}

async function savePost(db, user, body, isAdmin) {
  await requireProfile(db, user);
  await assertNotSuspended(db, user.uid);
  const norm = normalizePostInput(body, user.uid);
  if (norm.error) fail(400, POST_ERRORS[norm.error]);
  const v = norm.value;
  if (v.price > 0 && !(await sellerOk(db, user.uid))) fail(409, "Activez d'abord la vente (Profil → Vendre) avec vos moyens de paiement.");
  const now = Date.now();
  let pid = body.pid;
  let existing = null;
  if (pid) {
    existing = await read(db, P.posts + "/" + key(pid, "Publication"));
    if (!existing || existing.status === "removed") fail(404, "Publication introuvable.");
    if (existing.sellerUid !== user.uid && !isAdmin) fail(403, "Seul l'auteur peut modifier cette publication.");
  } else {
    // Anti-spam : au plus 30 publications par jour et par compte.
    const recent = await db.ref(P.posts).orderByChild("sellerUid").equalTo(user.uid).limitToLast(30).once("value");
    let today = 0;
    recent.forEach((child) => { if (now - (Number(child.val()?.createdAt) || 0) < 86_400_000) today++; });
    if (today >= 30) fail(429, "Limite de 30 publications par jour atteinte.");
    pid = db.ref(P.posts).push().key;
  }
  const publicPart = {
    sellerUid: existing ? existing.sellerUid : user.uid,
    kind: v.kind, title: v.title, description: v.description, category: v.category,
    price: v.price, accessDays: v.accessDays, conditions: v.conditions, previewText: v.previewText,
    previewImage: v.previewImage ? publicUrl(v.previewImage, "c_limit,w_900,q_auto,f_auto") : "",
    media: mediaSummary(v.assets),
    status: existing ? existing.status : "published",
    createdAt: existing ? existing.createdAt : now,
    updatedAt: now,
    titleLower: v.title.toLowerCase(),
  };
  if (existing && existing.stats) publicPart.stats = existing.stats;
  await db.ref().update({
    [`${P.posts}/${pid}`]: publicPart,
    [`${P.postContent}/${pid}`]: { contentText: v.contentText, assets: v.assets },
  });
  if (!existing) await db.ref(`${P.profiles}/${user.uid}/stats/posts`).transaction((n) => (Number(n) || 0) + 1);
  await audit(db, user.uid, existing ? "post.update" : "post.create", { pid, price: v.price });
  return { pid };
}

async function deletePost(db, user, body, isAdmin) {
  const pid = key(body.pid, "Publication");
  const post = await read(db, P.posts + "/" + pid);
  if (!post || post.status === "removed") fail(404, "Publication introuvable.");
  if (post.sellerUid !== user.uid && !isAdmin) fail(403, "Seul l'auteur peut supprimer cette publication.");
  // Les acheteurs gardent l'accès : le contenu n'est pas effacé, seulement
  // retiré de la vente et de l'Explorer.
  await db.ref(P.posts + "/" + pid).update({ status: post.sellerUid === user.uid ? "hidden" : "removed", removedAt: Date.now() });
  await audit(db, user.uid, "post.delete", { pid, byAdmin: post.sellerUid !== user.uid });
  return { ok: true };
}

async function accessFor(db, pid, post, uid, isAdmin) {
  if (!post) return { unlocked: false };
  if (post.sellerUid === uid) return { unlocked: true, owner: true };
  if (isAdmin) return { unlocked: true, moderation: true };
  if (!(Number(post.price) > 0)) return { unlocked: post.status === "published" };
  const ent = await read(db, `${P.entitlements}/${uid}/${pid}`);
  if (entitlementActive(ent, Date.now())) return { unlocked: true, expiresAt: Number(ent.expiresAt) || 0 };
  return { unlocked: false, expired: !!ent && !ent.revoked };
}

function cardOf(pid, post, seller, access, extra = {}) {
  const stats = post.stats || {};
  return {
    id: pid, kind: post.kind, title: post.title, description: post.description || "", category: post.category,
    price: Number(post.price) || 0, accessDays: Number(post.accessDays) || 0, conditions: post.conditions || "",
    previewText: post.previewText || "", previewImage: post.previewImage || "", media: post.media || { count: 0, kinds: {} },
    createdAt: post.createdAt || 0, status: post.status, seller,
    sales: Number(stats.sales) || 0, favorites: Number(stats.favorites) || 0,
    rating: stats.ratingCount ? Math.round((stats.ratingSum / stats.ratingCount) * 10) / 10 : 0, ratingCount: Number(stats.ratingCount) || 0,
    unlocked: !!access.unlocked, owner: !!access.owner, ...(access.moderation ? { moderation: true } : {}), ...(access.expiresAt ? { expiresAt: access.expiresAt } : {}),
    ...(access.expired ? { expired: true } : {}),
    ...extra,
  };
}

/** Carte d'une publication pour un lecteur (dans une discussion, l'Explorer…). */
async function postCard(db, pid, viewerUid, isAdmin = false) {
  if (!isValidKey(pid)) return null;
  const post = await read(db, P.posts + "/" + pid);
  if (!post) return { id: pid, unavailable: true };
  if (post.status === "removed" && post.sellerUid !== viewerUid) return { id: pid, unavailable: true };
  const seller = publicProfile(post.sellerUid, await getProfile(db, post.sellerUid));
  const access = await accessFor(db, pid, post, viewerUid, isAdmin);
  if (post.status !== "published" && !access.unlocked) return { id: pid, unavailable: true };
  return cardOf(pid, post, seller, access);
}

/** Publication complète : le contenu n'est joint que si l'accès est actif. */
async function openPost(db, user, body, isAdmin) {
  const pid = key(body.pid, "Publication");
  const card = await postCard(db, pid, user.uid, isAdmin);
  if (!card || card.unavailable) fail(404, "Publication indisponible.");
  const result = { post: card };
  result.post.favorite = !!(await read(db, `${P.favorites}/${user.uid}/${pid}`));
  const myRating = await read(db, `${P.ratings}/${pid}/${user.uid}`);
  if (myRating) result.post.myRating = Number(myRating.stars) || 0;
  if (card.unlocked) {
    const content = (await read(db, P.postContent + "/" + pid)) || {};
    result.content = {
      text: content.contentText || "",
      assets: (content.assets || []).map(deliver),
    };
  } else if (card.price > 0) {
    // Commande en cours de l'acheteur, pour reprendre le paiement.
    const mine = (await read(db, `${P.buyerOrders}/${user.uid}`)) || {};
    const ids = Object.keys(mine).sort((a, b) => mine[b] - mine[a]).slice(0, 20);
    for (const oid of ids) {
      const o = await read(db, P.orders + "/" + oid);
      if (o && o.postId === pid && ["pending", "declared", "rejected", "disputed"].includes(o.status)) {
        result.order = { id: oid, ref: o.ref, status: o.status, method: o.method, amount: o.amount };
        break;
      }
    }
  }
  if (card.seller && card.price > 0) {
    const sp = await getProfile(db, card.seller.uid);
    result.post.seller = publicProfile(card.seller.uid, sp);
    result.paymentMethods = sp && sp.seller && sp.seller.enabled
      ? ["wave", "pispi", "whatsapp"].filter((m) => (m === "wave" ? sp.seller.waveLink || sp.seller.wavePhone : m === "pispi" ? sp.seller.pispiAlias : sp.seller.whatsapp))
      : [];
  }
  return result;
}

async function explore(db, user, body) {
  const snap = await db.ref(P.posts).orderByChild("createdAt").limitToLast(EXPLORE_SCAN).once("value");
  const rows = [];
  snap.forEach((child) => { rows.push([child.key, child.val()]); });
  const q = cleanLine(body.q, 60).toLowerCase();
  const category = CATEGORIES.some((c) => c.id === body.category) ? body.category : "";
  const kind = POST_KINDS.includes(body.kind) ? body.kind : "";
  const price = ["free", "paid"].includes(body.price) ? body.price : "";
  const sellerUid = isValidKey(body.sellerUid) ? body.sellerUid : "";
  const suspended = (await read(db, P.suspended)) || {};
  let list = rows.filter(([, p]) => p && p.status === "published" && !suspended[p.sellerUid]);
  if (sellerUid) list = list.filter(([, p]) => p.sellerUid === sellerUid);
  if (category) list = list.filter(([, p]) => p.category === category);
  if (kind) list = list.filter(([, p]) => p.kind === kind);
  if (price === "free") list = list.filter(([, p]) => !(Number(p.price) > 0));
  if (price === "paid") list = list.filter(([, p]) => Number(p.price) > 0);
  if (q) list = list.filter(([, p]) => (p.titleLower || "").includes(q) || String(p.description || "").toLowerCase().includes(q));
  const sort = ["popular", "rating"].includes(body.sort) ? body.sort : "new";
  const score = ([, p]) => {
    const s = p.stats || {};
    if (sort === "popular") return (Number(s.sales) || 0) * 3 + (Number(s.favorites) || 0);
    if (sort === "rating") return s.ratingCount ? s.ratingSum / s.ratingCount + Math.min(s.ratingCount, 20) / 100 : 0;
    return Number(p.createdAt) || 0;
  };
  list.sort((a, b) => score(b) - score(a));
  list = list.slice(0, 60);
  const sellers = await profilesByUid(db, list.map(([, p]) => p.sellerUid));
  const favs = (await read(db, `${P.favorites}/${user.uid}`)) || {};
  const ents = (await read(db, `${P.entitlements}/${user.uid}`)) || {};
  const now = Date.now();
  const posts = list.map(([pid, p]) => {
    const access = p.sellerUid === user.uid ? { unlocked: true, owner: true }
      : !(Number(p.price) > 0) ? { unlocked: true } : entitlementActive(ents[pid], now) ? { unlocked: true } : { unlocked: false };
    return cardOf(pid, p, sellers[p.sellerUid] || null, access, { favorite: !!favs[pid] });
  });
  return { posts };
}

async function exploreSellers(db, user, body) {
  const snap = await db.ref(P.profiles).orderByChild("seller/enabled").equalTo(true).limitToFirst(200).once("value");
  const q = cleanLine(body.q, 60).toLowerCase();
  const suspended = (await read(db, P.suspended)) || {};
  const out = [];
  snap.forEach((child) => {
    const p = child.val();
    if (!p || suspended[child.key] || child.key === user.uid) return;
    if (q && !(String(p.handle).includes(q) || String(p.displayName || "").toLowerCase().includes(q))) return;
    out.push(publicProfile(child.key, p));
  });
  out.sort((a, b) => ((b.stats && b.stats.sales) || 0) - ((a.stats && a.stats.sales) || 0));
  return { sellers: out.slice(0, 40) };
}

async function exploreConvs(db, user, body) {
  const snap = await db.ref(P.convs).orderByChild("visibility").equalTo("public").limitToLast(300).once("value");
  const q = cleanLine(body.q, 60).toLowerCase();
  const out = [];
  snap.forEach((child) => {
    const c = child.val();
    if (!c || c.removed || c.type === "dm") return;
    if (q && !String(c.title || "").toLowerCase().includes(q) && !String(c.about || "").toLowerCase().includes(q)) return;
    out.push({ id: child.key, type: c.type, title: c.title, about: c.about || "", photo: c.photo || "", membersCount: Number(c.membersCount) || 0, lastAt: Number(c.lastAt) || 0 });
  });
  out.sort((a, b) => b.membersCount - a.membersCount || b.lastAt - a.lastAt);
  return { convs: out.slice(0, 40) };
}

async function searchUsers(db, user, body) {
  const q = cleanLine(body.q, 40).toLowerCase().replace(/^@/, "");
  if (q.length < 2) return { users: [] };
  const snap = await db.ref(P.profiles).orderByChild("handle").startAt(q).endAt(q + "").limitToFirst(20).once("value");
  const users = [];
  snap.forEach((child) => { if (child.key !== user.uid) users.push(publicProfile(child.key, child.val())); });
  return { users: users.filter(Boolean) };
}

async function myPosts(db, user) {
  const snap = await db.ref(P.posts).orderByChild("sellerUid").equalTo(user.uid).limitToLast(200).once("value");
  const me = publicProfile(user.uid, await getProfile(db, user.uid));
  const posts = [];
  snap.forEach((child) => {
    const p = child.val();
    if (p && p.status !== "removed") posts.push(cardOf(child.key, p, me, { unlocked: true, owner: true }));
  });
  posts.sort((a, b) => b.createdAt - a.createdAt);
  return { posts };
}

async function toggleFavorite(db, user, body) {
  const pid = key(body.pid, "Publication");
  const post = await read(db, P.posts + "/" + pid);
  if (!post || post.status !== "published") fail(404, "Publication indisponible.");
  const path = `${P.favorites}/${user.uid}/${pid}`;
  const on = !(await read(db, path));
  await db.ref(path).set(on ? Date.now() : null);
  await db.ref(`${P.posts}/${pid}/stats/favorites`).transaction((n) => Math.max(0, (Number(n) || 0) + (on ? 1 : -1)));
  return { favorite: on };
}

async function listFavorites(db, user) {
  const favs = (await read(db, `${P.favorites}/${user.uid}`)) || {};
  const ids = Object.keys(favs).filter(isValidKey).sort((a, b) => favs[b] - favs[a]).slice(0, 100);
  const cards = await Promise.all(ids.map((pid) => postCard(db, pid, user.uid)));
  return { posts: cards.filter((c) => c && !c.unavailable).map((c) => ({ ...c, favorite: true })) };
}

async function ratePost(db, user, body) {
  const pid = key(body.pid, "Publication");
  const stars = Math.round(Number(body.stars));
  if (!(stars >= 1 && stars <= 5)) fail(400, "Note invalide (1 à 5).");
  const post = await read(db, P.posts + "/" + pid);
  if (!post) fail(404, "Publication indisponible.");
  if (post.sellerUid === user.uid) fail(403, "Vous ne pouvez pas noter votre propre publication.");
  const ent = await read(db, `${P.entitlements}/${user.uid}/${pid}`);
  if (Number(post.price) > 0 && !(ent && !ent.revoked)) fail(403, "Seuls les acheteurs peuvent noter cette publication.");
  const path = `${P.ratings}/${pid}/${user.uid}`;
  const previous = await read(db, path);
  await db.ref(path).set({ stars, at: Date.now() });
  await db.ref(`${P.posts}/${pid}/stats`).transaction((s) => {
    const next = { ...(s || {}) };
    next.ratingSum = (Number(next.ratingSum) || 0) + stars - (previous ? Number(previous.stars) || 0 : 0);
    next.ratingCount = (Number(next.ratingCount) || 0) + (previous ? 0 : 1);
    return next;
  });
  return { ok: true };
}

async function storefront(db, user, body) {
  const uid = key(body.uid, "Profil");
  const p = await getProfile(db, uid);
  if (!p || !p.handle) fail(404, "Profil introuvable.");
  const { posts } = await explore(db, user, { sellerUid: uid, sort: "new" });
  const profile = publicProfile(uid, p);
  const rated = posts.filter((x) => x.ratingCount);
  profile.rating = rated.length ? Math.round((rated.reduce((s, x) => s + x.rating * x.ratingCount, 0) / rated.reduce((s, x) => s + x.ratingCount, 0)) * 10) / 10 : 0;
  profile.contact = !!(p.seller && p.seller.whatsapp);
  return { profile, posts };
}

module.exports = {
  savePost, deletePost, postCard, openPost, explore, exploreSellers, exploreConvs, searchUsers, myPosts,
  toggleFavorite, listFavorites, ratePost, storefront, accessFor,
};
