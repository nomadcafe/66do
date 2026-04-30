'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeft, FileText, Calendar, Mail } from 'lucide-react';
import { useI18nContext } from '../../../src/contexts/I18nProvider';

const SUPPORT_EMAIL = 'hello@domain.financial';

export default function TermsPage() {
  const { t, locale } = useI18nContext();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const lastUpdated = new Date('2026-04-30').toLocaleDateString(
    locale === 'zh' ? 'zh-CN' : 'en-US',
    { year: 'numeric', month: 'long', day: 'numeric' }
  );
  const backHomeLabel = locale === 'zh' ? '返回首页' : 'Back to home';

  if (!isClient) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-teal-50/40 via-stone-50 to-amber-50/30">
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 w-48 rounded-lg bg-stone-200" />
            <div className="h-4 w-full rounded bg-stone-200" />
            <div className="h-4 w-3/4 rounded bg-stone-200" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-teal-50/40 via-stone-50 to-amber-50/30 text-stone-900 antialiased">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-32 -right-32 h-96 w-96 rounded-full bg-gradient-to-br from-teal-200/30 via-emerald-100/20 to-transparent blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-40 -left-40 h-[28rem] w-[28rem] rounded-full bg-gradient-to-tr from-amber-100/30 to-transparent blur-3xl"
      />

      <header className="relative border-b border-stone-200/80 bg-white/70 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4 sm:px-6">
          <Link
            href={`/${locale}`}
            className="inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-teal-700 transition hover:text-teal-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
          >
            <ArrowLeft className="h-4 w-4" />
            {backHomeLabel}
          </Link>
        </div>
      </header>

      <main className="relative mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="text-center sm:text-left">
          <p className="inline-flex items-center gap-1.5 rounded-full border border-teal-300/60 bg-teal-50 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-teal-700">
            <FileText className="h-3.5 w-3.5" />
            {t('terms.title')}
          </p>
          <h1 className="mt-5 text-3xl font-bold tracking-tight text-stone-900 sm:text-4xl">
            {t('terms.title')}
          </h1>
          <p className="mt-3 inline-flex items-center gap-1.5 text-sm text-stone-500">
            <Calendar className="h-3.5 w-3.5" />
            {t('terms.lastUpdated')} · <time dateTime="2026-04-30">{lastUpdated}</time>
          </p>
        </div>

        <div className="mt-10 space-y-6 sm:mt-12 sm:space-y-8">
          <Section title={t('terms.intro.title')}>
            <p>{t('terms.intro.content')}</p>
          </Section>

          <Section title={t('terms.service.title')}>
            <p>{t('terms.service.content')}</p>
          </Section>

          <Section title={t('terms.account.title')}>
            <p>{t('terms.account.content')}</p>
          </Section>

          <Section title={t('terms.acceptable.title')}>
            <p>{t('terms.acceptable.content')}</p>
            <BulletList
              bulletColor="bg-rose-500"
              items={[
                t('terms.acceptable.items.abuse'),
                t('terms.acceptable.items.scrape'),
                t('terms.acceptable.items.reverse'),
                t('terms.acceptable.items.illegal'),
                t('terms.acceptable.items.impersonate'),
              ]}
            />
          </Section>

          <Section title={t('terms.noAdvice.title')}>
            <div className="rounded-xl border border-amber-200/70 bg-amber-50/60 p-4 sm:p-5">
              <p className="text-amber-900/90">{t('terms.noAdvice.content')}</p>
            </div>
          </Section>

          <Section title={t('terms.data.title')}>
            <p>{t('terms.data.content')}</p>
            <p className="text-sm text-stone-500">
              <Link
                href={`/${locale}/privacy`}
                className="text-teal-700 underline-offset-4 transition hover:text-teal-800 hover:underline"
              >
                {locale === 'zh' ? '查看隐私政策 →' : 'Read the Privacy Policy →'}
              </Link>
            </p>
          </Section>

          <Section title={t('terms.pricing.title')}>
            <p>{t('terms.pricing.content')}</p>
          </Section>

          <Section title={t('terms.availability.title')}>
            <p>{t('terms.availability.content')}</p>
          </Section>

          <Section title={t('terms.termination.title')}>
            <p>{t('terms.termination.content')}</p>
          </Section>

          <Section title={t('terms.warranty.title')}>
            <p>{t('terms.warranty.content')}</p>
          </Section>

          <Section title={t('terms.liability.title')}>
            <p>{t('terms.liability.content')}</p>
          </Section>

          <Section title={t('terms.governing.title')}>
            <p>{t('terms.governing.content')}</p>
          </Section>

          <Section title={t('terms.contact.title')}>
            <p>{t('terms.contact.content')}</p>
            <div className="mt-4 rounded-xl border border-emerald-200/70 bg-emerald-50/60 p-4 sm:p-5">
              <p className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-900">
                <Mail className="h-4 w-4" />
                {t('terms.contact.email')}:&nbsp;
                <a
                  href={`mailto:${SUPPORT_EMAIL}`}
                  className="font-semibold text-emerald-800 underline-offset-4 hover:underline"
                >
                  {SUPPORT_EMAIL}
                </a>
              </p>
            </div>
          </Section>
        </div>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-stone-200/80 bg-white/90 p-6 shadow-sm shadow-stone-900/[0.02] sm:p-7">
      <h2 className="mb-4 text-xl font-semibold text-stone-900">{title}</h2>
      <div className="space-y-3 text-[15px] leading-relaxed text-stone-700">{children}</div>
    </section>
  );
}

function BulletList({
  items,
  bulletColor = 'bg-teal-500',
}: {
  items: string[];
  bulletColor?: string;
}) {
  return (
    <ul className="space-y-2.5 text-[15px] leading-relaxed text-stone-700">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3">
          <span aria-hidden="true" className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${bulletColor}`} />
          <span className="flex-1">{item}</span>
        </li>
      ))}
    </ul>
  );
}
