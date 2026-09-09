#!/usr/bin/env node
// scripts/migrate-to-firestore.js — Phase 0 de la migration RTDB → Firestore.
//
// Lit un export JSON complet de la Realtime Database (Firebase Console →
// Realtime Database → ⋮ → Exporter les données JSON) et écrit les documents
// équivalents dans Firestore, selon le schéma documenté dans
// docs/FIRESTORE_SCHEMA.md.
//
// Usage :
//   node scripts/migrate-to-firestore.js --file export.json --dry-run
//   node scripts/migrate-to-firestore.js --file export.json
//
// --dry-run : ne se connecte PAS à Firebase, n'a besoin d'AUCUN identifiant.
// Affiche juste le nombre de documents qui seraient créés par collection —
// sert à valider le mapping avant toute écriture réelle.
//
// Écriture réelle : nécessite FIREBASE_SERVICE_ACCOUNT (JSON brut ou
// base64 du compte de service), même variable que server/grant.js pour la
// RTDB — Firestore et RTDB sont deux produits distincts du même projet
// Firebase, peupler Firestore ne touche jamais la RTDB ni l'app en
// production tant qu'aucun code applicatif ne lit Firestore (phases 1-6,
// non encore livrées).
//
// Idempotent : les IDs de document sont dérivés des clés RTDB d'origine
// (voir docs/FIRESTORE_SCHEMA.md) — relancer le script écrase (set, pas
// create) les mêmes documents plutôt que d'en dupliquer.
//
// Nœuds absents de l'export (ex. `allowedUsers`, `admins`, `vip_users`,
// `purchases`, `zikr_wish_amines` — vides dans l'export de référence) sont
// silencieusement ignorés : chaque générateur ci-dessous garde `|| {}`.

'use strict';

const fs = require('fs');
const path = require('path');

const SECRET_CATS = ['deblocage', 'domptage', 'ilham', 'ouverture', 'protection'];
const MAX_BATCH = 400; // marge sous la limite Firestore de 500 écritures/batch

// ── Générateurs — un par famille de nœuds RTDB, voir docs/FIRESTORE_SCHEMA.md ──
// Chacun produit des { collection, docId, data }. `collection` peut être un
// chemin multi-segments pour une sous-collection (ex. "zikr_groups/g1/members").

function toDocData(value) {
  // Firestore exige un objet — les nœuds RTDB à valeur brute (booléen,
  // nombre, string) sont enveloppés dans { value }.
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) return value;
  return { value };
}

function* flatMappings(root) {
  const FLAT = [
    ['purchased_user', 'access_purchases'],
    ['allowedUsers', 'access_allowed'],
    ['admins', 'access_admins'],
    ['vip_users', 'access_vip'],
    ['sellers', 'sellers'],
    ['profile_clients', 'shop_profiles'],
    ['det_produits', 'products'],
    ['referrals', 'referrals'],
    ['referred', 'referred'],
    ['almaqtab', 'books'],
    ['formations', 'formations'],
    ['versetRef', 'verset_refs'],
    ['sourate', 'sourate'],
    ['reminder_settings', 'reminder_settings'],
    ['activity_feed', 'activity_feed'],
    ['audit_log', 'audit_log'],
    ['trash', 'trash'],
    ['geomancie_logs', 'geomancie_logs'],
    ['book_social_meta', 'book_social_meta'],
  ];
  for (const [node, collection] of FLAT) {
    const obj = root[node];
    if (!obj) continue;
    for (const [key, value] of Object.entries(obj)) {
      yield { collection, docId: key, data: toDocData(value) };
    }
  }
}

function* ordersMapping(root) {
  const obj = root.orders || {};
  for (const [uid, byId] of Object.entries(obj)) {
    for (const [id, data] of Object.entries(byId)) {
      yield { collection: 'orders', docId: id, data: { ...data, uid } };
    }
  }
}

function* purchasesMapping(root) {
  const obj = root.purchases || {};
  for (const [uid, byId] of Object.entries(obj)) {
    for (const [id, data] of Object.entries(byId)) {
      yield { collection: `referrals/${uid}/redemptions`, docId: id, data };
    }
  }
}

function* secretsMapping(root) {
  for (const cat of SECRET_CATS) {
    const obj = root['db_sirr_' + cat];
    if (!obj) continue;
    for (const [key, data] of Object.entries(obj)) {
      yield { collection: 'secrets_' + cat, docId: key, data };
    }
  }
}

function* likesMapping(root) {
  const obj = root.ratings || {};
  for (const [cat, byKey] of Object.entries(obj)) {
    for (const [itemKey, uidMap] of Object.entries(byKey)) {
      yield {
        collection: 'likes',
        docId: `${cat}:${itemKey}`,
        data: { cat, itemKey, uids: uidMap, count: Object.keys(uidMap).length },
      };
    }
  }
}

