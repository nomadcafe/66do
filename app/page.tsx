import { cookies, headers } from 'next/headers';
import Link from 'next/link';
import {
  Globe,
  TrendingUp,
  BarChart3,
  Star,
  Shield,
  Zap,
  Target,
  Users,
} from 'lucide-react';
import {
  getHomeDictionary,
  homePageMetadata,
  resolveHomeLocale,
  type HomeLocale,
} from '../src/i18n/homeDictionary';
import HomeHeaderClient from '../src/components/home/HomeHeaderClient';
import HomeCtaButtons from '../src/components/home/HomeCtaButtons';
import HomeFooterProductLinks from '../src/components/home/HomeFooterProductLinks';

export async function generateMetadata() {
  const cookieStore = await cookies();
  const acceptLanguage = (await headers()).get('accept-language');
  const locale = resolveHomeLocale(cookieStore, acceptLanguage);
  return homePageMetadata(locale);
}

export default async function HomePage() {
  const cookieStore = await cookies();
  const acceptLanguage = (await headers()).get('accept-language');
  const locale = resolveHomeLocale(cookieStore, acceptLanguage) as HomeLocale;
  const d = getHomeDictionary(locale);
  const year = new Date().getFullYear();

  const homeFeatures = [
    d.home.feature1,
    d.home.feature2,
    d.home.feature3,
    d.home.feature4,
  ];

  const features = [
    {
      icon: <Globe className="h-7 w-7" />,
      title: d.features.portfolio.title,
      description: d.features.portfolio.desc,
    },
    {
      icon: <TrendingUp className="h-7 w-7" />,
      title: d.features.analytics.title,
      description: d.features.analytics.desc,
    },
    {
      icon: <BarChart3 className="h-7 w-7" />,
      title: d.features.data.title,
      description: d.features.data.desc,
    },
    {
      icon: <Shield className="h-7 w-7" />,
      title: d.features.security.title,
      description: d.features.security.desc,
    },
  ];

  const benefits = [
    {
      icon: <Zap className="h-6 w-6" />,
      title: d.benefits.portfolio.title,
      description: d.benefits.portfolio.desc,
    },
    {
      icon: <Target className="h-6 w-6" />,
      title: d.benefits.analytics.title,
      description: d.benefits.analytics.desc,
    },
    {
      icon: <Users className="h-6 w-6" />,
      title: d.benefits.market.title,
      description: d.benefits.market.desc,
    },
  ];

  return (
    <div
      className="min-h-screen antialiased"
      style={{
        backgroundColor: 'var(--home-bg)',
        color: 'var(--home-text)',
      }}
    >
      <HomeHeaderClient
        initialLocale={locale}
        platformName={d.platform.name}
        selectLanguageLabel={d.settings.selectLanguage}
        signInLabel={d.nav.signIn}
        goToDashboardLabel={d.nav.goToDashboard}
      />

      <main>
        <section
          className="relative overflow-hidden border-b"
          style={{
            borderColor: 'var(--home-border)',
            backgroundColor: 'var(--home-bg-card)',
          }}
        >
          <div
            className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage:
                'radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)',
              backgroundSize: '32px 32px',
            }}
          />
          <div className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8 lg:py-32">
            <div className="mx-auto max-w-3xl text-center">
              <p
                className="mb-6 inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium"
                style={{
                  borderColor: 'rgba(20, 184, 166, 0.35)',
                  backgroundColor: 'rgba(20, 184, 166, 0.08)',
                  color: '#0d9488',
                }}
              >
                <Star className="h-3.5 w-3.5" />
                {d.home.trustedBy}
              </p>
              <h1
                className="mb-6 text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl"
                style={{ color: 'var(--home-text)' }}
              >
                {d.home.title}
              </h1>
              <p
                className="mb-10 text-lg leading-relaxed sm:text-xl"
                style={{ color: 'var(--home-text-muted)' }}
              >
                {d.home.subtitle}
              </p>
              <HomeCtaButtons
                getStartedLabel={d.home.getStarted}
                getStartedAria={d.home.getStarted}
                startFreeLabel={d.home.startFree}
                startFreeAria={d.home.startFree}
                variant="hero"
                className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-teal-600/20 transition hover:bg-teal-700 hover:shadow-teal-600/25"
              />
            </div>
          </div>
        </section>

        <section
          className="border-b py-14 sm:py-16"
          style={{
            backgroundColor: 'var(--home-bg)',
            borderColor: 'var(--home-border)',
          }}
        >
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <ul className="grid gap-3 sm:grid-cols-2 sm:gap-4">
              {homeFeatures.map((text, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 rounded-2xl border p-5 shadow-sm transition hover:shadow-md"
                  style={{
                    borderColor: 'var(--home-border)',
                    backgroundColor: 'var(--home-bg-card)',
                  }}
                >
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-teal-500" />
                  <span
                    className="sm:text-lg"
                    style={{ color: 'var(--home-text-muted)' }}
                  >
                    {text}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section
          className="border-b py-16 sm:py-24"
          style={{
            backgroundColor: 'var(--home-bg-card)',
            borderColor: 'var(--home-border)',
          }}
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="mb-14 text-center">
              <h2
                className="text-3xl font-bold tracking-tight sm:text-4xl"
                style={{ color: 'var(--home-text)' }}
              >
                {d.features.title}
              </h2>
              <p
                className="mx-auto mt-3 max-w-2xl text-lg"
                style={{ color: 'var(--home-text-muted)' }}
              >
                {d.features.subtitle}
              </p>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {features.map((feature, i) => (
                <div
                  key={i}
                  className="group rounded-2xl border p-6 transition hover:shadow-lg"
                  style={{
                    borderColor: 'var(--home-border)',
                    backgroundColor: 'var(--home-bg)',
                  }}
                >
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[#2d2a26] text-white transition group-hover:bg-teal-600">
                    {feature.icon}
                  </div>
                  <h3
                    className="mb-2 text-lg font-semibold"
                    style={{ color: 'var(--home-text)' }}
                  >
                    {feature.title}
                  </h3>
                  <p
                    className="text-sm leading-relaxed"
                    style={{ color: 'var(--home-text-muted)' }}
                  >
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section
          className="border-b py-16 sm:py-24"
          style={{
            backgroundColor: 'var(--home-bg-soft)',
            borderColor: 'var(--home-border)',
          }}
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="mb-14 text-center">
              <h2
                className="text-3xl font-bold tracking-tight sm:text-4xl"
                style={{ color: 'var(--home-text)' }}
              >
                {d.benefits.title}
              </h2>
              <p
                className="mx-auto mt-3 max-w-2xl text-lg"
                style={{ color: 'var(--home-text-muted)' }}
              >
                {d.benefits.subtitle}
              </p>
            </div>
            <div className="grid gap-8 sm:grid-cols-3">
              {benefits.map((benefit, i) => (
                <div
                  key={i}
                  className="rounded-2xl border p-6 text-center shadow-sm transition hover:shadow-md"
                  style={{
                    borderColor: 'var(--home-border)',
                    backgroundColor: 'var(--home-bg-card)',
                  }}
                >
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-teal-100 text-teal-700">
                    {benefit.icon}
                  </div>
                  <h3
                    className="mb-2 text-lg font-semibold"
                    style={{ color: 'var(--home-text)' }}
                  >
                    {benefit.title}
                  </h3>
                  <p
                    className="text-sm"
                    style={{ color: 'var(--home-text-muted)' }}
                  >
                    {benefit.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-16 sm:py-24" style={{ backgroundColor: '#2d2a26' }}>
          <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold text-white sm:text-3xl">
              {d.home.startJourney}
            </h2>
            <p className="mt-3 text-lg text-stone-300">{d.home.joinThousands}</p>
            <div className="mt-8 flex justify-center">
              <HomeCtaButtons
                getStartedLabel={d.home.getStarted}
                getStartedAria={d.home.getStarted}
                startFreeLabel={d.home.startFree}
                startFreeAria={d.home.startFree}
                variant="cta"
                className="inline-flex items-center gap-2 rounded-xl bg-teal-500 px-8 py-3.5 text-base font-semibold text-white transition hover:bg-teal-400"
              />
            </div>
          </div>
        </section>
      </main>

      <footer className="text-stone-300" style={{ backgroundColor: '#1c1917' }}>
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
                  <a
                    href="mailto:hello@domain.financial"
                    className="transition hover:text-white"
                  >
                    {d.footer.contactUs}
                  </a>
                </li>
                <li>
                  <Link href="/privacy" className="transition hover:text-white">
                    {d.footer.privacyPolicy}
                  </Link>
                </li>
                <li>
                  <Link
                    href="/privacy"
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
              <p className="mt-4 flex items-center gap-2 text-sm">
                <span className="h-2 w-2 rounded-full bg-teal-500" />
                hello###domain.financial
              </p>
            </div>
          </div>
          <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-stone-800 pt-8 sm:flex-row">
            <p className="text-xs text-stone-500">
              &copy; {year} Domain.Financial. {d.footer.copyrightSuffix}
            </p>
            <div className="flex gap-6 text-xs">
              <Link href="/privacy" className="transition hover:text-white">
                {d.footer.privacyShort}
              </Link>
              <Link
                href="/privacy"
                className="transition hover:text-white"
                title={d.footer.termsOfService}
              >
                {d.footer.termsShort}
              </Link>
              <Link
                href="/privacy"
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
