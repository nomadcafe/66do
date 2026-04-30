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
  const canonical = new URL(`/${locale}/privacy`, base).href;
  const zh = new URL('/zh/privacy', base).href;
  const en = new URL('/en/privacy', base).href;
  const isZh = locale === 'zh';
  return {
    title: isZh ? '隐私政策 · Domain.Financial' : 'Privacy Policy · Domain.Financial',
    description: isZh
      ? 'Domain.Financial 隐私政策与用户数据说明。'
      : 'Domain.Financial privacy policy and how we handle your data.',
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
      title: isZh ? '隐私政策' : 'Privacy Policy',
      description: isZh
        ? 'Domain.Financial 隐私政策与用户数据说明。'
        : 'Domain.Financial privacy policy and how we handle your data.',
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
      title: isZh ? '隐私政策 · Domain.Financial' : 'Privacy Policy · Domain.Financial',
      description: isZh
        ? 'Domain.Financial 隐私政策与用户数据说明。'
        : 'Domain.Financial privacy policy and how we handle your data.',
      images: ['/domainfinancialpng.png'],
    },
  };
}

export default function PrivacyRouteLayout({ children }: { children: ReactNode }) {
  return children;
}
