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
      const zhHref = new URL(path === '' ? '/zh' : `/zh${path}`, base).href;
      const enHref = new URL(path === '' ? '/en' : `/en${path}`, base).href;
      entries.push({
        url: new URL(pathname, base).href,
        lastModified,
        changeFrequency: pathname.endsWith(`/${locale}`) ? 'weekly' : 'monthly',
        priority: pathname.endsWith(`/${locale}`) ? 1 : 0.7,
        // hreflang in the sitemap pairs the two locale URLs as alternates of
        // each other — same signal as <link rel="alternate" hreflang> in the
        // page <head>, but Google picks it up faster from the sitemap.
        alternates: {
          languages: {
            'zh-CN': zhHref,
            en: enHref,
            'x-default': enHref,
          },
        },
      });
    }
  }

  return entries;
}
