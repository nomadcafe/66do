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
  const canonical = new URL(`/${locale}/terms`, base).href;
  const zh = new URL('/zh/terms', base).href;
  const en = new URL('/en/terms', base).href;
  const isZh = locale === 'zh';
  const description = isZh
    ? 'Domain.Financial 服务条款 —— 使用本服务的前提与权利义务。'
    : 'Domain.Financial Terms of Service — what you agree to when using the platform.';
  return {
    title: isZh ? '服务条款 · Domain.Financial' : 'Terms of Service · Domain.Financial',
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
      title: isZh ? '服务条款' : 'Terms of Service',
      description,
      type: 'website',
      siteName: 'Domain.Financial',
      images: [
        {
          url: '/domainfinancialpng.png',
          width: 612,
          height: 408,
          alt: 'Domain.Financial',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: isZh ? '服务条款 · Domain.Financial' : 'Terms of Service · Domain.Financial',
      description,
      images: ['/domainfinancialpng.png'],
    },
  };
}

export default function TermsRouteLayout({ children }: { children: ReactNode }) {
  return children;
}
