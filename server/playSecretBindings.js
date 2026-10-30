// Approved pilot binding. The title is descriptive only; authorization uses cat/key.
const pilot = Object.freeze({ productId: 'secret_protection_001', cat: 'protection', key: '-P2PntsHubOw5y3jXbI_', title: 'RETOUR À L’ENVOYEUR' });
const { error } = require('./playBilling');
const sameSecret = (left, right) => left.cat === right.cat && left.key === right.key;
async function byProduct(db, productId) {
  const stored = (await db.ref('play_secret_products/' + productId).once('value')).val();
  if (productId !== pilot.productId) {
    if (stored && sameSecret(stored, pilot)) throw error(409, 'Le secret pilote est réservé à son produit approuvé.');
    return stored;
  }
  if (stored && !sameSecret(stored, pilot)) throw error(409, 'Ce produit Google Play est déjà associé à un autre secret. Vérification administrateur nécessaire.');
  return stored || { cat: pilot.cat, key: pilot.key };
}
async function bySecret(db, cat, key) {
  const stored = (await db.ref(`secret_products/${cat}/${key}`).once('value')).val();
  if (!sameSecret({ cat, key }, pilot)) {
    if (stored?.productId === pilot.productId) throw error(409, 'Ce produit est réservé à un autre secret.');
    return stored;
  }
  if (stored && stored.productId !== pilot.productId) throw error(409, 'Le produit du secret pilote ne correspond pas à son association approuvée.');
  await byProduct(db, pilot.productId);
  // An explicit operator disable in Firebase takes precedence over the default.
  return stored || { productId: pilot.productId, enabled: true };
}
function assertPair(cat, key, productId) {
  if ((productId === pilot.productId || sameSecret({ cat, key }, pilot)) && (productId !== pilot.productId || !sameSecret({ cat, key }, pilot))) {
    throw error(409, 'Le produit pilote est réservé au secret RETOUR À L’ENVOYEUR.');
  }
}
module.exports = { byProduct, bySecret, assertPair, isFixed: (cat, key) => sameSecret({ cat, key }, pilot) };
