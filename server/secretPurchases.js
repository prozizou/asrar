const play = require('./playBilling');
const { getSource } = require('./sources');
const { isValidKey } = require('./http');
const { effectiveAccess } = require('../lib/accessStatus');
const { emailKey } = require('./access');
const PRODUCT = /^[a-z][a-z0-9_.]{0,148}$/;
const entitlementPath = (uid, cat, key) => `secret_entitlements/${uid}/${cat}/${key}`;
const fail = play.error;
function validSecret(cat, key) {
  if (!getSource('secret').cats.includes(cat) || !isValidKey(key)) throw fail(400, 'Secret invalide.');
}
async function settings(db, user) {
  const stored = (await db.ref('secret_billing/settings').once('value')).val() || {};
  const testing = user && (process.env.PLAY_BILLING_TEST_UIDS || '').split(',').map((uid) => uid.trim()).includes(user.uid);
  return testing && !stored.enabled ? { ...stored, enabled: true, testing: true } : stored;
}
async function entitlement(db, user, cat, key, verify = true) {
  const stored = (await db.ref(entitlementPath(user.uid, cat, key)).once('value')).val();
  if (!stored || stored.state !== 'purchased') return false;
  const ledger = (await db.ref('play_secret_receipts/' + stored.tokenId).once('value')).val();
  if (!ledger || ledger.uid !== user.uid || ledger.cat !== cat || ledger.key !== key || ledger.state !== 'purchased') return false;
  if (verify && (!Number.isFinite(ledger.checkedAt) || Date.now() - ledger.checkedAt > 3600000)) {
    await synchronize(db, ledger.productId, ledger.token, ledger);
    return entitlement(db, user, cat, key, false);
  }
  return true;
}
async function access(db, user, cat, key, globalAccess, config) {
  validSecret(cat, key);
  const mode = config || await settings(db, user);
  if (!mode.enabled) return { allowed: globalAccess.allowed, mode: 'subscription' };
  if (globalAccess.admin || globalAccess.vip) return { allowed: true, mode: 'individual', reason: 'privileged' };
  const legacy = (await db.ref('secret_legacy_access/' + emailKey(user.email)).once('value')).val();
  if (legacy && (legacy.lifetime === true || legacy.expiresAt > Date.now())) return { allowed: true, mode: 'individual', reason: 'legacy', expiresAt: legacy.expiresAt || null };
  return { allowed: await entitlement(db, user, cat, key), mode: 'individual', reason: 'purchase' };
}
async function offer(db, user, cat, key, globalAccess) {
  validSecret(cat, key);
  const item = (await db.ref(getSource('secret').ref(cat) + '/' + key).once('value')).val();
  if (!item) throw fail(404, 'Secret introuvable.');
  const status = await access(db, user, cat, key, globalAccess);
  const mapping = (await db.ref(`secret_products/${cat}/${key}`).once('value')).val();
  if (status.mode === 'individual' && mapping?.enabled && PRODUCT.test(mapping.productId)) {
    const link = await db.ref('play_secret_accounts/' + play.accountId(user.uid)).transaction((current) => {
      if (current && current.uid !== user.uid) return;
      return current || { uid: user.uid };
    });
    if (!link.committed) throw fail(409, 'Association du compte de paiement impossible.');
  }
  return { ...status, productId: mapping?.enabled && PRODUCT.test(mapping.productId) ? mapping.productId : null,
    accountId: play.accountId(user.uid), title: item.faida || item.title || 'Secret mystique' };
}
async function synchronize(db, productId, token, expected, verifiedPurchase) {
  const purchase = verifiedPurchase || await play.getPurchase(productId, token);
  const id = play.tokenId(token), path = 'play_secret_receipts/' + id;
  const stored = (await db.ref(path).once('value')).val();
  if (!stored || stored.uid !== expected.uid || stored.productId !== productId || stored.cat !== expected.cat || stored.key !== expected.key) throw fail(403, 'Achat non reconnu.');
  if (purchase.purchaseState === 1) {
    await db.ref(path).update({ state: 'revoked', checkedAt: Date.now() });
    await db.ref(entitlementPath(stored.uid, stored.cat, stored.key)).transaction((current) => {
      if (!current) return null;
      if (current.tokenId !== id) return;
      return { state: 'revoked', tokenId: id, at: Date.now() };
    });
    return { revoked: true };
  }
  play.validatePurchase(purchase, stored.uid);
  if (purchase.acknowledgementState !== 1) {
    try { await play.acknowledge(productId, token); }
    catch (error) {
      const latest = await play.getPurchase(productId, token);
      play.validatePurchase(latest, stored.uid);
      if (latest.acknowledgementState !== 1) throw error;
    }
  }
  // Monotonic receipt state: a delayed verification must never resurrect a refund.
  const tx = await db.ref(path).transaction((current) => {
    if (!current) return null;
    if (current.state === 'revoked') return;
    return { ...current, state: 'purchased', checkedAt: Date.now() };
  });
  if (!tx.committed || !tx.snapshot.exists()) throw fail(409, 'Cet achat a été révoqué.');
  await db.ref(entitlementPath(stored.uid, stored.cat, stored.key)).transaction((current) => {
    if (current?.state === 'revoked' && current.tokenId === id) return;
    return { state: 'purchased', tokenId: id, productId, purchasedAt: Number(purchase.purchaseTimeMillis) || Date.now() };
  });
  return { ok: true, cat: stored.cat, key: stored.key };
}
async function verify(db, user, productId, token) {
  if (!PRODUCT.test(productId || '') || typeof token !== 'string' || token.length < 10 || token.length > 4096 || /[\s\u0000-\u001f]/.test(token)) throw fail(400, 'Reçu Google Play invalide.');
  const mapping = (await db.ref('play_secret_products/' + productId).once('value')).val();
  if (!mapping) throw fail(400, 'Produit non reconnu.');
  validSecret(mapping.cat, mapping.key);
  const purchase = await play.getPurchase(productId, token);
  play.validatePurchase(purchase, user.uid);
  const id = play.tokenId(token), receipt = { uid: user.uid, cat: mapping.cat, key: mapping.key, productId, token, state: 'verifying', createdAt: Date.now() };
  const tx = await db.ref('play_secret_receipts/' + id).transaction((current) => {
    if (!current) return receipt;
    if (current.uid !== user.uid || current.productId !== productId || current.cat !== mapping.cat || current.key !== mapping.key || current.state === 'revoked') return;
    return current;
  });
  if (!tx.committed) throw fail(409, 'Ce reçu est déjà associé à un achat ou révoqué.');
  return synchronize(db, productId, token, receipt, purchase);
}
async function configure(db, cat, key, productId) {
  validSecret(cat, key);
  if (!PRODUCT.test(productId || '')) throw fail(400, 'Identifiant produit Google Play invalide.');
  if (!(await db.ref(getSource('secret').ref(cat) + '/' + key).once('value')).exists()) throw fail(404, 'Secret introuvable.');
  const old = (await db.ref(`secret_products/${cat}/${key}`).once('value')).val();
  if (old && old.productId !== productId) throw fail(409, 'Le produit de ce secret est déjà fixé. Créez une nouvelle édition pour changer de produit.');
  const tx = await db.ref('play_secret_products/' + productId).transaction((current) => {
    if (current && (current.cat !== cat || current.key !== key)) return;
    return { cat, key };
  });
  if (!tx.committed) throw fail(409, 'Ce produit est déjà associé à un autre secret.');
  await db.ref(`secret_products/${cat}/${key}`).set({ productId, enabled: true });
  return { ok: true };
}
async function activate(db) {
  if ((await settings(db)).enabled) return { ok: true };
  if (!process.env.PLAY_BILLING_SERVICE_ACCOUNT) throw fail(503, 'Configurez le compte de service Google Play avant la bascule.');
  if (!process.env.PLAY_RTDN_AUDIENCE || !process.env.PLAY_RTDN_SERVICE_ACCOUNT_EMAIL) throw fail(503, 'Configurez les notifications de paiement avant la bascule.');
  for (const cat of getSource('secret').cats) {
    const contents = (await db.ref(getSource('secret').ref(cat)).once('value')).val() || {};
    const products = (await db.ref('secret_products/' + cat).once('value')).val() || {};
    if (Object.keys(contents).some((key) => !products[key]?.enabled || !PRODUCT.test(products[key].productId))) throw fail(409, 'Associez un produit Google Play à chaque secret avant la bascule.');
  }
  const [purchases, allowed] = await Promise.all(['purchased_user', 'allowedUsers'].map((path) => db.ref(path).once('value')));
  const p = purchases.val() || {}, a = allowed.val() || {}, rights = {}, at = Date.now();
  for (const key of new Set([...Object.keys(p), ...Object.keys(a)])) {
    const current = effectiveAccess(p[key], a[key], at);
    if (current.allowed) rights[key] = { expiresAt: current.expiresAt || null, lifetime: current.expiresAt == null, capturedAt: at };
  }
  // Concurrent activation and recovery after a crash reuse the same frozen snapshot.
  const migration = await db.ref('secret_billing/migration').transaction((current) => current || { at, rights });
  const frozen = migration.snapshot.val(), updates = {};
  for (const [key, value] of Object.entries(frozen.rights || {})) updates['secret_legacy_access/' + key] = value;
  updates['secret_billing/settings'] = { enabled: true, activatedAt: frozen.at, legacyPolicy: 'snapshot-until-expiry' };
  // One atomic switch: no subscriber loses access between snapshot and activation.
  await db.ref().update(updates);
  return { ok: true, activatedAt: frozen.at };
}
async function completeNotification(db, productId, token) {
  if (!PRODUCT.test(productId || '') || typeof token !== 'string' || token.length < 10 || token.length > 4096 || /[\s\u0000-\u001f]/.test(token)) return;
  if (!(await db.ref('play_secret_products/' + productId).once('value')).exists()) return;
  const purchase = await play.getPurchase(productId, token);
  if (purchase.purchaseState !== 0 || !/^[a-f0-9]{64}$/.test(purchase.obfuscatedExternalAccountId || '')) return;
  const link = (await db.ref('play_secret_accounts/' + purchase.obfuscatedExternalAccountId).once('value')).val();
  if (!link?.uid) return;
  // The UID comes only from the private account binding created before checkout.
  // verify() checks Google's account identity again and claims the receipt atomically.
  await verify(db, { uid: link.uid }, productId, token);
}
module.exports = { access, offer, verify, configure, activate, synchronize, settings, validSecret, completeNotification };
