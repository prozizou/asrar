// api/admin.js (Vercel) — Panneau d'administration (endpoint multiplexé, ADMIN only).
//
// Body (JSON) : { idToken, action, ... }
// Vérifie que l'appelant est ADMIN (super-admin ou admins/{clé}===true) AVANT tout.
//
// Actions :
//   stats
//   list-secrets {cat} · save-secret {cat,key?,faida,sirr,img} · delete-secret {cat,key}
//   list-books · save-book {key?,titre,auteur,description,img,pdf} · delete-book {key}
//   list-formations · save-formation {key?,titre,description,prix,duree,attentes,img,meetLink} · delete-formation {key}
//   list-products · save-product {key?,produit,Prix,...} · delete-product {key}
//   list-sellers · seller-action {uid, op:'extend'|'suspend'|'activate', days?}
//   grant-access {email, days?, level?} · revoke-access {email} · list-access
//   list-orders · list-activity · list-geomancie

const { verifyUser, isAdmin, emailKey, unwrapAllowed } = require("../../server/access");
const { app } = require("../../server/grant");
const { SECRET_CATS } = require("../../server/sources");
const { setCors, parseBody, safeUrl } = require("../../server/http");
const { reportError } = require("../../server/log");

const DAY_MS = 86400000;

export default async function handler(req, res) {
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

  // Toutes les actions de ce fichier sont sur Firestore depuis la Phase 6
  // (voir docs/FIRESTORE_SCHEMA.md) — plus aucun accès RTDB ici.
  const firestore = app().firestore();

  try {
    switch (action) {
      case "stats":          return res.json(await getStats(firestore));

      case "list-secrets": {
        const cat = body.cat;
        if (!SECRET_CATS.includes(cat)) return res.status(400).json({ error: "Catégorie inconnue." });
        return res.json({ items: await readAllFs(firestore, "secrets_" + cat) });
      }
      case "save-secret": {
        const cat = body.cat;
        if (!SECRET_CATS.includes(cat)) return res.status(400).json({ error: "Catégorie inconnue." });
        const faida = str(body.faida, 200);
        if (!faida) return res.status(400).json({ error: "Titre (faida) requis." });
        const rec = { faida, sirr: str(body.sirr, 8000), img: safeUrl(body.img, 500), updatedAt: Date.now() };
        const col = firestore.collection("secrets_" + cat);
        const key = body.key || col.doc().id;
        await col.doc(key).set(rec, { merge: true });
        return res.json({ ok: true, key });
      }
      case "delete-secret": {
        const cat = body.cat;
        if (!SECRET_CATS.includes(cat) || !body.key) return res.status(400).json({ error: "Paramètres manquants." });
        await firestore.collection("secrets_" + cat).doc(body.key).delete();
        return res.json({ ok: true });
      }

      case "list-books": return res.json({ items: await readAllFs(firestore, "books") });
      case "save-book": {
        const titre = str(body.titre, 200);
        if (!titre) return res.status(400).json({ error: "Titre requis." });
        const rec = {
          titre, auteur: str(body.auteur, 120), description: str(body.description, 2000),
          img: safeUrl(body.img, 500), pdf: safeUrl(body.pdf, 800), updatedAt: Date.now()
        };
        const col = firestore.collection("books");
        const key = body.key || col.doc().id;
        await col.doc(key).set(rec, { merge: true });
        return res.json({ ok: true, key });
      }
      case "delete-book": {
        if (!body.key) return res.status(400).json({ error: "Clé requise." });
        await firestore.collection("books").doc(body.key).delete();
        return res.json({ ok: true });
      }

      case "list-formations": return res.json({ items: await readAllFs(firestore, "formations") });
      case "save-formation": {
        const titre = str(body.titre, 150);
        if (!titre) return res.status(400).json({ error: "Titre requis." });
        const rec = {
          titre, description: str(body.description, 3000), attentes: str(body.attentes, 2000),
          duree: str(body.duree, 80), prix: parseInt(body.prix, 10) || 0,
          img: safeUrl(body.img, 500),
          // Lien Google Meet simple (meet.google.com/... ou tout lien de visio) —
          // pas d'intégration Google Calendar API : l'admin colle le lien de son
          // choix, revu/reconduit à sa guise pour chaque session.
          meetLink: safeUrl(body.meetLink, 500),
          updatedAt: Date.now()
        };
        const col = firestore.collection("formations");
        const key = body.key || col.doc().id;
        await col.doc(key).set(rec, { merge: true });
        return res.json({ ok: true, key });
      }
      case "delete-formation": {
        if (!body.key) return res.status(400).json({ error: "Clé requise." });
        await firestore.collection("formations").doc(body.key).delete();
        return res.json({ ok: true });
      }

      case "list-products": return res.json({ items: await readAllFs(firestore, "products") });
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
        const productsCol = firestore.collection("products");
        // Nouvel identifiant Firestore (les clés PRÉEXISTANTES, importées de la
        // RTDB, restent des push-keys préservées — voir docs/FIRESTORE_SCHEMA.md).
        const key = body.key || productsCol.doc().id;
        await productsCol.doc(key).set(rec, { merge: true });
        return res.json({ ok: true, key });
      }
      case "delete-product": {
        if (!body.key) return res.status(400).json({ error: "Clé requise." });
        await firestore.collection("products").doc(body.key).delete();
        return res.json({ ok: true });
      }

      case "list-sellers": {
        const items = await readAllFs(firestore, "sellers");
        return res.json({ items });
      }
      case "seller-action": {
        const { uid, op } = body;
        if (!uid) return res.status(400).json({ error: "uid requis." });
        const ref = firestore.collection("sellers").doc(uid);
        const snap = await ref.get();
        if (!snap.exists) return res.status(404).json({ error: "Vendeur introuvable." });
        const cur = snap.data();
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
        // orderBy sur un seul champ : pas d'index composite nécessaire.
        const snap = await firestore.collection("orders").orderBy("at", "desc").limit(200).get();
        const out = [];
        snap.forEach((d) => out.push({ _uid: d.data().uid, _key: d.id, ...d.data() }));
        return res.json({ items: out });
      }

      case "list-activity":
        return res.json({ items: await readFeed(firestore, "activity_feed", 150) });
      case "list-geomancie":
        return res.json({ items: await readFeed(firestore, "geomancie_logs", 150) });

      // ── Accès abonnés : activation MANUELLE par l'administration (par e-mail) ──
      // grant-access {email, days?, level?}
      //   days  absent/0 = accès À VIE ; sinon N jours.
      //   level = palier réellement payé, EN FCFA (15000 | 25000 | 45000, cf.
      //           SUB_PLANS dans lib/access.js) ; absent/0 = palier non précisé
      //           (accès accordé mais modules premium — Al Qalam, Géomancie —
      //           RESTENT verrouillés tant que le palier 45000 n'est pas indiqué).
      case "grant-access": {
        const email = normEmail(body.email);
        if (!email) return res.status(400).json({ error: "E-mail invalide." });
        const days = parseInt(body.days, 10);
        const until = Number.isFinite(days) && days > 0 ? Date.now() + days * DAY_MS : true;
        const level = parseInt(body.level, 10);
        await firestore.collection("access_allowed").doc(emailKey(email)).set({
          until,
          level: Number.isFinite(level) && level > 0 ? level : 0
        });
        return res.json({ ok: true, email, expiresAt: until === true ? "lifetime" : until, level: level || 0 });
      }
      // revoke-access {email} → retire l'accès manuel ET neutralise un ancien achat.
      case "revoke-access": {
        const email = normEmail(body.email);
        if (!email) return res.status(400).json({ error: "E-mail invalide." });
        const key = emailKey(email);
        await firestore.collection("access_allowed").doc(key).delete();
        const pSnap = await firestore.collection("access_purchases").doc(key).get();
        if (pSnap.exists) await firestore.collection("access_purchases").doc(key).update({ expiresAt: Date.now() - 1 });
        return res.json({ ok: true, email });
      }
      // list-access → liste des accès accordés manuellement (access_allowed).
      case "list-access": {
        const snap = await firestore.collection("access_allowed").get();
        const items = [];
        snap.forEach((doc) => {
          const v = unwrapAllowed(doc.data());
          const isObj = v && typeof v === "object";
          const until = isObj ? v.until : v;
          items.push({
            email: String(doc.id).replace(/,/g, "."),
            active: until === true || (typeof until === "number" && until > Date.now()),
            expiresAt: until === true ? "lifetime" : until,
            // level 0 = palier non précisé (accès legacy) → modules premium verrouillés.
            level: isObj ? (Number(v.level) || 0) : 0
          });
        });
        return res.json({ items });
      }

      default:
        return res.status(400).json({ error: "Action inconnue." });
    }
  } catch (e) {
    if (!e.statusCode) await reportError("admin", e, { action, uid: user.uid });
    return res.status(e.statusCode || 500).json({ error: e.message });
  }
};

