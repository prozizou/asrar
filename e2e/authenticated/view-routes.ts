// Les 32 vues publiques de l’arbre app, après authentification.
export const VIEW_ROUTES = [
  '/', '/menu',
  ...['spiritualite', 'sciences-traditionnelles', 'ressources', 'outils'].map((name) => '/menu/' + name),
  ...['alqalam', 'asrar', 'bibliotheque', 'boutique', 'combinaisons', 'commandes', 'compte',
    'geomancie', 'hijri', 'notifications', 'parrainage', 'planete', 'rouwhania', 'tafsir', 'wafq', 'zikr'].map((name) => '/' + name),
  '/wafq/carre', ...[3, 4, 5, 6, 7, 8, 9, 10, 11].map((size) => '/wafq/carre/' + size),
];
