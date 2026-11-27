import type { MetadataRoute } from 'next';
import { normalizeSiteUrl } from '@/lib/site';
import { MODULES } from '@/lib/publicPages';

const SITE_URL = normalizeSiteUrl(process.env.SITE_URL, 'https://www.asrarpro.com');

// Seules les pages lisibles sans connexion (lib/publicPages.js).
export default function sitemap(): MetadataRoute.Sitemap {
  const paths = ['/decouvrir', ...MODULES.map((module) => `/decouvrir/${module.slug}`), '/decouvrir/a-propos', '/decouvrir/contact'];
  return [
    ...paths.map((path) => ({ url: SITE_URL + path, changeFrequency: 'monthly' as const, priority: path === '/decouvrir' ? 1 : 0.7 })),
    { url: `${SITE_URL}/confidentialite.html`, changeFrequency: 'yearly' as const, priority: 0.3 },
  ];
}
