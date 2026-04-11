import type { MetadataRoute } from 'next';
import { getSiteUrl } from '../src/lib/siteUrl';

export default function robots(): MetadataRoute.Robots {
  const base = getSiteUrl();

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/dashboard', '/dashboard/', '/login', '/login/', '/api/', '/auth/'],
      },
    ],
    sitemap: new URL('/sitemap.xml', base).href,
  };
}
