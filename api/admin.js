// api/admin.js (Vercel) — Panneau d'administration (endpoint multiplexé, ADMIN only).
//
// Body (JSON) : { idToken, action, ... }
// Vérifie que l'appelant est ADMIN (super-admin ou admins/{clé}===true) AVANT tout.
//
// Actions :
//   stats
//   list-secrets {cat} · save-secret {cat,key?,faida,sirr,img} · delete-secret {cat,key}
//   list-books · save-book {key?,titre,auteur,description,img,pdf} · delete-book {key}
//   list-products · save-product {key?,produit,Prix,...} · delete-product {key}
//   list-sellers · seller-action {uid, op:'extend'|'suspend'|'activate', days?}
//   grant-access {email, days?} · revoke-access {email} · list-access
//   list-orders · list-activity · list-geomancie

const { verifyUser, isAdmin, emailKey } = require("./_lib/access");
const { app } = require("./_lib/grant");
const { SECRET_CATS } = require("./_lib/sources");
const { setCors, parseBody, safeUrl } = require("./_lib/http");

const DAY_MS = 86400000;

module.exports = async (req, res) => {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST")    return res.status(405).json({ error: "Méthode non autorisée" });

  const body = parseBody(req);
  const { idToken, action } = body;

  let user;
  try { user = await verifyUser(idToken); }
  catch (e) { return res.status(e.statusCode || 401).json({ error: e.message }); }

  if (!(await isAdmin(user))) {
    return res.status(403).json({ error: "Accès administrateur requis." });
  }

  const db = app().database();

  try {
    switch (action) {
      case "stats":          return res.json(await getStats(db));

      case "list-secrets": {
        const cat = body.cat;
        if (!SECRET_CATS.includes(cat)) return res.status(400).json({ error: "Catégorie inconnue." });
        return res.json({ items: await readAll(db, "db_sirr_" + cat) });
      }
      case "save-secret": {
        const cat = body.cat;
        if (!SECRET_CATS.includes(cat)) return res.status(400).json({ error: "Catégorie inconnue." });
        const faida = str(body.faida, 200);
        if (!faida) return res.status(400).json({ error: "Titre (faida) requis." });
        const rec = { faida, sirr: str(body.sirr, 8000), img: safeUrl(body.img, 500), updatedAt: Date.now() };
        const key = body.key || db.ref("db_sirr_" + cat).push().key;
        await db.ref("db_sirr_" + cat + "/" + key).update(rec);
        return res.json({ ok: true, key });
      }
      case "delete-secret": {
        const cat = body.cat;
        if (!SECRET_CATS.includes(cat) || !body.key) return res.status(400).json({ error: "Paramètres manquants." });
        await db.ref("db_sirr_" + cat + "/" + body.key).remove();
        return res.json({ ok: true });
      }

      case "list-books": return res.json({ items: await readAll(db, "almaqtab") });
      case "save-book": {
        const titre = str(body.titre, 200);
        if (!titre) return res.status(400).json({ error: "Titre requis." });
        const rec = {
          titre, auteur: str(body.auteur, 120), description: str(body.description, 2000),
          img: safeUrl(body.img, 500), pdf: safeUrl(body.pdf, 800), updatedAt: Date.now()
        };
        const key = body.key || db.ref("almaqtab").push().key;
        await db.ref("almaqtab/" + key).update(rec);
        return res.json({ ok: true, key });
      }
      case "delete-book": {
        if (!body.key) return res.status(400).json({ error: "Clé requise." });
        await db.ref("almaqtab/" + body.key).remove();
        return res.json({ ok: true });
      }

      case "list-products": return res.json({ items: await readAll(db, "det_produits") });
      case "save-product": {
        const produit = str(body.produit, 120);
        const prix = parseInt(body.Prix, 10);
        if (!produit) return res.status(400).json({ error: "Nom du produit requis." });
        if (!(prix > 0)) return res.status(400).json({ error: "Prix invalide." });
        const rec = {
          produit, Prix: prix, devise: str(body.devise, 8) || "FCFA",
          Image: safeUrl(body.Image, 500), description: str(body.description, 1000),
          number: digits(body.number, 20), chain: str(body.chain, 60),
          vendeur: str(body.vendeur, 80) || "Administration",
          email: str(body.email, 120), updatedAt: Date.now()
        };
        if (body.uid) rec.uid = str(body.uid, 64);
        const key = body.key || db.ref("det_produits").push().key;
        await db.ref("det_produits/" + key).update(rec);
        return res.json({ ok: true, key });
      }
      case "delete-product": {
        if (!body.key) return res.status(400).json({ error: "Clé requise." });
        await db.ref("det_produits/" + body.key).remove();
        return res.json({ ok: true });
      }

      case "list-sellers": {
        const items = await readAll(db, "sellers");
        return res.json({ items });
      }
      case "seller-action": {
        const { uid, op } = body;
        if (!uid) return res.status(400).json({ error: "uid requis." });
        const ref = db.ref("sellers/" + uid);
        const cur = (await ref.once("value")).val();
        if (!cur) return res.status(404).json({ error: "Vendeur introuvable." });
        if (op === "suspend")  await ref.update({ shopActive: false });
        else if (op === "activate") await ref.update({ shopActive: true });
        else if (op === "extend") {
          const days = parseInt(body.days, 10) || 30;
          const base = (typeof cur.expiresAt === "number" && cur.expiresAt > Date.now()) ? cur.expiresAt : Date.now();
          await ref.update({ shopActive: true, expiresAt: base + days * DAY_MS });
        } else return res.status(400).json({ error: "Opération inconnue." });
        return res.json({ ok: true });
      }

      case "list-orders": {
        const snap = await db.ref("orders").once("value");
        const out = [];
        snap.forEach((u) => u.forEach((o) => out.push({ _uid: u.key, _key: o.key, ...(o.val() || {}) })));
        out.sort((a, b) => (b.at || 0) - (a.at || 0));
        return res.json({ items: out.slice(0, 200) });
      }

      case "list-activity":
        return res.json({ items: await readFeed(db, "activity_feed", 150) });
      case "list-geomancie":
        return res.json({ items: await readFeed(db, "geomancie_logs", 150) });

      // ── Accès abonnés : activation MANUELLE par l'administration (par e-mail) ──
      // grant-access {email, days?}  → days absent/0 = accès À VIE ; sinon N jours.
      case "grant-access": {
        const email = normEmail(body.email);
        if (!email) return res.status(400).json({ error: "E-mail invalide." });
        const days = parseInt(body.days, 10);
        const value = Number.isFinite(days) && days > 0 ? Date.now() + days * DAY_MS : true;
        await db.ref("allowedUsers/" + emailKey(email)).set(value);
        return res.json({ ok: true, email, expiresAt: value === true ? "lifetime" : value });
      }
      // revoke-access {email} → retire l'accès manuel ET neutralise un ancien achat.
      case "revoke-access": {
        const email = normEmail(body.email);
        if (!email) return res.status(400).json({ error: "E-mail invalide." });
        const key = emailKey(email);
        await db.ref("allowedUsers/" + key).remove();
        const pSnap = await db.ref("purchased_user/" + key).once("value");
        if (pSnap.exists()) await db.ref("purchased_user/" + key + "/expiresAt").set(Date.now() - 1);
        return res.json({ ok: true, email });
      }
      // list-access → liste des accès accordés manuellement (allowedUsers).
      case "list-access": {
        const snap = await db.ref("allowedUsers").once("value");
        const items = [];
        snap.forEach((c) => {
          const v = c.val();
          items.push({
            email: String(c.key).replace(/,/g, "."),
            active: v === true || (typeof v === "number" && v > Date.now()),
            expiresAt: v === true ? "lifetime" : v
          });
        });
        return res.json({ items });
      }

      default:
        return res.status(400).json({ error: "Action inconnue." });
    }
  } catch (e) {
    return res.status(e.statusCode || 500).json({ error: e.message });
  }
};

