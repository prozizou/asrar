/** @type {import('next').NextConfig} */
import { buildCsp } from './lib/csp.js';

// L'API vit désormais DANS cette app (pages/api/* + server/*) : plus de proxy
// externe. On conserve le lien court /s (aperçu Open Graph + redirection +
// comptage parrainage) et on redirige les anciennes URLs .html du site statique
// vers les routes React, pour que TOUS les liens déjà partagés continuent de
// fonctionner.

// Anciennes pages statiques → nouvelles routes SPA.
// Le Marché Mystique est désormais la page d'accueil (/) : l'ancienne route
// /marche n'existe plus, d'où les deux entrées qui pointent vers / (au lieu
// de /marche) — pour les favoris/liens déjà partagés avant ce changement.
const LEGACY = [
  ['/index.html', '/'],
  ['/auth/auth.html', '/'],
  ['/accueil/accueil.html', '/'],
  ['/asrar/asrar.html', '/asrar'],
  ['/marche/marche.html', '/'],
  ['/marche', '/'],
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

// Content-Security-Policy — définition dans lib/csp.js (source unique,
// partagée avec middleware.js). Ici : repli SANS nonce ('unsafe-inline' sur
// script-src), pour les routes que middleware.js ne couvre pas (/api/*, cf.
// son `matcher`) — sur les pages, middleware.js pose une CSP par requête
// avec un nonce qui REMPLACE celle-ci (Next.js ne fusionne pas deux en-têtes
// Content-Security-Policy de même nom).
const CSP = buildCsp();

const SECURITY_HEADERS = [
  { key: 'Content-Security-Policy', value: CSP },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), payment=(), usb=(), geolocation=(self)' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
];

const nextConfig = {
  reactStrictMode: true,

  // « Version de l'app » (drawer, components/AppDrawer.js) : le numéro dans
  // package.json n'est quasiment jamais bumpé à chaque déploiement, donc
  // affiché seul il ne reflète pas les mises à jour réelles. Vercel expose
  // le SHA du commit déployé (VERCEL_GIT_COMMIT_SHA) — on l'injecte ici en
  // variable NEXT_PUBLIC_* (nécessaire pour qu'elle soit lisible côté
  // client) : la « version » affichée change alors à CHAQUE déploiement,
  // sans dépendre d'un bump manuel oublié. Vide en local (hors Vercel).
  env: {
    NEXT_PUBLIC_BUILD_SHA: (process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 7),
  },

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
    // Hôtes que l'optimiseur next/image est autorisé à traiter (cf. components/SmartImage.js) :
    // Cloudinary (boutique/marché/secrets) + avatars Google (auth). Toute autre URL externe
    // (legacy, saisie libre côté admin) passe en `unoptimized` plutôt que planter.
    remotePatterns: [
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      { protocol: 'https', hostname: '*.googleusercontent.com' },
    ],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 jours de cache pour l'optimiseur d'images.
  },

  async headers() {
    return [
      // En-têtes de sécurité : sur toutes les routes.
      { source: '/:path*', headers: SECURITY_HEADERS },
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
