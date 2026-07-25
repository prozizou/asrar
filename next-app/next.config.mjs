/** @type {import('next').NextConfig} */

// Les fonctions serverless (paywall, likes, partage, parrainage…) vivent déjà
// dans /api sur le site de production. Le pilote ne les réimplémente PAS : il
// proxifie /api/* vers ce backend, côté serveur Next (donc pas de souci CORS).
// Changez NEXT_PUBLIC_API_BASE pour pointer vers un autre déploiement.
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'https://asrar-hub.vercel.app';

const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      { source: '/api/:path*', destination: `${API_BASE}/api/:path*` },
    ];
  },
};

export default nextConfig;