function* commentsMapping(root) {
  const obj = root.comments || {};
  for (const [cat, byKey] of Object.entries(obj)) {
    for (const [itemKey, byId] of Object.entries(byKey)) {
      for (const [id, data] of Object.entries(byId)) {
        yield { collection: 'comments', docId: id, data: { ...data, cat, itemKey } };
      }
    }
  }
}

function* bookCommentsMapping(root) {
  const obj = root.book_comments || {};
  for (const [bookKey, byId] of Object.entries(obj)) {
    for (const [id, data] of Object.entries(byId)) {
      yield { collection: 'book_comments', docId: id, data: { ...data, bookKey } };
    }
  }
}

function* bookLikesMapping(root) {
  const obj = root.book_likes || {};
  for (const [bookKey, uidMap] of Object.entries(obj)) {
    yield {
      collection: 'book_likes',
      docId: bookKey,
      data: { bookKey, uids: uidMap, count: Object.keys(uidMap).length },
    };
  }
}

function* viewsMapping(root) {
  const obj = (root.views && root.views.product) || {};
  for (const [productKey, byUid] of Object.entries(obj)) {
    for (const [uid, viewedAt] of Object.entries(byUid)) {
      yield { collection: 'product_views', docId: `${productKey}_${uid}`, data: { productKey, uid, viewedAt } };
    }
  }
}

function* pushSubsMapping(root) {
  const obj = root.push_subscriptions || {};
  for (const [uid, byId] of Object.entries(obj)) {
    for (const [subId, data] of Object.entries(byId)) {
      yield { collection: 'push_subscriptions', docId: `${uid}_${subId}`, data: { ...data, uid } };
    }
  }
}

function* analyticsMapping(root) {
  const obj = (root.analytics && root.analytics.visits) || {};
  for (const [date, byUid] of Object.entries(obj)) {
    for (const [uid, data] of Object.entries(byUid)) {
      yield { collection: 'analytics_visits', docId: `${date}_${uid}`, data: { ...data, date, uid } };
    }
  }
}

function* orderCountsMapping(root) {
  const obj = root.orders_count || {};
  for (const [productId, count] of Object.entries(obj)) {
    yield { collection: 'order_counts', docId: productId, data: { count: Number(count) || 0 } };
  }
}

function* referralCodesMapping(root) {
  const obj = root.referral_codes || {};
  for (const [code, uid] of Object.entries(obj)) {
    yield { collection: 'referral_codes', docId: code, data: { uid } };
  }
}

function* zikrMapping(root) {
  const groups = root.zikr_groups || {};
  for (const [gid, data] of Object.entries(groups)) {
    yield { collection: 'zikr_groups', docId: gid, data };
  }
  for (const sub of ['members', 'requests']) {
    const obj = root['zikr_' + sub] || {};
    for (const [gid, byUid] of Object.entries(obj)) {
      for (const [uid, data] of Object.entries(byUid)) {
        yield { collection: `zikr_groups/${gid}/${sub}`, docId: uid, data };
      }
    }
  }
  // Vœux : fusionne zikr_wish_amines/{gid}/{uid}/* dans le champ `amines`
  // du vœu correspondant, si présent (absent de l'export de référence).
  const wishes = root.zikr_wishes || {};
  const amines = root.zikr_wish_amines || {};
  for (const [gid, byUid] of Object.entries(wishes)) {
    for (const [uid, data] of Object.entries(byUid)) {
      const amineMap = amines[gid] && amines[gid][uid];
      yield {
        collection: `zikr_groups/${gid}/wishes`,
        docId: uid,
        data: amineMap ? { ...data, amines: amineMap } : data,
      };
    }
  }
  const chat = root.zikr_chat || {};
  for (const [gid, byMsg] of Object.entries(chat)) {
    for (const [msgId, data] of Object.entries(byMsg)) {
      yield { collection: `zikr_groups/${gid}/messages`, docId: msgId, data };
    }
  }
}

function* singleDocsMapping(root) {
  if (root.config) yield { collection: 'config', docId: 'app', data: root.config };
  if (root.dbLien) yield { collection: 'config', docId: 'social_links', data: { links: root.dbLien } };
  if (root.theme_fondamental) {
    yield { collection: 'config', docId: 'geomancie_theme_fondamental', data: { items: root.theme_fondamental } };
  }
  for (const [id, data] of Object.entries(root.cron_health || {})) {
    yield { collection: 'cron_health', docId: id, data };
  }
}

function* asmaMapping(root) {
  const obj = (root.data && root.data.appData && root.data.appData.asmaUlHusna) || {};
  for (const [key, data] of Object.entries(obj)) {
    yield { collection: 'asma_ul_husna', docId: key, data };
  }
}

