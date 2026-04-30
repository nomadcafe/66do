import type { MetadataRoute } from 'next';
import { getSiteUrl } from '../src/lib/siteUrl';

const locales = ['zh', 'en'] as const;
const paths = ['', '/changelog', '/privacy', '/terms', '/cookies'] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getSiteUrl();
  const lastModified = new Date();

  const entries: MetadataRoute.Sitemap = [];

  for (const locale of locales) {
    for (const path of paths) {
      const pathname = path === '' ? `/${locale}` : `/${locale}${path}`;
      entries.push({
        url: new URL(pathname, base).href,
        lastModified,
        changeFrequency: pathname.endsWith(`/${locale}`) ? 'weekly' : 'monthly',
        priority: pathname.endsWith(`/${locale}`) ? 1 : 0.7,
      });
    }
  }

  return entries;
}
