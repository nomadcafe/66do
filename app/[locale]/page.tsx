import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  Globe,
  TrendingUp,
  BarChart3,
  Star,
  Shield,
  RefreshCw,
  PieChart,
} from 'lucide-react';
import {
  getHomeDictionary,
  homePageMetadata,
  type HomeLocale,
} from '../../src/i18n/homeDictionary';
import { isHomeLocale } from '../../src/i18n/localePath';
import { getSiteUrl } from '../../src/lib/siteUrl';
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

  // JSON-LD structured data — feeds Google brand panel / Sitelinks search box.
  // WebSite gives the searchable site identity (potential Sitelinks search box,
  // though that requires an internal search endpoint we don't have yet);
  // Organization establishes the brand entity for Knowledge Graph linking.
  // Both reference the same canonical URL so Google can collapse them.
  const siteUrl = getSiteUrl().href.replace(/\/$/, '');
  const localeUrl = `${siteUrl}/${locale}`;
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      '@id': `${siteUrl}/#website`,
      name: 'Domain.Financial',
      url: siteUrl,
      description: d.home.subtitle,
      inLanguage: locale === 'zh' ? 'zh-CN' : 'en',
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      '@id': `${siteUrl}/#organization`,
      name: 'Domain.Financial',
      url: siteUrl,
      logo: `${siteUrl}/favicon.png`,
      image: `${siteUrl}/domainfinancial_og.png`,
      description: d.home.subtitle,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      '@id': `${siteUrl}/#app`,
      name: 'Domain.Financial',
      url: localeUrl,
      applicationCategory: 'FinanceApplication',
      operatingSystem: 'Web',
      description: d.home.subtitle,
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
      },
    },
  ];

  return (
    <div className="min-h-screen antialiased bg-stone-50 text-stone-900">
      {/* JSON-LD: rendered as a single script per Google's recommendation;
          @id cross-references let crawlers stitch the three nodes into one
          entity graph instead of seeing them as unrelated objects. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
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

              {/* Right: dual-metric Hero preview, mirrors PortfolioHealthCard. */}
              <div aria-hidden="true" className="relative mx-auto w-full max-w-md lg:max-w-none">
                <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-to-br from-teal-100/60 via-emerald-100/40 to-transparent blur-2xl" />
                <div className="relative overflow-hidden rounded-3xl border border-stone-200/60 bg-gradient-to-br from-teal-50/50 via-white to-amber-50/40 p-6 shadow-xl shadow-stone-900/5">
                  <div className="pointer-events-none absolute -top-16 -right-16 h-44 w-44 rounded-full bg-gradient-to-br from-teal-200/40 to-transparent blur-3xl" />
                  <div className="relative">
                    {/* Top: dual metrics side-by-side */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-500">
                          {d.preview.realizedPnL}
                        </p>
                        <p className="mt-1 text-3xl font-bold tracking-tight tabular-nums text-emerald-600">
                          +$12,450
                        </p>
                        <p className="mt-1 text-xs text-stone-500">
                          {d.preview.fromSales.replace('{n}', '7')}
                        </p>
                      </div>
                      <div className="border-l border-stone-200/70 pl-4">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-500">
                          {d.preview.portfolioAtCost}
                        </p>
                        <p className="mt-1 text-3xl font-bold tracking-tight tabular-nums text-stone-900">
                          $48,300
                        </p>
                        <p className="mt-1 text-xs text-stone-500">
                          {d.preview.activeListed.replace('{a}', '12').replace('{l}', '3')}
                        </p>
                      </div>
                    </div>

                    {/* Sparkline */}
                    <svg viewBox="0 0 200 60" className="mt-5 h-16 w-full" preserveAspectRatio="none" role="img">
                      <defs>
                        <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
                          <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      <path d={sparkArea} fill="url(#sparkGrad)" />
                      <path d={sparkPath} fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>

                    {/* Footer chips */}
                    <div className="mt-5 grid grid-cols-3 gap-3 border-t border-stone-200/70 pt-4">
                      <div className="flex items-center gap-2">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-stone-100 text-stone-700">
                          <Globe className="h-3.5 w-3.5" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-[10px] font-medium uppercase tracking-wider text-stone-500">{d.preview.totalDomains}</p>
                          <p className="text-sm font-semibold text-stone-900 tabular-nums">28</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
                          <BarChart3 className="h-3.5 w-3.5" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-[10px] font-medium uppercase tracking-wider text-stone-500">{d.preview.roi}</p>
                          <p className="text-sm font-semibold text-emerald-600 tabular-nums">+86%</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
                          <RefreshCw className="h-3.5 w-3.5" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-[10px] font-medium uppercase tracking-wider text-stone-500">YTD</p>
                          <p className="text-sm font-semibold text-stone-900 tabular-nums">$580</p>
                        </div>
                      </div>
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

            {/* Mock dashboard frame — mirrors the redesigned dashboard:
                  Hero card (dual metric + sparkline + composition donut)
                → Tab nav (Portfolio/Activity/Insights)
                → Action Lane (3-row alert panel)
                → Status chip strip
                → DomainCard list (with status edge stripe)
                Numbers/labels are aspirational sample data, not real. */}
            <div aria-hidden="true" className="rounded-2xl border border-stone-200 bg-white shadow-xl shadow-stone-900/5 overflow-hidden">
              {/* Window chrome */}
              <div className="flex items-center gap-1.5 border-b border-stone-100 bg-stone-50/80 px-4 py-2.5">
                <span className="h-2.5 w-2.5 rounded-full bg-stone-300" />
                <span className="h-2.5 w-2.5 rounded-full bg-stone-300" />
                <span className="h-2.5 w-2.5 rounded-full bg-stone-300" />
                <span className="ml-3 text-xs text-stone-400">domain.financial / dashboard</span>
              </div>

              <div className="bg-stone-50/30 p-4 sm:p-6 space-y-4 sm:space-y-5">
                {/* Tab nav — sits ABOVE the hero in the real dashboard too. */}
                <div className="rounded-2xl border border-stone-200 bg-white shadow-sm overflow-hidden">
                  <div className="flex gap-1 p-1.5 bg-stone-50/50 border-b border-stone-100">
                    <span className="rounded-lg px-3 py-1.5 text-sm font-medium bg-stone-900 text-white shadow-sm">{d.preview.tabPortfolio}</span>
                    <span className="rounded-lg px-3 py-1.5 text-sm font-medium text-stone-600">{d.preview.tabActivity}</span>
                    <span className="rounded-lg px-3 py-1.5 text-sm font-medium text-stone-600">{d.preview.tabInsights}</span>
                  </div>
                </div>

                {/* Hero card — gradient + dual metrics + sparkline + footer chips */}
                <div className="relative overflow-hidden rounded-3xl border border-stone-200/60 bg-gradient-to-br from-teal-50/50 via-white to-amber-50/40 shadow-md">
                  <div className="pointer-events-none absolute -top-20 -right-20 h-48 w-48 rounded-full bg-gradient-to-br from-teal-200/40 to-transparent blur-3xl" />
                  <div className="relative p-5 sm:p-6">
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-[1.5fr_1fr_auto] sm:items-start sm:gap-8">
                      {/* Realized P&L */}
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-500">{d.preview.realizedPnL}</p>
                        <p className="mt-1 text-3xl font-bold tracking-tight tabular-nums text-emerald-600 sm:text-4xl">
                          +$12,450
                        </p>
                        <p className="mt-1 text-xs text-stone-500">
                          {d.preview.fromSales.replace('{n}', '7')}
                          <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                            <TrendingUp className="h-3 w-3" /> +$2.1k
                          </span>
                        </p>
                      </div>
                      {/* Portfolio at Cost */}
                      <div className="sm:border-l sm:border-stone-200/70 sm:pl-6">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-500">{d.preview.portfolioAtCost}</p>
                        <p className="mt-1 text-2xl font-bold tracking-tight tabular-nums text-stone-900 sm:text-3xl">
                          $48,300
                        </p>
                        <p className="mt-1 text-xs text-stone-500">
                          {d.preview.activeListed.replace('{a}', '12').replace('{l}', '3')}
                        </p>
                      </div>
                      {/* Composition donut + legend */}
                      <div className="flex items-start gap-3 sm:flex-col sm:items-end sm:gap-2">
                        <svg viewBox="0 0 100 100" className="h-16 w-16 shrink-0 -rotate-90">
                          <circle cx="50" cy="50" r="40" fill="none" stroke="#f5f5f4" strokeWidth="14" />
                          {/* 12 active (60%) teal, 3 listed (15%) amber, 5 sold (25%) emerald */}
                          <circle cx="50" cy="50" r="40" fill="none" stroke="#0d9488" strokeWidth="14"
                            strokeDasharray="150.7 100.5" strokeDashoffset="0" />
                          <circle cx="50" cy="50" r="40" fill="none" stroke="#f59e0b" strokeWidth="14"
                            strokeDasharray="37.7 213.7" strokeDashoffset="-150.7" />
                          <circle cx="50" cy="50" r="40" fill="none" stroke="#10b981" strokeWidth="14"
                            strokeDasharray="62.8 188.5" strokeDashoffset="-188.4" />
                        </svg>
                        <div className="space-y-1 text-xs">
                          <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-teal-600" /><span className="text-stone-600">12 {d.preview.statusActive.toLowerCase()}</span></div>
                          <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-500" /><span className="text-stone-600">3 {d.preview.statusForSale.toLowerCase()}</span></div>
                          <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" /><span className="text-stone-600">7 {d.preview.statusSold.toLowerCase()}</span></div>
                        </div>
                      </div>
                    </div>
                    {/* Mini sparkline */}
                    <svg viewBox="0 0 200 60" className="mt-5 h-12 w-full" preserveAspectRatio="none" role="img">
                      <defs>
                        <linearGradient id="mockSparkGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10b981" stopOpacity="0.22" />
                          <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      <path d={sparkArea} fill="url(#mockSparkGrad)" />
                      <path d={sparkPath} fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </div>

                {/* Action Lane — 3-row alert panel */}
                <div className="rounded-2xl border border-stone-200/70 bg-white shadow-sm overflow-hidden">
                  {[
                    { iconBg: 'bg-rose-100 text-rose-700', Icon: RefreshCw, title: d.preview.actionExpiringTitle, primary: d.preview.actionExpiringPrimary, cta: d.preview.actionCtaReview },
                    { iconBg: 'bg-emerald-100 text-emerald-700', Icon: TrendingUp, title: d.preview.actionRecentTitle, primary: d.preview.actionRecentPrimary, cta: d.preview.actionCtaView },
                    { iconBg: 'bg-amber-100 text-amber-700', Icon: BarChart3, title: d.preview.actionStuckTitle, primary: d.preview.actionStuckPrimary, cta: d.preview.actionCtaReview },
                  ].map((row, i) => (
                    <div key={i} className={`flex items-center gap-4 px-4 py-3 sm:px-5 ${i > 0 ? 'border-t border-stone-100' : ''}`}>
                      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${row.iconBg}`}>
                        <row.Icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">{row.title}</p>
                        <p className="mt-0.5 text-sm font-semibold text-stone-900 truncate">{row.primary}</p>
                      </div>
                      <span className="hidden sm:inline-flex shrink-0 rounded-lg bg-stone-900 px-3 py-1.5 text-xs font-medium text-white">
                        {row.cta}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Status chip strip */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-2 rounded-full bg-stone-900 text-white px-3.5 py-1.5 text-sm font-medium">All<span className="text-xs opacity-90">22</span></span>
                  <span className="inline-flex items-center gap-2 rounded-full bg-teal-50 border border-teal-100 text-teal-700 px-3.5 py-1.5 text-sm font-medium">{d.preview.statusActive}<span className="text-xs opacity-70">12</span></span>
                  <span className="inline-flex items-center gap-2 rounded-full bg-amber-50 border border-amber-100 text-amber-700 px-3.5 py-1.5 text-sm font-medium">{d.preview.statusForSale}<span className="text-xs opacity-70">3</span></span>
                  <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-700 px-3.5 py-1.5 text-sm font-medium">{d.preview.statusSold}<span className="text-xs opacity-70">7</span></span>
                </div>

                {/* Sample DomainCards — with status edge stripe */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  {/* Sold — emerald edge, profit headline */}
                  <div className="rounded-2xl border border-stone-200/80 border-l-4 border-l-emerald-500 bg-white p-4 sm:p-5 shadow-sm">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-stone-100 flex items-center justify-center text-stone-600 shrink-0"><Globe className="h-5 w-5" /></div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-stone-900 truncate">crypto.xyz</p>
                        <p className="text-xs text-stone-500">GoDaddy</p>
                      </div>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-100 text-emerald-700 shrink-0">{d.preview.statusSold}</span>
                    </div>
                    <div className="mt-3 rounded-xl bg-emerald-50/70 border border-emerald-200/80 p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-700/80">Net profit</p>
                      <p className="mt-0.5 text-xl font-bold tabular-nums text-emerald-700">+$8,210</p>
                      <p className="mt-1 text-xs text-emerald-700/70">{d.preview.domainSold.replace('{price}', '8,400').replace('{roi}', '4,210')}</p>
                    </div>
                  </div>
                  {/* Active — teal edge, total holding cost */}
                  <div className="rounded-2xl border border-stone-200/80 border-l-4 border-l-teal-500 bg-white p-4 sm:p-5 shadow-sm">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-stone-100 flex items-center justify-center text-stone-600 shrink-0"><Globe className="h-5 w-5" /></div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-stone-900 truncate">portfolio.dev</p>
                        <p className="text-xs text-stone-500">Cloudflare</p>
                      </div>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-teal-100 text-teal-700 shrink-0">{d.preview.statusActive}</span>
                    </div>
                    <div className="mt-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-500">Total holding cost</p>
                      <p className="mt-0.5 text-xl font-bold tabular-nums text-stone-900">$56</p>
                      <p className="mt-1 text-xs text-stone-500">{d.preview.domainHolding.replace('{cost}', '56').replace('{n}', '2')}</p>
                    </div>
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

      </main>

      <footer className="text-stone-300 bg-stone-950">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
          {/* 12-col grid 让 logo 列占 5 给描述留呼吸，product/support 各 3-4。
              旧 4 列均分时 Contact 列只有 1 个邮箱链接显得空旷，与中间 2
              列 3 行内容严重失衡；合并 Contact 到 Support 末尾、socials 占
              位（T/D/G）暂去，等真有链接再加，让 footer 更整齐。 */}
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-12">
            <div className="lg:col-span-5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-stone-800">
                  <Globe className="h-5 w-5 text-white" />
                </div>
                <span className="text-lg font-semibold text-white">
                  {d.platform.name}
                </span>
              </div>
              <p className="mt-4 text-sm leading-relaxed max-w-md">{d.footer.description}</p>
            </div>
            <div className="lg:col-span-3">
              <h4 className="text-sm font-semibold uppercase tracking-wider text-white">
                {d.footer.product}
              </h4>
              <HomeFooterProductLinks
                investmentManagement={d.footer.investmentManagement}
                dataAnalytics={d.footer.dataAnalytics}
                performanceTracking={d.footer.performanceTracking}
              />
            </div>
            <div className="lg:col-span-4">
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
                    href={`/${locale}/terms`}
                    className="transition hover:text-white"
                    title={d.footer.termsOfService}
                  >
                    {d.footer.termsOfService}
                  </Link>
                </li>
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
            <div className="flex items-center gap-5">
              {/* X (formerly Twitter) — handle @domainverse. Lucide's `X` is
                  the close icon, not the brand mark, so the logo is inlined
                  as SVG. Keep it as the only social until a second channel
                  is actually being maintained. */}
              <a
                href="https://x.com/domainverse"
                target="_blank"
                rel="noopener noreferrer"
                aria-label={d.footer.followOnX}
                title={d.footer.followOnX}
                className="text-stone-400 transition hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-950 rounded"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
              <div className="flex gap-6 text-xs">
                <Link href={`/${locale}/privacy`} className="transition hover:text-white">
                  {d.footer.privacyShort}
                </Link>
                <Link
                  href={`/${locale}/terms`}
                  className="transition hover:text-white"
                  title={d.footer.termsOfService}
                >
                  {d.footer.termsShort}
                </Link>
                <Link
                  href={`/${locale}/cookies`}
                  className="transition hover:text-white"
                  title={d.footer.cookiesShort}
                >
                  {d.footer.cookiesShort}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
