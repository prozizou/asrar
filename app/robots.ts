import type { MetadataRoute } from 'next';
import { normalizeSiteUrl } from '@/lib/site';

const SITE_URL = normalizeSiteUrl(process.env.SITE_URL, 'https://www.asrarpro.com');

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/api/'] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
