import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  Globe,
  TrendingUp,
  BarChart3,
  Star,
  Shield,
  Plus,
  RefreshCw,
  PieChart,
  DollarSign,
} from 'lucide-react';
import {
  getHomeDictionary,
  homePageMetadata,
  type HomeLocale,
} from '../../src/i18n/homeDictionary';
import { isHomeLocale } from '../../src/i18n/localePath';
import HomeHeaderClient from '../../src/components/home/HomeHeaderClient';
import HomeCtaButtons from '../../src/components/home/HomeCtaButtons';
import HomeFooterProductLinks from '../../src/components/home/HomeFooterProductLinks';

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps) {
  const { locale: l } = await params;
  if (!isHomeLocale(l)) notFound();
  return homePageMetadata(l);
}

export default async function HomePage({ params }: PageProps) {
  const { locale: l } = await params;
  if (!isHomeLocale(l)) notFound();
  const locale = l as HomeLocale;
  const d = getHomeDictionary(locale);
  const year = new Date().getFullYear();

  const featureStrip = [
    { icon: <Globe className="h-5 w-5" />, title: d.features.portfolio.title },
    { icon: <TrendingUp className="h-5 w-5" />, title: d.features.analytics.title },
    { icon: <BarChart3 className="h-5 w-5" />, title: d.features.data.title },
    { icon: <Shield className="h-5 w-5" />, title: d.features.security.title },
  ];

  const sampleTransactions = [
    { domain: 'crypto.xyz', type: 'sell' as const, date: locale === 'zh' ? '2026年4月12日' : 'Apr 12, 2026', amount: '+$8,400' },
    { domain: 'meta.io', type: 'buy' as const, date: locale === 'zh' ? '2026年4月9日' : 'Apr 9, 2026', amount: '-$220' },
    { domain: 'ai-tools.com', type: 'renew' as const, date: locale === 'zh' ? '2026年4月3日' : 'Apr 3, 2026', amount: '-$32' },
    { domain: 'portfolio.dev', type: 'sell' as const, date: locale === 'zh' ? '2026年3月28日' : 'Mar 28, 2026', amount: '+$3,200' },
  ];

  const txTypeLabel = (type: 'buy' | 'sell' | 'renew') =>
    type === 'sell' ? d.preview.typeSell : type === 'buy' ? d.preview.typeBuy : d.preview.typeRenew;

  // Sparkline points: monotonic upward sample, 12 monthly steps. width 200, height 56, padded 4.
  const sparkPoints = [12, 14, 13, 18, 22, 24, 28, 30, 36, 40, 44, 48];
  const minV = Math.min(...sparkPoints);
  const maxV = Math.max(...sparkPoints);
  const sparkPath = sparkPoints
    .map((v, i) => {
      const x = 4 + (i / (sparkPoints.length - 1)) * 192;
      const y = 52 - ((v - minV) / (maxV - minV)) * 48;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  const sparkArea = `${sparkPath} L196,56 L4,56 Z`;

  return (
    <div className="min-h-screen antialiased bg-stone-50 text-stone-900">
      <HomeHeaderClient
        initialLocale={locale}
        localePrefix={`/${locale}`}
        platformName={d.platform.name}
        selectLanguageLabel={d.settings.selectLanguage}
        signInLabel={d.nav.signIn}
        goToDashboardLabel={d.nav.goToDashboard}
      />

      <main>
        {/* HERO — two columns on lg+: copy left, KPI preview right */}
        <section className="relative overflow-hidden border-b border-stone-200 bg-white">
          <div
            className="absolute inset-0 opacity-[0.04] pointer-events-none"
            style={{
              backgroundImage: 'radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)',
              backgroundSize: '32px 32px',
            }}
          />
          <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
            <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
              {/* Left: headline + CTAs */}
              <div className="text-center lg:text-left">
                <p className="mb-6 inline-flex items-center gap-1.5 rounded-full border border-teal-300/60 bg-teal-50 px-3.5 py-1.5 text-sm font-medium text-teal-700">
                  <Star className="h-3.5 w-3.5" />
                  {d.home.trustedBy}
                </p>
                <h1 className="mb-6 text-4xl font-bold tracking-tight text-stone-900 sm:text-5xl lg:text-6xl">
                  {d.home.title}
                </h1>
                <p className="mb-10 text-lg leading-relaxed text-stone-600 sm:text-xl">
                  {d.home.subtitle}
                </p>
                <HomeCtaButtons
                  getStartedLabel={d.home.getStarted}
                  getStartedAria={d.home.getStarted}
                  startFreeLabel={d.home.startFree}
                  startFreeAria={d.home.startFree}
                  variant="hero"
                  className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-teal-600/20 transition hover:bg-teal-700 hover:shadow-teal-600/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
                />
              </div>

              {/* Right: portfolio-value KPI card with sparkline */}
              <div aria-hidden="true" className="relative mx-auto w-full max-w-md lg:max-w-none">
                <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-to-br from-teal-100/60 via-emerald-100/40 to-transparent blur-2xl" />
                <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-xl shadow-stone-900/5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium uppercase tracking-wider text-stone-500">
                      {d.preview.totalRevenue}
                    </p>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                      <TrendingUp className="h-3 w-3" /> +18%
                    </span>
                  </div>
                  <p className="mt-2 text-4xl font-bold tracking-tight text-stone-900">$48,200</p>
                  <p className="mt-1 text-xs text-stone-500">{d.preview.activeSold}</p>

                  <svg viewBox="0 0 200 60" className="mt-5 h-16 w-full" preserveAspectRatio="none" role="img">
                    <defs>
                      <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#14b8a6" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="#14b8a6" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path d={sparkArea} fill="url(#sparkGrad)" />
                    <path d={sparkPath} fill="none" stroke="#0d9488" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>

                  <div className="mt-5 grid grid-cols-3 gap-3 border-t border-stone-100 pt-4">
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-wider text-stone-500">{d.preview.totalDomains}</p>
                      <p className="mt-0.5 text-base font-semibold text-stone-900">28</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-wider text-stone-500">{d.preview.totalCost}</p>
                      <p className="mt-0.5 text-base font-semibold text-stone-900">$14,520</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-wider text-stone-500">{d.preview.roi}</p>
                      <p className="mt-0.5 text-base font-semibold text-emerald-600">232%</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* PRODUCT PREVIEW — full inline mock matching the real dashboard */}
        <section className="border-b border-stone-200 bg-stone-50 py-16 sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="mb-10 text-center">
              <p className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3 py-1 text-xs font-medium text-stone-600">
                {d.preview.badge}
              </p>
              <h2 className="text-3xl font-bold tracking-tight text-stone-900 sm:text-4xl">
                {d.preview.sectionTitle}
              </h2>
              <p className="mx-auto mt-3 max-w-2xl text-lg text-stone-600">
                {d.preview.sectionSubtitle}
              </p>
            </div>

            {/* Mock dashboard frame */}
            <div aria-hidden="true" className="rounded-2xl border border-stone-200 bg-white shadow-xl shadow-stone-900/5 overflow-hidden">
              {/* Window chrome */}
              <div className="flex items-center gap-1.5 border-b border-stone-100 bg-stone-50/80 px-4 py-2.5">
                <span className="h-2.5 w-2.5 rounded-full bg-stone-300" />
                <span className="h-2.5 w-2.5 rounded-full bg-stone-300" />
                <span className="h-2.5 w-2.5 rounded-full bg-stone-300" />
                <span className="ml-3 text-xs text-stone-400">domain.financial / dashboard</span>
              </div>

              <div className="p-4 sm:p-6 space-y-4 sm:space-y-5">
                {/* KPI row — mirrors dashboard layout */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                  <div className="rounded-2xl border border-stone-200/80 bg-white p-4 sm:p-5 shadow-sm">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wider text-stone-500">{d.preview.totalDomains}</p>
                        <p className="text-2xl font-bold text-stone-900 mt-1">28</p>
                        <p className="text-xs text-stone-500 mt-1">{d.preview.activeSold}</p>
                      </div>
                      <div className="w-10 h-10 rounded-xl bg-stone-100 flex items-center justify-center text-stone-600"><Globe className="h-5 w-5" /></div>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-stone-200/80 bg-white p-4 sm:p-5 shadow-sm">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wider text-stone-500">{d.preview.totalCost}</p>
                        <p className="text-2xl font-bold text-stone-900 mt-1">$14,520</p>
                        <p className="text-xs text-stone-500 mt-1">avg $518</p>
                      </div>
                      <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600"><DollarSign className="h-5 w-5" /></div>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-stone-200/80 bg-white p-4 sm:p-5 shadow-sm">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wider text-stone-500">{d.preview.totalRevenue}</p>
                        <p className="text-2xl font-bold text-stone-900 mt-1">$48,200</p>
                        <p className="text-xs text-emerald-600 mt-1">+18% YoY</p>
                      </div>
                      <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600"><TrendingUp className="h-5 w-5" /></div>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-stone-200/80 bg-white p-4 sm:p-5 shadow-sm">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wider text-stone-500">{d.preview.roi}</p>
                        <p className="text-2xl font-bold text-stone-900 mt-1">232.0%</p>
                        <p className="text-xs text-stone-500 mt-1">+$33,680</p>
                      </div>
                      <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600"><BarChart3 className="h-5 w-5" /></div>
                    </div>
                  </div>
                </div>

                {/* Tab bar */}
                <div className="rounded-xl border border-stone-200 overflow-hidden">
                  <div className="flex gap-1 p-1.5 bg-stone-50/50 border-b border-stone-100">
                    <span className="rounded-lg px-3 py-1.5 text-sm font-medium bg-stone-900 text-white shadow-sm">{d.preview.tabOverview}</span>
                    <span className="rounded-lg px-3 py-1.5 text-sm font-medium text-stone-600">{d.preview.tabDomains}</span>
                    <span className="rounded-lg px-3 py-1.5 text-sm font-medium text-stone-600">{d.preview.tabTransactions}</span>
                    <span className="hidden sm:inline-flex rounded-lg px-3 py-1.5 text-sm font-medium text-stone-600">{d.preview.tabAnalytics}</span>
                  </div>
                </div>

                {/* Recent Transactions card */}
                <div className="rounded-xl border border-stone-200 overflow-hidden">
                  <div className="px-4 sm:px-5 py-3 sm:py-3.5 border-b border-stone-100">
                    <h3 className="text-sm font-semibold text-stone-900">{d.preview.recentTransactions}</h3>
                  </div>
                  <div className="divide-y divide-stone-100">
                    {sampleTransactions.map((tx, i) => {
                      const tone = tx.type;
                      const iconBg =
                        tone === 'sell' ? 'bg-emerald-50 text-emerald-600' :
                        tone === 'buy' ? 'bg-teal-50 text-teal-600' :
                        'bg-amber-50 text-amber-600';
                      const Icon = tone === 'sell' ? TrendingUp : tone === 'buy' ? Plus : RefreshCw;
                      const amountColor =
                        tone === 'sell' ? 'text-emerald-600' :
                        tone === 'buy' ? 'text-teal-700' :
                        'text-amber-700';
                      return (
                        <div key={i} className="flex items-center justify-between px-4 sm:px-5 py-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className={`shrink-0 flex h-9 w-9 items-center justify-center rounded-xl ${iconBg}`}>
                              <Icon className="h-4 w-4" />
                            </span>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-stone-900 truncate">{tx.domain}</p>
                              <p className="text-xs text-stone-500">{txTypeLabel(tx.type)} · {tx.date}</p>
                            </div>
                          </div>
                          <p className={`shrink-0 ml-3 text-sm font-semibold ${amountColor}`}>{tx.amount}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* 3 captions tying preview to value props */}
            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              {[
                { icon: <RefreshCw className="h-4 w-4" />, text: d.preview.captionRenewal },
                { icon: <PieChart className="h-4 w-4" />, text: d.preview.captionDecisions },
                { icon: <Globe className="h-4 w-4" />, text: d.preview.captionBilingual },
              ].map((c, i) => (
                <div key={i} className="flex items-start gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3.5">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-600">{c.icon}</span>
                  <p className="text-sm text-stone-700">{c.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FEATURES — compressed icon strip */}
        <section className="border-b border-stone-200 bg-white py-12 sm:py-14">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <ul className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {featureStrip.map((f, i) => (
                <li key={i} className="flex items-center gap-3 rounded-xl border border-stone-200 bg-stone-50/60 px-4 py-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-600">{f.icon}</span>
                  <span className="text-sm font-medium text-stone-700">{f.title}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* CTA strip */}
        <section className="bg-stone-900 py-16 sm:py-20">
          <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold text-white sm:text-3xl">{d.home.startJourney}</h2>
            <p className="mt-3 text-lg text-stone-300">{d.home.joinThousands}</p>
            <div className="mt-8 flex justify-center">
              <HomeCtaButtons
                getStartedLabel={d.home.getStarted}
                getStartedAria={d.home.getStarted}
                startFreeLabel={d.home.startFree}
                startFreeAria={d.home.startFree}
                variant="cta"
                className="inline-flex items-center gap-2 rounded-xl bg-teal-500 px-8 py-3.5 text-base font-semibold text-white transition hover:bg-teal-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-300 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-900"
              />
            </div>
          </div>
        </section>
      </main>

      <footer className="text-stone-300 bg-stone-950">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            <div className="lg:col-span-1">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-stone-800">
                  <Globe className="h-5 w-5 text-white" />
                </div>
                <span className="text-lg font-semibold text-white">
                  {d.platform.name}
                </span>
              </div>
              <p className="mt-4 text-sm leading-relaxed">{d.footer.description}</p>
              <div className="mt-4 flex gap-2">
                <span
                  className="flex h-9 w-9 cursor-default items-center justify-center rounded-lg bg-stone-800 text-xs font-medium text-stone-400"
                  title={d.footer.socialComingSoon}
                  aria-label={`Twitter — ${d.footer.socialComingSoon}`}
                >
                  T
                </span>
                <span
                  className="flex h-9 w-9 cursor-default items-center justify-center rounded-lg bg-stone-800 text-xs font-medium text-stone-400"
                  title={d.footer.socialComingSoon}
                  aria-label={`Discord — ${d.footer.socialComingSoon}`}
                >
                  D
                </span>
                <span
                  className="flex h-9 w-9 cursor-default items-center justify-center rounded-lg bg-stone-800 text-xs font-medium text-stone-400"
                  title={d.footer.socialComingSoon}
                  aria-label={`GitHub — ${d.footer.socialComingSoon}`}
                >
                  G
                </span>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-semibold uppercase tracking-wider text-white">
                {d.footer.product}
              </h4>
              <HomeFooterProductLinks
                investmentManagement={d.footer.investmentManagement}
                dataAnalytics={d.footer.dataAnalytics}
                performanceTracking={d.footer.performanceTracking}
              />
            </div>
            <div>
              <h4 className="text-sm font-semibold uppercase tracking-wider text-white">
                {d.footer.support}
              </h4>
              <ul className="mt-4 space-y-2 text-sm">
                <li>
                  <Link href={`/${locale}/changelog`} prefetch className="transition hover:text-white">
                    {d.footer.changelog}
                  </Link>
                </li>
                <li>
                  <Link href={`/${locale}/privacy`} className="transition hover:text-white">
                    {d.footer.privacyPolicy}
                  </Link>
                </li>
                <li>
                  <Link
                    href={`/${locale}/privacy`}
                    className="transition hover:text-white"
                    title={d.footer.termsOfService}
                  >
                    {d.footer.termsOfService}
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold uppercase tracking-wider text-white">
                {d.footer.contact}
              </h4>
              <ul className="mt-4 space-y-2 text-sm">
                <li>
                  <a
                    href="mailto:hello@domain.financial"
                    className="transition hover:text-white"
                  >
                    {d.footer.contactUs}
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-stone-800 pt-8 sm:flex-row">
            <p className="text-xs text-stone-500">
              &copy; {year} Domain.Financial. {d.footer.copyrightSuffix}
            </p>
            <div className="flex gap-6 text-xs">
              <Link href={`/${locale}/privacy`} className="transition hover:text-white">
                {d.footer.privacyShort}
              </Link>
              <Link
                href={`/${locale}/privacy`}
                className="transition hover:text-white"
                title={d.footer.termsOfService}
              >
                {d.footer.termsShort}
              </Link>
              <Link
                href={`/${locale}/privacy`}
                className="transition hover:text-white"
                title={d.footer.cookiesShort}
              >
                {d.footer.cookiesShort}
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
