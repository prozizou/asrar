#!/usr/bin/env node
// scripts/sync-firestore-to-rtdb.js — Retour Firestore → Realtime Database.
//
// Inverse exact de scripts/migrate-to-firestore.js (Phase 0, 09/09-10/09) :
// la RTDB est restée figée depuis cette migration (aucune écriture réelle),
// alors que l'app a continué de tourner sur Firestore jusqu'au 18/09 — ce
// script recopie TOUT ce qui existe aujourd'hui dans Firestore vers la RTDB,
// pour que rien de ce qui s'est passé entre-temps (inscriptions, achats,
// produits, avis, messages Zikr…) ne soit perdu quand le code applicatif
// revient à lire/écrire la RTDB.
//
// Contrairement à migrate-to-firestore.js (qui lisait un export JSON
// statique), celui-ci lit Firestore EN DIRECT via l'Admin SDK — plus fidèle
// (pas d'étape d'export manuel à refaire juste avant de lancer le script).
//
// Usage :
//   node scripts/sync-firestore-to-rtdb.js --dry-run     (aucune écriture, juste un rapport)
//   node scripts/sync-firestore-to-rtdb.js                (écrit réellement dans la RTDB)
//
// Variables d'environnement requises (écriture réelle) :
//   FIREBASE_SERVICE_ACCOUNT   JSON brut ou base64 du compte de service
//   FIREBASE_DB_URL            URL de la Realtime Database cible
//
// ⚠️ À LANCER AVANT de déployer le code revenu à la RTDB (server/access.js,
// pages/api/*.js, etc.) — sans quoi la fenêtre entre la fin de ce script et
// le déploiement du code laisserait échapper les toutes dernières écritures.
// Idempotent (set, pas push) : relançable sans risque de doublons.

'use strict';

const MAX_CONCURRENT = 20; // écritures RTDB en parallèle, par lot

// ── Générateurs — inverses exacts de ceux de migrate-to-firestore.js ──────
// Chacun produit des { path, data } : `path` est le chemin RTDB complet,
// `data` la valeur à y écrire (set).

// Nœuds RTDB à valeur brute d'origine (booléen/nombre/string) avaient été
// enveloppés dans { value } par toDocData() — on déballe ici.
function unwrapValue(data) {
  if (data && typeof data === 'object' && !Array.isArray(data) &&
      Object.keys(data).length === 1 && 'value' in data) {
    return data.value;
  }
  return data;
}

async function* flatMappings(db) {
  // [collection Firestore, nœud RTDB]
  const FLAT = [
    ['access_purchases', 'purchased_user'],
    ['access_allowed', 'allowedUsers'],
    ['access_admins', 'admins'],
    ['access_vip', 'vip_users'],
    ['sellers', 'sellers'],
    ['shop_profiles', 'profile_clients'],
    ['products', 'det_produits'],
    ['products_blocked', 'det_produits_bloques'], // admin-asrar-pro uniquement (pas dans la migration d'origine)
    ['referrals', 'referrals'],
    ['referred', 'referred'],
    ['books', 'almaqtab'],
    ['formations', 'formations'],
    ['verset_refs', 'versetRef'],
    ['sourate', 'sourate'],
    ['reminder_settings', 'reminder_settings'],
    ['activity_feed', 'activity_feed'],
    ['audit_log', 'audit_log'],
    ['trash', 'trash'],
    ['geomancie_logs', 'geomancie_logs'],
    ['book_social_meta', 'book_social_meta'],
    ['user_sessions', 'user_sessions'], // nouveau (pays/connexions) — pas de nœud RTDB d'origine, on le crée
    ['vendor_notifications', 'notifications_by_id'], // admin-asrar-pro : voir notificationsMapping() pour le vrai regroupement notifications/{uid}
  ];
  for (const [collection, node] of FLAT) {
    const snap = await db.collection(collection).get();
    for (const doc of snap.docs) {
      if (collection === 'vendor_notifications') continue; // regroupé séparément (voir notificationsMapping)
      yield { path: `${node}/${doc.id}`, data: unwrapValue(doc.data()) };
    }
  }
}

// vendor_notifications (admin-only, plat) → notifications/{uid}/{pushId} (regroupé par uid, comme l'ancien RTDB).
async function* notificationsMapping(db) {
  const snap = await db.collection('vendor_notifications').get();
  for (const doc of snap.docs) {
    const d = doc.data();
    if (!d || !d.uid) continue;
    const { uid, ...rest } = d;
    yield { path: `notifications/${uid}/${doc.id}`, data: rest };
  }
}

async function* ordersMapping(db) {
  const snap = await db.collection('orders').get();
  for (const doc of snap.docs) {
    const d = doc.data();
    if (!d || !d.uid) continue;
    const { uid, ...rest } = d;
    yield { path: `orders/${uid}/${doc.id}`, data: rest };
  }
}