// Nœuds retirés de l'app (voir docs/FIRESTORE_SCHEMA.md « Archive ») —
// importés pour ne rien perdre, sans code applicatif prévu derrière.
function* legacyMapping(root) {
  for (const [key, data] of Object.entries(root.don_db || {})) {
    yield { collection: 'legacy_donations', docId: key, data };
  }
  for (const [uid, data] of Object.entries(root.don_meta || {})) {
    yield { collection: 'legacy_donation_meta', docId: uid, data: toDocData(data) };
  }
  if (root.planner) yield { collection: 'legacy_data', docId: 'planner', data: root.planner };
  if (root.alqalam_fonts) yield { collection: 'legacy_data', docId: 'alqalam_fonts', data: root.alqalam_fonts };
}

function* allDocs(root) {
  yield* flatMappings(root);
  yield* ordersMapping(root);
  yield* purchasesMapping(root);
  yield* secretsMapping(root);
  yield* likesMapping(root);
  yield* commentsMapping(root);
  yield* bookCommentsMapping(root);
  yield* bookLikesMapping(root);
  yield* viewsMapping(root);
  yield* pushSubsMapping(root);
  yield* analyticsMapping(root);
  yield* orderCountsMapping(root);
  yield* referralCodesMapping(root);
  yield* zikrMapping(root);
  yield* singleDocsMapping(root);
  yield* asmaMapping(root);
  yield* legacyMapping(root);
}

// ── Utilitaires ──────────────────────────────────────────────────────────

// Firestore refuse `undefined` (mais accepte `null`) — nettoie récursivement
// avant écriture ; ne change rien pour un dry-run (jamais appelé).
function sanitize(value) {
  if (value === undefined) return null;
  if (Array.isArray(value)) return value.map(sanitize);
  if (value !== null && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (v !== undefined) out[k] = sanitize(v);
    }
    return out;
  }
  return value;
}

function initFirestore() {
  // eslint-disable-next-line global-require
  const admin = require('firebase-admin');
  if (!admin.apps.length) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!raw) {
      throw new Error(
        'FIREBASE_SERVICE_ACCOUNT manquant (JSON brut ou base64 du compte de service) — ' +
          'même mécanisme que server/grant.js pour la RTDB.'
      );
    }
    const txt = raw.trim().startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
    admin.initializeApp({ credential: admin.credential.cert(JSON.parse(txt)) });
  }
  return admin.firestore();
}

function printReport(counts, dryRun) {
  const keys = Object.keys(counts).sort();
  const total = keys.reduce((s, k) => s + counts[k], 0);
  console.log(`\n${dryRun ? '[DRY RUN] ' : ''}Résumé — ${keys.length} collections, ${total} documents :\n`);
  for (const k of keys) console.log(`  ${k.padEnd(32)} ${counts[k]}`);
  console.log();
}

function parseArgs(argv) {
  const dryRun = argv.includes('--dry-run');
  const fileIdx = argv.indexOf('--file');
  const filePath = fileIdx !== -1 ? argv[fileIdx + 1] : null;
  return { dryRun, filePath };
}

async function main() {
  const { dryRun, filePath } = parseArgs(process.argv.slice(2));
  if (!filePath) {
    console.error('Usage: node scripts/migrate-to-firestore.js --file <export.json> [--dry-run]');
    process.exitCode = 1;
    return;
  }

  const resolved = path.resolve(filePath);
  const root = JSON.parse(fs.readFileSync(resolved, 'utf8'));

  const counts = {};

  if (dryRun) {
    for (const { collection } of allDocs(root)) {
      counts[collection] = (counts[collection] || 0) + 1;
    }
    printReport(counts, true);
    console.log('Aucune écriture effectuée (--dry-run). Relancer sans ce drapeau pour importer réellement.');
    return;
  }

  const db = initFirestore();
  let batch = db.batch();
  let inBatch = 0;
  const errors = [];

  for (const { collection, docId, data } of allDocs(root)) {
    try {
      const ref = db.collection(collection).doc(String(docId));
      batch.set(ref, sanitize(data));
      inBatch += 1;
      counts[collection] = (counts[collection] || 0) + 1;
      if (inBatch >= MAX_BATCH) {
        // eslint-disable-next-line no-await-in-loop
        await batch.commit();
        batch = db.batch();
        inBatch = 0;
      }
    } catch (e) {
      errors.push({ collection, docId, error: e.message });
    }
  }
  if (inBatch > 0) await batch.commit();

  printReport(counts, false);
  if (errors.length) {
    console.error(`\n${errors.length} erreur(s) :`);
    for (const e of errors.slice(0, 20)) console.error(`  - ${e.collection}/${e.docId} : ${e.error}`);
    if (errors.length > 20) console.error(`  … et ${errors.length - 20} de plus.`);
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error('Échec de la migration :', e.message);
  process.exitCode = 1;
});
