const { app } = require('../../server/grant');
const { accounts } = require('./accounts.cjs');

module.exports = async function setup() {
  if (process.env.FIREBASE_TEST_MODE !== 'true') throw new Error('Les tests authentifiés exigent les émulateurs.');
  const admin = app();
  const now = Date.now();
  for (const [role, account] of Object.entries(accounts)) {
    try { await admin.auth().deleteUser(account.uid); } catch (error) {
      if (error.code !== 'auth/user-not-found') throw error;
    }
    await admin.auth().createUser({ ...account, displayName: role, emailVerified: role !== 'unverified' });
  }
  await admin.database().ref().set({
    data: { appData: { fixture: 'Donnée publique authentifiée' } },
    allowedUsers: {
      'basic@asrar,test': { until: now + 86400000, level: 15000 },
      'premium@asrar,test': { until: now + 86400000, level: 45000 },
      'expired@asrar,test': { until: now - 86400000, level: 45000 },
    },
    admins: { 'admin@asrar,test': true },
    sellers: { 'fixture-seller': { shopActive: true, expiresAt: now + 86400000,
      shop: { name: 'Boutique de test', phone: '00000000' } } },
    user_sessions: Object.fromEntries(Object.values(accounts).map((a) => [a.uid, { email: a.email, lastLoginAt: now }])),
    det_produits: { product1: { produit: 'Produit de test', Prix: 1000, devise: 'FCFA', uid: 'fixture-seller',
      email: accounts.seller.email, number: '00000000', description: 'Description publique' } },
    db_sirr_protection: { secret1: { faida: 'Secret de test', sirr: 'Contenu réservé aux abonnés' } },
    almaqtab: { book1: { titre: 'Livre de test', pdf: 'https://example.invalid/emulator.pdf' } },
    theme_fondamental: { fixture: 'Thème réservé au premium' },
    formations: { formation1: { titre: 'Formation de test', meetLink: 'https://meet.google.com/emulator-only' } },
    formation_access: { formation1: { 'basic@asrar,test': { minutes: 10 } } },
    notifications: {
      'fixture-free': { own: { type: 'document', title: 'Notification personnelle', body: 'Réservée au compte gratuit',
        targetUrl: '/bibliotheque', createdAt: now, read: false } },
      'fixture-premium': { private: { type: 'document', title: 'Message premium privé', body: 'Autre compte',
        targetUrl: '/bibliotheque', createdAt: now, read: false } },
    },
  });
};
