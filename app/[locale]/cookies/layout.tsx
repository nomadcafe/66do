import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { isHomeLocale } from '../../../src/i18n/localePath';
import { getSiteUrl } from '../../../src/lib/siteUrl';

type Props = {
  children: ReactNode;
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isHomeLocale(locale)) notFound();
  const base = getSiteUrl();
  const canonical = new URL(`/${locale}/cookies`, base).href;
  const zh = new URL('/zh/cookies', base).href;
  const en = new URL('/en/cookies', base).href;
  const isZh = locale === 'zh';
  const description = isZh
    ? 'Domain.Financial Cookie 政策 —— 我们使用的全部 Cookie 与本地存储说明。'
    : 'Domain.Financial Cookies policy — every cookie and storage item we use, in plain language.';
  return {
    title: isZh ? 'Cookie 政策 · Domain.Financial' : 'Cookies Policy · Domain.Financial',
    description,
    alternates: {
      canonical,
      languages: {
        'zh-CN': zh,
        en,
        'x-default': en,
      },
    },
    openGraph: {
      url: canonical,
      title: isZh ? 'Cookie 政策' : 'Cookies Policy',
      description,
      type: 'website',
      siteName: 'Domain.Financial',
      images: [
        {
          url: '/domainfinancial_og.png',
          width: 2400,
          height: 1260,
          alt: 'Domain.Financial',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: isZh ? 'Cookie 政策 · Domain.Financial' : 'Cookies Policy · Domain.Financial',
      description,
      images: ['/domainfinancial_og.png'],
    },
  };
}

export default function CookiesRouteLayout({ children }: { children: ReactNode }) {
  return children;
}
