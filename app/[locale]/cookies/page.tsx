'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeft, Cookie, Calendar, Mail } from 'lucide-react';
import { useI18nContext } from '../../../src/contexts/I18nProvider';

const SUPPORT_EMAIL = 'hello@domain.financial';

interface CookieRow {
  name: string;
  purpose: string;
  provider: string;
  retention: string;
}

export default function CookiesPage() {
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
  const isZh = locale === 'zh';
  const tableHeader = {
    name: isZh ? '名称' : 'Name',
    purpose: isZh ? '用途' : 'Purpose',
    provider: isZh ? '提供方' : 'Provider',
    retention: isZh ? '保留期' : 'Retention',
  };

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

  const rows: CookieRow[] = [
    {
      name: t('cookies.categories.essential.name'),
      purpose: t('cookies.categories.essential.purpose'),
      provider: t('cookies.categories.essential.provider'),
      retention: t('cookies.categories.essential.retention'),
    },
    {
      name: t('cookies.categories.preferences.name'),
      purpose: t('cookies.categories.preferences.purpose'),
      provider: t('cookies.categories.preferences.provider'),
      retention: t('cookies.categories.preferences.retention'),
    },
    {
      name: t('cookies.categories.local.name'),
      purpose: t('cookies.categories.local.purpose'),
      provider: t('cookies.categories.local.provider'),
      retention: t('cookies.categories.local.retention'),
    },
  ];

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
            <Cookie className="h-3.5 w-3.5" />
            {t('cookies.title')}
          </p>
          <h1 className="mt-5 text-3xl font-bold tracking-tight text-stone-900 sm:text-4xl">
            {t('cookies.title')}
          </h1>
          <p className="mt-3 inline-flex items-center gap-1.5 text-sm text-stone-500">
            <Calendar className="h-3.5 w-3.5" />
            {t('cookies.lastUpdated')} · <time dateTime="2026-04-30">{lastUpdated}</time>
          </p>
        </div>

        <div className="mt-10 space-y-6 sm:mt-12 sm:space-y-8">
          <Section title={t('cookies.intro.title')}>
            <p>{t('cookies.intro.content')}</p>
          </Section>

          <Section title={t('cookies.categories.title')}>
            {/* Mobile: stacked cards. Desktop (md+): inline table — table is
                easier to scan when there are 4 columns of similar weight. */}
            <div className="space-y-3 md:hidden">
              {rows.map((r, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-stone-200/80 bg-stone-50/80 p-4"
                >
                  <p className="text-sm font-semibold text-stone-900">{r.name}</p>
                  <p className="mt-2 text-[14px] text-stone-700">{r.purpose}</p>
                  <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                    <dt className="text-stone-500">{tableHeader.provider}</dt>
                    <dd className="text-right text-stone-800">{r.provider}</dd>
                    <dt className="text-stone-500">{tableHeader.retention}</dt>
                    <dd className="text-right text-stone-800">{r.retention}</dd>
                  </dl>
                </div>
              ))}
            </div>

            <div className="hidden overflow-hidden rounded-xl border border-stone-200/80 md:block">
              <table className="w-full text-left text-sm">
                <thead className="bg-stone-50/80 text-xs font-semibold uppercase tracking-wider text-stone-500">
                  <tr>
                    <th className="px-4 py-3">{tableHeader.name}</th>
                    <th className="px-4 py-3">{tableHeader.purpose}</th>
                    <th className="px-4 py-3">{tableHeader.provider}</th>
                    <th className="px-4 py-3">{tableHeader.retention}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200 bg-white text-stone-700">
                  {rows.map((r, i) => (
                    <tr key={i}>
                      <td className="px-4 py-3 font-medium text-stone-900">{r.name}</td>
                      <td className="px-4 py-3">{r.purpose}</td>
                      <td className="px-4 py-3 text-stone-600">{r.provider}</td>
                      <td className="px-4 py-3 text-stone-600">{r.retention}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <Section title={t('cookies.noTracking.title')}>
            <p>{t('cookies.noTracking.content')}</p>
          </Section>

          <Section title={t('cookies.control.title')}>
            <p>{t('cookies.control.content')}</p>
          </Section>

          <Section title={t('cookies.changes.title')}>
            <p>{t('cookies.changes.content')}</p>
          </Section>

          <Section title={t('cookies.contact.title')}>
            <p>{t('cookies.contact.content')}</p>
            <div className="mt-4 rounded-xl border border-emerald-200/70 bg-emerald-50/60 p-4 sm:p-5">
              <p className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-900">
                <Mail className="h-4 w-4" />
                {t('cookies.contact.email')}:&nbsp;
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
