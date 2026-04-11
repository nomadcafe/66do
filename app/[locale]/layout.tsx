import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { isHomeLocale } from '../../src/i18n/localePath';

type Props = { children: ReactNode; params: Promise<{ locale: string }> };

export function generateStaticParams() {
  return [{ locale: 'zh' }, { locale: 'en' }];
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  if (!isHomeLocale(locale)) notFound();
  return children;
}
