// Les 35 vues publiques de l’arbre app, après authentification.
export const VIEW_ROUTES = [
  '/', '/menu',
  ...['spiritualite', 'sciences-traditionnelles', 'ressources', 'outils'].map((name) => '/menu/' + name),
  ...['abajad', 'alqalam', 'asrar', 'bibliotheque', 'boutique', 'combinaisons', 'commandes', 'compte',
    'formation', 'geomancie', 'hijri', 'notifications', 'parrainage', 'planete', 'rouwhania', 'tafsir', 'thalsams', 'wafq', 'zikr'].map((name) => '/' + name),
  '/wafq/carre', ...[3, 4, 5, 6, 7, 8, 9, 10, 11].map((size) => '/wafq/carre/' + size),
];
