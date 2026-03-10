'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSupabaseAuth } from '../src/contexts/SupabaseAuthContext';
import { useI18nContext } from '../src/contexts/I18nProvider';
import {
  Globe,
  TrendingUp,
  BarChart3,
  ArrowRight,
  Shield,
  Star,
  Zap,
  Target,
  Users,
} from 'lucide-react';

export default function HomePage() {
  const { user } = useSupabaseAuth();
  const { t, locale, setLocale } = useI18nContext();
  const router = useRouter();

  const features = [
    {
      icon: <Globe className="h-7 w-7" />,
      title: t('features.portfolio.title'),
      description: t('features.portfolio.desc'),
    },
    {
      icon: <TrendingUp className="h-7 w-7" />,
      title: t('features.analytics.title'),
      description: t('features.analytics.desc'),
    },
    {
      icon: <BarChart3 className="h-7 w-7" />,
      title: t('features.data.title'),
      description: t('features.data.desc'),
    },
    {
      icon: <Shield className="h-7 w-7" />,
      title: t('features.security.title'),
      description: t('features.security.desc'),
    },
  ];

  const benefits = [
    {
      icon: <Zap className="h-6 w-6" />,
      title: t('benefits.portfolio.title'),
      description: t('benefits.portfolio.desc'),
    },
    {
      icon: <Target className="h-6 w-6" />,
      title: t('benefits.analytics.title'),
      description: t('benefits.analytics.desc'),
    },
    {
      icon: <Users className="h-6 w-6" />,
      title: t('benefits.market.title'),
      description: t('benefits.market.desc'),
    },
  ];

  const homeFeatures = [
    { text: t('home.feature1') },
    { text: t('home.feature2') },
    { text: t('home.feature3') },
    { text: t('home.feature4') },
  ];

  const handleGetStarted = () => {
    if (user) {
      router.push('/dashboard');
    } else {
      router.push('/login');
    }
  };

  return (
    <div className="min-h-screen antialiased" style={{ backgroundColor: 'var(--home-bg)', color: 'var(--home-text)' }}>
      {/* ─── Navigation ───────────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-50 border-b backdrop-blur-md"
        style={{ borderColor: 'var(--home-border)', backgroundColor: 'rgba(250, 249, 246, 0.92)' }}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#2d2a26] text-white shadow-sm">
              <Globe className="h-5 w-5" />
            </div>
            <span className="text-lg font-semibold tracking-tight" style={{ color: 'var(--home-text)' }}>
              {t('platform.name')}
            </span>
          </Link>
          <div className="flex items-center gap-3 sm:gap-5">
            <select
              value={locale}
              onChange={(e) => setLocale(e.target.value as 'en' | 'zh')}
              aria-label={locale === 'zh' ? '选择语言' : 'Select language'}
              className="rounded-lg border bg-white px-2.5 py-1.5 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              style={{ borderColor: 'var(--home-border)', color: 'var(--home-text)' }}
            >
              <option value="zh">中文</option>
              <option value="en">English</option>
            </select>
            {user ? (
              <button
                onClick={() => router.push('/dashboard')}
                className="rounded-xl bg-[#2d2a26] px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[#1c1917]"
              >
                {t('nav.goToDashboard')}
              </button>
            ) : (
              <a
                href="/login"
                className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-teal-700"
              >
                {t('auth.magicLink.title')}
              </a>
            )}
          </div>
        </div>
      </header>

      {/* ─── Hero ─────────────────────────────────────────────────────── */}
      <section
        className="relative overflow-hidden border-b"
        style={{ borderColor: 'var(--home-border)', backgroundColor: 'var(--home-bg-card)' }}
      >
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)',
            backgroundSize: '32px 32px',
          }}
        />
        <div className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8 lg:py-32">
          <div className="mx-auto max-w-3xl text-center">
            <p
              className="mb-6 inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium"
              style={{ borderColor: 'rgba(20, 184, 166, 0.35)', backgroundColor: 'rgba(20, 184, 166, 0.08)', color: '#0d9488' }}
            >
              <Star className="h-3.5 w-3.5" />
              {t('home.trustedBy')}
            </p>
            <h1 className="mb-6 text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl" style={{ color: 'var(--home-text)' }}>
              {t('home.title')}
            </h1>
            <p className="mb-10 text-lg leading-relaxed sm:text-xl" style={{ color: 'var(--home-text-muted)' }}>
              {t('home.subtitle')}
            </p>
            <button
              onClick={handleGetStarted}
              aria-label={t('home.getStarted')}
              className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-teal-600/20 transition hover:bg-teal-700 hover:shadow-teal-600/25"
            >
              {t('home.getStarted')}
              <ArrowRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      </section>

      {/* ─── Key points (home features) ───────────────────────────────── */}
      <section className="border-b py-14 sm:py-16" style={{ backgroundColor: 'var(--home-bg)', borderColor: 'var(--home-border)' }}>
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <ul className="grid gap-3 sm:grid-cols-2 sm:gap-4">
            {homeFeatures.map((feature, i) => (
              <li
                key={i}
                className="flex items-start gap-3 rounded-2xl border p-5 shadow-sm transition hover:shadow-md"
                style={{ borderColor: 'var(--home-border)', backgroundColor: 'var(--home-bg-card)' }}
              >
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-teal-500" />
                <span className="sm:text-lg" style={{ color: 'var(--home-text-muted)' }}>{feature.text}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ─── Features grid ────────────────────────────────────────────── */}
      <section className="border-b py-16 sm:py-24" style={{ backgroundColor: 'var(--home-bg-card)', borderColor: 'var(--home-border)' }}>
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="mb-14 text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl" style={{ color: 'var(--home-text)' }}>
              {t('features.title')}
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-lg" style={{ color: 'var(--home-text-muted)' }}>
              {t('features.subtitle')}
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature, i) => (
              <div
                key={i}
                className="group rounded-2xl border p-6 transition hover:shadow-lg"
                style={{ borderColor: 'var(--home-border)', backgroundColor: 'var(--home-bg)' }}
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[#2d2a26] text-white transition group-hover:bg-teal-600">
                  {feature.icon}
                </div>
                <h3 className="mb-2 text-lg font-semibold" style={{ color: 'var(--home-text)' }}>
                  {feature.title}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--home-text-muted)' }}>
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Benefits ─────────────────────────────────────────────────── */}
      <section className="border-b py-16 sm:py-24" style={{ backgroundColor: 'var(--home-bg-soft)', borderColor: 'var(--home-border)' }}>
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="mb-14 text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl" style={{ color: 'var(--home-text)' }}>
              {t('benefits.title')}
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-lg" style={{ color: 'var(--home-text-muted)' }}>
              {t('benefits.subtitle')}
            </p>
          </div>
          <div className="grid gap-8 sm:grid-cols-3">
            {benefits.map((benefit, i) => (
              <div
                key={i}
                className="rounded-2xl border p-6 text-center shadow-sm transition hover:shadow-md"
                style={{ borderColor: 'var(--home-border)', backgroundColor: 'var(--home-bg-card)' }}
              >
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-teal-100 text-teal-700">
                  {benefit.icon}
                </div>
                <h3 className="mb-2 text-lg font-semibold" style={{ color: 'var(--home-text)' }}>
                  {benefit.title}
                </h3>
                <p className="text-sm" style={{ color: 'var(--home-text-muted)' }}>{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA ──────────────────────────────────────────────────────── */}
      <section className="py-16 sm:py-24" style={{ backgroundColor: '#2d2a26' }}>
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-white sm:text-3xl">
            {t('home.startJourney')}
          </h2>
          <p className="mt-3 text-lg text-stone-300">
            {t('home.joinThousands')}
          </p>
          <button
            onClick={handleGetStarted}
            aria-label={t('home.startFree')}
            className="mt-8 inline-flex items-center gap-2 rounded-xl bg-teal-500 px-8 py-3.5 text-base font-semibold text-white transition hover:bg-teal-400"
          >
            {t('home.startFree')}
            <ArrowRight className="h-5 w-5" />
          </button>
        </div>
      </section>

      {/* ─── Footer ──────────────────────────────────────────────────── */}
      <footer className="text-stone-300" style={{ backgroundColor: '#1c1917' }}>
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            <div className="lg:col-span-1">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-stone-800">
                  <Globe className="h-5 w-5 text-white" />
                </div>
                <span className="text-lg font-semibold text-white">
                  {t('platform.name')}
                </span>
              </div>
              <p className="mt-4 text-sm leading-relaxed">
                {t('footer.description')}
              </p>
              <div className="mt-4 flex gap-2">
                <a href="#" aria-label="Twitter" title={locale === 'zh' ? '即将推出' : 'Coming soon'} className="flex h-9 w-9 items-center justify-center rounded-lg bg-stone-800 text-xs font-medium text-stone-400 transition hover:bg-stone-700">
                  T
                </a>
                <a href="#" aria-label="Discord" title={locale === 'zh' ? '即将推出' : 'Coming soon'} className="flex h-9 w-9 items-center justify-center rounded-lg bg-stone-800 text-xs font-medium text-stone-400 transition hover:bg-stone-700">
                  D
                </a>
                <a href="#" aria-label="GitHub" title={locale === 'zh' ? '即将推出' : 'Coming soon'} className="flex h-9 w-9 items-center justify-center rounded-lg bg-stone-800 text-xs font-medium text-stone-400 transition hover:bg-stone-700">
                  G
                </a>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-semibold uppercase tracking-wider text-white">
                {t('footer.product')}
              </h4>
              <ul className="mt-4 space-y-2 text-sm">
                <li>
                  <a href="/dashboard" className="transition hover:text-white">
                    {t('footer.investmentManagement')}
                  </a>
                </li>
                <li>
                  <a href="/dashboard" className="transition hover:text-white">
                    {t('footer.dataAnalytics')}
                  </a>
                </li>
                <li>
                  <a href="/dashboard" className="transition hover:text-white">
                    {t('footer.performanceTracking')}
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold uppercase tracking-wider text-white">
                {t('footer.support')}
              </h4>
              <ul className="mt-4 space-y-2 text-sm">
                <li>
                  <a href="mailto:hello@domain.financial" className="transition hover:text-white">
                    {t('footer.contactUs')}
                  </a>
                </li>
                <li>
                  <a href="/privacy" className="transition hover:text-white">
                    {t('footer.privacyPolicy')}
                  </a>
                </li>
                <li>
                  <a href="/privacy" className="transition hover:text-white" title={locale === 'zh' ? '条款即将推出' : 'Terms coming soon'}>
                    {locale === 'zh' ? '服务条款' : 'Terms of Service'}
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold uppercase tracking-wider text-white">
                {t('footer.contact')}
              </h4>
              <p className="mt-4 flex items-center gap-2 text-sm">
                <span className="h-2 w-2 rounded-full bg-teal-500" />
                hello###domain.financial
              </p>
            </div>
          </div>
          <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-stone-800 pt-8 sm:flex-row">
            <p className="text-xs text-stone-500">
              &copy; 2025 Domain.Financial. All rights reserved.
            </p>
            <div className="flex gap-6 text-xs">
              <a href="/privacy" className="transition hover:text-white">
                Privacy
              </a>
              <a href="/privacy" className="transition hover:text-white" title={locale === 'zh' ? '条款即将推出' : 'Terms coming soon'}>
                Terms
              </a>
              <a href="/privacy" className="transition hover:text-white" title={locale === 'zh' ? 'Cookie 说明即将推出' : 'Cookies info coming soon'}>
                Cookies
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
