/** @type {import('next').NextConfig} */

// L'API vit désormais DANS cette app (pages/api/* + server/*) : plus de proxy
// externe. On conserve le lien court /s (aperçu Open Graph + redirection +
// comptage parrainage) et on redirige les anciennes URLs .html du site statique
// vers les routes React, pour que TOUS les liens déjà partagés continuent de
// fonctionner.

// Anciennes pages statiques → nouvelles routes SPA.
const LEGACY = [
  ['/index.html', '/'],
  ['/auth/auth.html', '/'],
  ['/accueil/accueil.html', '/'],
  ['/asrar/asrar.html', '/asrar'],
  ['/marche/marche.html', '/marche'],
  ['/boutique/boutique.html', '/boutique'],
  ['/bibliotheque/bibliotheque.html', '/bibliotheque'],
  ['/don/don.html', '/don'],
  ['/abajad/abajad.html', '/abajad'],
  ['/parrainage/parrainage.html', '/parrainage'],
  ['/combinaisons/combinaisons.html', '/combinaisons'],
  ['/planete/planete.html', '/planete'],
  ['/rouwhania/index.html', '/rouwhania'],
  ['/geomancie/tourab.html', '/geomancie'],
  ['/alqalam/index.html', '/alqalam'],
  ['/Benefits/index.html', '/benefits'],
];

const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      // Lien court de partage : /s?k=…&i=…&r=… → fonction api/share (OG + redirect).
      { source: '/s', destination: '/api/share' },
    ];
  },
  async redirects() {
    return LEGACY.map(([source, destination]) => ({ source, destination, permanent: false }));
  },
};

export default nextConfig;