// ---------- Statistiques ----------
async function getStats(firestore) {
  const today = new Date();
  const dates = [];
  for (let i = 0; i < 30; i++) {
    const d = new Date(today.getTime() - i * DAY_MS);
    dates.push(d.toISOString().slice(0, 10));
  }
  // analytics_visits : une requête par jour (égalité simple sur `date`, pas
  // d'index composite nécessaire) — même structure que le scan RTDB
  // d'origine (un nœud par jour), voir docs/FIRESTORE_SCHEMA.md.
  const snaps = await Promise.all(dates.map((d) => firestore.collection("analytics_visits").where("date", "==", d).get()));
  const perDay = snaps.map((s, i) => {
    let unique = 0, total = 0;
    s.forEach((c) => { unique += 1; total += Number(c.data().n) || 0; });
    return { date: dates[i], unique, total };
  });
  const sum = (arr, k) => arr.reduce((a, x) => a + x[k], 0);
  const visits = {
    today: perDay[0] || { unique: 0, total: 0 },
    week:  { unique: uniqUsers(snaps.slice(0, 7)),  total: sum(perDay.slice(0, 7), "total") },
    month: { unique: uniqUsers(snaps.slice(0, 30)), total: sum(perDay.slice(0, 30), "total") },
    series: perDay.slice(0, 14).reverse() // 14 derniers jours, ordre chronologique
  };

  // products/sellers : Firestore depuis la Phase 2 ; books/formations/secrets
  // depuis la Phase 3 (voir docs/FIRESTORE_SCHEMA.md).
  const [productsCountSnap, sellersSnap, booksCountSnap, formationsCountSnap] = await Promise.all([
    firestore.collection("products").count().get(),
    firestore.collection("sellers").get(),
    firestore.collection("books").count().get(),
    firestore.collection("formations").count().get()
  ]);
  const products = productsCountSnap.data().count;
  const books = booksCountSnap.data().count;
  const formations = formationsCountSnap.data().count;
  let activeSellers = 0;
  sellersSnap.forEach((d) => {
    const v = d.data() || {};
    if (v.shopActive && (v.expiresAt === "lifetime" || (typeof v.expiresAt === "number" && v.expiresAt > Date.now()))) activeSellers++;
  });

  const secretCounts = {};
  await Promise.all(SECRET_CATS.map(async (c) => {
    const snap = await firestore.collection("secrets_" + c).count().get();
    secretCounts[c] = snap.data().count;
  }));

  return {
    visits,
    totals: { products, sellers: sellersSnap.size, activeSellers, books, formations, secrets: secretCounts },
    recentActivity: await readFeed(firestore, "activity_feed", 30),
    recentGeomancie: await readFeed(firestore, "geomancie_logs", 30)
  };
}

function uniqUsers(snaps) {
  const set = new Set();
  snaps.forEach((s) => s.forEach((c) => set.add(c.data().uid)));
  return set.size;
}
async function readAllFs(firestore, collection) {
  const snap = await firestore.collection(collection).get();
  const out = [];
  snap.forEach((d) => out.push({ _key: d.id, ...d.data() }));
  return out;
}
// orderBy sur un seul champ (`at`, DESC) : renvoie directement les N plus
// récents en premier — pas besoin de limitToLast+reverse comme sur la RTDB.
async function readFeed(firestore, path, n) {
  const snap = await firestore.collection(path).orderBy("at", "desc").limit(n).get();
  const out = [];
  snap.forEach((d) => out.push({ _key: d.id, ...d.data() }));
  return out;
}

function str(v, max) { return (v == null ? "" : String(v)).trim().slice(0, max || 200); }
function digits(v, max) { return (v == null ? "" : String(v)).replace(/[^\d+]/g, "").slice(0, max || 20); }
function normEmail(v) {
  const e = str(v, 254).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : "";
}
