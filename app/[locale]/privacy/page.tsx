'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeft, ShieldCheck, Calendar, Mail } from 'lucide-react';
import { useI18nContext } from '../../../src/contexts/I18nProvider';

const SUPPORT_EMAIL = 'hello@domain.financial';

export default function PrivacyPage() {
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
            <div className="h-4 w-1/2 rounded bg-stone-200" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-teal-50/40 via-stone-50 to-amber-50/30 text-stone-900 antialiased">
      {/* Decorative corner glows — same language as login / not-found / changelog */}
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
            <ShieldCheck className="h-3.5 w-3.5" />
            {t('privacy.title')}
          </p>
          <h1 className="mt-5 text-3xl font-bold tracking-tight text-stone-900 sm:text-4xl">
            {t('privacy.title')}
          </h1>
          <p className="mt-3 inline-flex items-center gap-1.5 text-sm text-stone-500">
            <Calendar className="h-3.5 w-3.5" />
            {t('privacy.lastUpdated')} · <time dateTime="2026-04-30">{lastUpdated}</time>
          </p>
        </div>

        <div className="mt-10 space-y-6 sm:mt-12 sm:space-y-8">
          <Section title={t('privacy.introduction.title')}>
            <p>{t('privacy.introduction.content')}</p>
          </Section>

          <Section title={t('privacy.dataCollection.title')}>
            <p>{t('privacy.dataCollection.content')}</p>
            <BulletList
              items={[
                t('privacy.dataCollection.items.account'),
                t('privacy.dataCollection.items.portfolio'),
                t('privacy.dataCollection.items.analytics'),
              ]}
            />
          </Section>

          <Section title={t('privacy.dataSecurity.title')}>
            <p>{t('privacy.dataSecurity.content')}</p>

            <div className="mt-4 rounded-xl border border-teal-200/70 bg-teal-50/60 p-4 sm:p-5">
              <h3 className="mb-3 text-sm font-semibold text-teal-900">
                {t('privacy.dataSecurity.encryption.title')}
              </h3>
              <BulletList
                bulletColor="bg-teal-600"
                textClass="text-teal-900/90"
                items={[
                  t('privacy.dataSecurity.encryption.https'),
                  t('privacy.dataSecurity.encryption.atRest'),
                  t('privacy.dataSecurity.encryption.rls'),
                  t('privacy.dataSecurity.encryption.authVerification'),
                ]}
              />
            </div>

            <div className="mt-4 rounded-xl border border-stone-200/80 bg-stone-50/80 p-4 sm:p-5">
              <h3 className="mb-2 text-sm font-semibold text-stone-900">
                {t('privacy.dataSecurity.notifications.title')}
              </h3>
              <p className="text-[15px] leading-relaxed text-stone-700">
                {t('privacy.dataSecurity.notifications.content')}
              </p>
            </div>
          </Section>

          <Section title={t('privacy.dataUsage.title')}>
            <p>{t('privacy.dataUsage.content')}</p>
            <BulletList
              items={[
                t('privacy.dataUsage.features'),
                t('privacy.dataUsage.preferences'),
              ]}
            />
          </Section>

          <Section title={t('privacy.dataSharing.title')}>
            <p>{t('privacy.dataSharing.content')}</p>
            <div className="mt-4 rounded-xl border border-stone-200/80 bg-stone-50/80 p-4 sm:p-5">
              <h3 className="mb-3 text-sm font-semibold text-stone-900">
                {t('privacy.dataSharing.never.title')}
              </h3>
              <BulletList
                bulletColor="bg-rose-500"
                items={[
                  t('privacy.dataSharing.never.sell'),
                  t('privacy.dataSharing.never.rent'),
                  t('privacy.dataSharing.never.share'),
                  t('privacy.dataSharing.never.marketing'),
                ]}
              />
            </div>
          </Section>

          <Section title={t('privacy.userRights.title')}>
            <p>{t('privacy.userRights.content')}</p>
            <BulletList
              items={[
                t('privacy.userRights.access'),
                t('privacy.userRights.rectification'),
                t('privacy.userRights.erasure'),
                t('privacy.userRights.portability'),
                t('privacy.userRights.restriction'),
                t('privacy.userRights.objection'),
              ]}
            />
          </Section>

          <Section title={t('privacy.dataRetention.title')}>
            <p>{t('privacy.dataRetention.content')}</p>
            <div className="mt-4 rounded-xl border border-stone-200/80 bg-stone-50/80 p-4 sm:p-5">
              <h3 className="mb-3 text-sm font-semibold text-stone-900">
                {t('privacy.dataRetention.periods.title')}
              </h3>
              <BulletList
                items={[
                  t('privacy.dataRetention.periods.account'),
                  t('privacy.dataRetention.periods.domainData'),
                  t('privacy.dataRetention.periods.analytics'),
                ]}
              />
            </div>
          </Section>

          <Section title={t('privacy.cookies.title')}>
            <p>{t('privacy.cookies.content')}</p>
            <BulletList
              items={[
                t('privacy.cookies.essential'),
                t('privacy.cookies.preferences'),
                t('privacy.cookies.analytics'),
                t('privacy.cookies.security'),
              ]}
            />
            <p className="mt-3 text-sm text-stone-500">
              <Link
                href={`/${locale}/cookies`}
                className="text-teal-700 underline-offset-4 transition hover:text-teal-800 hover:underline"
              >
                {locale === 'zh' ? '查看完整 Cookie 政策 →' : 'Read the full Cookies policy →'}
              </Link>
            </p>
          </Section>

          <Section title={t('privacy.thirdParty.title')}>
            <p>{t('privacy.thirdParty.content')}</p>
            <div className="mt-4 rounded-xl border border-stone-200/80 bg-stone-50/80 p-4 sm:p-5">
              <h3 className="mb-3 text-sm font-semibold text-stone-900">
                {t('privacy.thirdParty.services.title')}
              </h3>
              <ul className="space-y-2.5 text-[15px] text-stone-700">
                <li className="flex gap-3">
                  <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-500" />
                  <span><strong className="text-stone-900">Supabase</strong> — {t('privacy.thirdParty.services.supabase')}</span>
                </li>
                <li className="flex gap-3">
                  <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-500" />
                  <span><strong className="text-stone-900">Vercel</strong> — {t('privacy.thirdParty.services.vercel')}</span>
                </li>
                <li className="flex gap-3">
                  <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-500" />
                  <span><strong className="text-stone-900">Resend</strong> — {t('privacy.thirdParty.services.resend')}</span>
                </li>
              </ul>
            </div>
          </Section>

          <Section title={t('privacy.changes.title')}>
            <p>{t('privacy.changes.content')}</p>
          </Section>

          <Section title={t('privacy.contact.title')}>
            <p>{t('privacy.contact.content')}</p>
            <div className="mt-4 rounded-xl border border-emerald-200/70 bg-emerald-50/60 p-4 sm:p-5">
              <p className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-900">
                <Mail className="h-4 w-4" />
                {t('privacy.contact.email')}:&nbsp;
                <a
                  href={`mailto:${SUPPORT_EMAIL}`}
                  className="font-semibold text-emerald-800 underline-offset-4 hover:underline"
                >
                  {SUPPORT_EMAIL}
                </a>
              </p>
              <p className="mt-2 text-sm text-emerald-900/80">{t('privacy.contact.response')}</p>
            </div>
          </Section>

          <p className="border-t border-stone-200/70 pt-6 text-xs text-stone-500">
            {t('privacy.footer')}
          </p>
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
  textClass = 'text-stone-700',
}: {
  items: string[];
  bulletColor?: string;
  textClass?: string;
}) {
  return (
    <ul className={`space-y-2.5 text-[15px] leading-relaxed ${textClass}`}>
      {items.map((item, i) => (
        <li key={i} className="flex gap-3">
          <span
            aria-hidden="true"
            className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${bulletColor}`}
          />
          <span className="flex-1">{item}</span>
        </li>
      ))}
    </ul>
  );
}