// ---------- Statistiques ----------
async function getStats(db) {
  const today = new Date();
  const dates = [];
  for (let i = 0; i < 30; i++) {
    const d = new Date(today.getTime() - i * DAY_MS);
    dates.push(d.toISOString().slice(0, 10));
  }
  const snaps = await Promise.all(dates.map((d) => db.ref("analytics/visits/" + d).once("value")));
  const perDay = snaps.map((s, i) => {
    let unique = 0, total = 0;
    s.forEach((c) => { unique += 1; total += (c.val() && c.val().n) || 0; });
    return { date: dates[i], unique, total };
  });
  const sum = (arr, k) => arr.reduce((a, x) => a + x[k], 0);
  const visits = {
    today: perDay[0] || { unique: 0, total: 0 },
    week:  { unique: uniqUsers(snaps.slice(0, 7)),  total: sum(perDay.slice(0, 7), "total") },
    month: { unique: uniqUsers(snaps.slice(0, 30)), total: sum(perDay.slice(0, 30), "total") },
    series: perDay.slice(0, 14).reverse() // 14 derniers jours, ordre chronologique
  };

  const [products, sellers, books] = await Promise.all([
    countChildren(db, "det_produits"),
    db.ref("sellers").once("value"),
    countChildren(db, "almaqtab")
  ]);
  let activeSellers = 0;
  sellers.forEach((s) => {
    const v = s.val() || {};
    if (v.shopActive && (v.expiresAt === "lifetime" || (typeof v.expiresAt === "number" && v.expiresAt > Date.now()))) activeSellers++;
  });

  const secretCounts = {};
  await Promise.all(SECRET_CATS.map(async (c) => { secretCounts[c] = await countChildren(db, "db_sirr_" + c); }));

  return {
    visits,
    totals: { products, sellers: sellers.numChildren(), activeSellers, books, secrets: secretCounts },
    recentActivity: await readFeed(db, "activity_feed", 30),
    recentGeomancie: await readFeed(db, "geomancie_logs", 30)
  };
}

function uniqUsers(snaps) {
  const set = new Set();
  snaps.forEach((s) => s.forEach((c) => set.add(c.key)));
  return set.size;
}
async function countChildren(db, path) {
  return (await db.ref(path).once("value")).numChildren();
}
async function readAll(db, path) {
  const snap = await db.ref(path).once("value");
  const out = [];
  snap.forEach((c) => out.push({ _key: c.key, ...(c.val() || {}) }));
  return out;
}
async function readFeed(db, path, n) {
  const snap = await db.ref(path).orderByChild("at").limitToLast(n).once("value");
  const out = [];
  snap.forEach((c) => out.push({ _key: c.key, ...(c.val() || {}) }));
  return out.reverse(); // plus récent d'abord
}

function str(v, max) { return (v == null ? "" : String(v)).trim().slice(0, max || 200); }
function digits(v, max) { return (v == null ? "" : String(v)).replace(/[^\d+]/g, "").slice(0, max || 20); }
function normEmail(v) {
  const e = str(v, 254).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : "";
}