async function* purchasesMapping(db) {
  // referrals/{uid}/redemptions/{id} (sous-collection Firestore) → purchases/{uid}/{id}
  const refs = await db.collection('referrals').get();
  for (const ref of refs.docs) {
    const sub = await ref.ref.collection('redemptions').get();
    for (const doc of sub.docs) {
      yield { path: `purchases/${ref.id}/${doc.id}`, data: doc.data() };
    }
  }
}

const SECRET_CATS = ['deblocage', 'domptage', 'ilham', 'ouverture', 'protection'];
async function* secretsMapping(db) {
  for (const cat of SECRET_CATS) {
    const snap = await db.collection('secrets_' + cat).get();
    for (const doc of snap.docs) {
      yield { path: `db_sirr_${cat}/${doc.id}`, data: doc.data() };
    }
  }
}

async function* likesMapping(db) {
  // likes/{cat}:{itemKey} → ratings/{cat}/{itemKey} = uids (le champ `count` était dérivé, pas réécrit).
  const snap = await db.collection('likes').get();
  for (const doc of snap.docs) {
    const d = doc.data();
    if (!d || !d.cat || !d.itemKey) continue;
    yield { path: `ratings/${d.cat}/${d.itemKey}`, data: d.uids || {} };
  }
}

async function* commentsMapping(db) {
  const snap = await db.collection('comments').get();
  for (const doc of snap.docs) {
    const { cat, itemKey, ...rest } = doc.data();
    if (!cat || !itemKey) continue;
    yield { path: `comments/${cat}/${itemKey}/${doc.id}`, data: rest };
  }
}

async function* bookCommentsMapping(db) {
  const snap = await db.collection('book_comments').get();
  for (const doc of snap.docs) {
    const { bookKey, ...rest } = doc.data();
    if (!bookKey) continue;
    yield { path: `book_comments/${bookKey}/${doc.id}`, data: rest };
  }
}

async function* bookLikesMapping(db) {
  const snap = await db.collection('book_likes').get();
  for (const doc of snap.docs) {
    const d = doc.data();
    yield { path: `book_likes/${doc.id}`, data: d.uids || {} };
  }
}

async function* viewsMapping(db) {
  const snap = await db.collection('product_views').get();
  for (const doc of snap.docs) {
    const d = doc.data();
    if (!d || !d.productKey || !d.uid) continue;
    yield { path: `views/product/${d.productKey}/${d.uid}`, data: d.viewedAt };
  }
}

async function* pushSubsMapping(db) {
  const snap = await db.collection('push_subscriptions').get();
  for (const doc of snap.docs) {
    const { uid, ...rest } = doc.data();
    if (!uid) continue;
    // docId = `${uid}_${subId}` — on retire le préfixe uid pour retrouver le subId d'origine.
    const subId = doc.id.startsWith(uid + '_') ? doc.id.slice(uid.length + 1) : doc.id;
    yield { path: `push_subscriptions/${uid}/${subId}`, data: rest };
  }
}

async function* analyticsMapping(db) {
  const snap = await db.collection('analytics_visits').get();
  for (const doc of snap.docs) {
    const { date, uid, ...rest } = doc.data();
    if (!date || !uid) continue;
    yield { path: `analytics/visits/${date}/${uid}`, data: rest };
  }
}

async function* orderCountsMapping(db) {
  const snap = await db.collection('order_counts').get();
  for (const doc of snap.docs) {
    yield { path: `orders_count/${doc.id}`, data: doc.data().count ?? 0 };
  }
}

async function* referralCodesMapping(db) {
  const snap = await db.collection('referral_codes').get();
  for (const doc of snap.docs) {
    yield { path: `referral_codes/${doc.id}`, data: doc.data().uid };
  }
}

async function* zikrMapping(db) {
  const groups = await db.collection('zikr_groups').get();
  for (const g of groups.docs) {
    yield { path: `zikr_groups/${g.id}`, data: g.data() };
    for (const sub of ['members', 'requests']) {
      const subSnap = await g.ref.collection(sub).get();
      for (const doc of subSnap.docs) {
        yield { path: `zikr_${sub}/${g.id}/${doc.id}`, data: doc.data() };
      }
    }
    const wishes = await g.ref.collection('wishes').get();
    for (const doc of wishes.docs) {
      const { amines, ...rest } = doc.data();
      yield { path: `zikr_wishes/${g.id}/${doc.id}`, data: rest };
      if (amines) yield { path: `zikr_wish_amines/${g.id}/${doc.id}`, data: amines };
    }
    const messages = await g.ref.collection('messages').get();
    for (const doc of messages.docs) {
      yield { path: `zikr_chat/${g.id}/${doc.id}`, data: doc.data() };
    }
  }
}

