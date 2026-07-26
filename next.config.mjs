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

  // --- Minification / poids des bundles ---
  // swcMinify (JS/CSS) est actif par défaut sur Next 14 ; on ajoute :
  compress: true, // compression gzip/brotli des réponses servies par Next.
  productionBrowserSourceMaps: false, // pas de source maps publiques en prod (bundle plus léger).
  compiler: {
    // On retire les console.* en production (sauf error/warn) → moins de JS livré.
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
  },

  // --- Images : formats modernes (WebP/AVIF) pour <Image> et hôtes distants autorisés ---
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [{ protocol: 'https', hostname: 'res.cloudinary.com' }],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 jours de cache pour l'optimiseur d'images.
  },

  async headers() {
    return [
      // Assets versionnés Next : immuables → cache navigateur d'un an.
      {
        source: '/_next/static/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      // Assets statiques de l'app (logos, icônes) : cache long + revalidation.
      {
        source: '/assets/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=2592000, stale-while-revalidate=86400' }],
      },
    ];
  },

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