async function* singleDocsMapping(db) {
  const appCfg = await db.collection('config').doc('app').get();
  if (appCfg.exists) yield { path: 'config', data: appCfg.data() };
  const social = await db.collection('config').doc('social_links').get();
  if (social.exists) yield { path: 'dbLien', data: (social.data() || {}).links || {} };
  const theme = await db.collection('config').doc('geomancie_theme_fondamental').get();
  if (theme.exists) yield { path: 'theme_fondamental', data: (theme.data() || {}).items || [] };
  // config/referral (admin-asrar-pro — plus lu par asrar-main, mais on le
  // resynchronise quand même : mieux vaut le retrouver que le perdre).
  const referralCfg = await db.collection('config').doc('referral').get();
  if (referralCfg.exists) yield { path: 'config/referral', data: referralCfg.data() };
  const cronHealth = await db.collection('cron_health').get();
  for (const doc of cronHealth.docs) yield { path: `cron_health/${doc.id}`, data: doc.data() };
}

async function* asmaMapping(db) {
  const snap = await db.collection('asma_ul_husna').get();
  for (const doc of snap.docs) {
    yield { path: `data/appData/asmaUlHusna/${doc.id}`, data: doc.data() };
  }
}

async function* legacyMapping(db) {
  const donations = await db.collection('legacy_donations').get();
  for (const doc of donations.docs) yield { path: `don_db/${doc.id}`, data: doc.data() };
  const donMeta = await db.collection('legacy_donation_meta').get();
  for (const doc of donMeta.docs) yield { path: `don_meta/${doc.id}`, data: unwrapValue(doc.data()) };
  const planner = await db.collection('legacy_data').doc('planner').get();
  if (planner.exists) yield { path: 'planner', data: planner.data() };
  const fonts = await db.collection('legacy_data').doc('alqalam_fonts').get();
  if (fonts.exists) yield { path: 'alqalam_fonts', data: fonts.data() };
}

async function* allEntries(db) {
  yield* flatMappings(db);
  yield* notificationsMapping(db);
  yield* ordersMapping(db);
  yield* purchasesMapping(db);
  yield* secretsMapping(db);
  yield* likesMapping(db);
  yield* commentsMapping(db);
  yield* bookCommentsMapping(db);
  yield* bookLikesMapping(db);
  yield* viewsMapping(db);
  yield* pushSubsMapping(db);
  yield* analyticsMapping(db);
  yield* orderCountsMapping(db);
  yield* referralCodesMapping(db);
  yield* zikrMapping(db);
  yield* singleDocsMapping(db);
  yield* asmaMapping(db);
  yield* legacyMapping(db);
}

// ── Utilitaires ──────────────────────────────────────────────────────────

function initApp() {
  // eslint-disable-next-line global-require
  const admin = require('firebase-admin');
  if (!admin.apps.length) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!raw) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT manquant (JSON brut ou base64 du compte de service).');
    }
    const txt = raw.trim().startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
    if (!process.env.FIREBASE_DB_URL) {
      throw new Error('FIREBASE_DB_URL manquant (URL de la Realtime Database cible).');
    }
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(txt)),
      databaseURL: process.env.FIREBASE_DB_URL,
    });
  }
  return admin;
}

// Écrit par petits lots parallèles (pas de "batch" atomique côté RTDB comme
// Firestore — set() est déjà unitaire par chemin) pour ne pas ouvrir des
// milliers de requêtes HTTP simultanées.
async function writeInChunks(rtdb, entries, dryRun, counts) {
  let buf = [];
  const flush = async () => {
    if (!buf.length) return;
    if (!dryRun) await Promise.all(buf.map(({ path, data }) => rtdb.ref(path).set(data)));
    buf = [];
  };
  for await (const entry of entries) {
    const node = entry.path.split('/')[0];
    counts[node] = (counts[node] || 0) + 1;
    buf.push(entry);
    if (buf.length >= MAX_CONCURRENT) await flush();
  }
  await flush();
}

function printReport(counts, dryRun) {
  const keys = Object.keys(counts).sort();
  const total = keys.reduce((s, k) => s + counts[k], 0);
  console.log(`\n${dryRun ? '[DRY RUN] ' : ''}Résumé — ${keys.length} nœuds RTDB racine, ${total} entrées :\n`);
  for (const k of keys) console.log(`  ${k.padEnd(32)} ${counts[k]}`);
  console.log();
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const admin = initApp();
  const db = admin.firestore();
  const rtdb = dryRun ? null : admin.database();

  const counts = {};
  try {
    await writeInChunks(rtdb, allEntries(db), dryRun, counts);
  } catch (e) {
    console.error('Échec de la resynchronisation :', e.message);
    process.exitCode = 1;
    return;
  }
  printReport(counts, dryRun);
  console.log(dryRun
    ? 'Aucune écriture effectuée (--dry-run). Relancer sans ce drapeau pour resynchroniser réellement.'
    : 'Resynchronisation terminée. Vérifier la RTDB avant de déployer le code revenu dessus.');
}

main();
