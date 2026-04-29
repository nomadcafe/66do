'use client';

import { Suspense, useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useI18nContext } from '../../src/contexts/I18nProvider';
import { useSupabaseAuth } from '../../src/contexts/SupabaseAuthContext';
import { AtSign, Mail, Send, ArrowLeft, CheckCircle, AlertCircle } from 'lucide-react';

function getSafeRedirect(redirect: string | null): string {
  if (!redirect || typeof redirect !== 'string') return '/dashboard';
  const path = redirect.trim();
  if (path.startsWith('/') && !path.includes('//') && !path.includes(':')) return path;
  return '/dashboard';
}

function LoginContent() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const searchParams = useSearchParams();
  const { t, locale, setLocale } = useI18nContext();
  const { user, loading: authLoading, signInWithGoogle } = useSupabaseAuth();
  const router = useRouter();
  const redirectTo = getSafeRedirect(searchParams.get('redirect'));

  useEffect(() => {
    if (!authLoading && user) {
      router.replace(redirectTo);
    }
  }, [authLoading, user, router, redirectTo]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/send-magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || t('auth.magicLink.error'));
      } else {
        setSuccess(t('auth.magicLink.success'));
      }
    } catch (err) {
      if (process.env.NODE_ENV === 'development') console.error('Magic Link error:', err);
      setError(t('auth.magicLink.error'));
    }

    setLoading(false);
  };

  if (authLoading || user) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-teal-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-teal-50/50 via-stone-50 to-amber-50/30">
      {/* Decorative corner glows — matches the Hero / empty-state language */}
      <div className="pointer-events-none absolute -top-32 -right-32 h-96 w-96 rounded-full bg-gradient-to-br from-teal-200/30 via-emerald-100/20 to-transparent blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -left-40 h-[28rem] w-[28rem] rounded-full bg-gradient-to-tr from-amber-100/30 to-transparent blur-3xl" />

      {/* Top bar — back link + locale toggle, kept thin so the hero card stays the focus */}
      <div className="relative mx-auto flex max-w-2xl items-center justify-between px-4 pt-6 sm:px-6 sm:pt-8">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm text-stone-600 transition hover:bg-white/60 hover:text-stone-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-1"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('common.backHome')}
        </Link>
        {/* Locale toggle — same pill pattern as DashboardHeader */}
        <div
          role="group"
          aria-label={t('settings.selectLanguage')}
          className="flex items-center gap-0.5 rounded-xl border border-stone-200 bg-white/80 p-1 backdrop-blur-sm"
        >
          <button
            type="button"
            onClick={() => setLocale('zh')}
            aria-pressed={locale === 'zh'}
            className={`rounded-lg px-3 py-1 text-xs font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-1 ${
              locale === 'zh' ? 'bg-stone-900 text-white shadow-sm' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            中文
          </button>
          <button
            type="button"
            onClick={() => setLocale('en')}
            aria-pressed={locale === 'en'}
            className={`rounded-lg px-3 py-1 text-xs font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-1 ${
              locale === 'en' ? 'bg-stone-900 text-white shadow-sm' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            EN
          </button>
        </div>
      </div>

      {/* Main panel — vertically centered card */}
      <div className="relative flex min-h-[calc(100vh-6rem)] flex-col items-center justify-center px-4 py-10 sm:px-6">
        {/* Brand identity */}
        <div className="mb-8 text-center">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-stone-900 text-white shadow-md shadow-stone-900/20">
            <AtSign className="h-7 w-7" />
          </div>
          <h1 className="mt-5 text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl">
            <span>Domain</span>
            <span className="text-teal-600">.Financial</span>
          </h1>
          <p className="mt-2 text-sm text-stone-500">{t('platform.subtitle')}</p>
        </div>

        {/* Auth card */}
        <div className="w-full max-w-md">
          <div className="rounded-3xl border border-stone-200/70 bg-white/95 p-6 shadow-xl shadow-stone-900/5 backdrop-blur-sm sm:p-8">
            <div className="mb-6 text-center">
              <h2 className="text-xl font-semibold text-stone-900">
                {t('auth.magicLink.title')}
              </h2>
              <p className="mt-1.5 text-sm text-stone-500">
                {t('auth.magicLink.subtitle')}
              </p>
            </div>

            <form className="space-y-5" onSubmit={handleSubmit}>
              {error && (
                <div
                  role="alert"
                  className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50/80 px-4 py-3 text-sm text-rose-800"
                >
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {success && (
                <div
                  role="status"
                  className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-800"
                >
                  <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{success}</span>
                </div>
              )}

              {/* Google OAuth */}
              <button
                type="button"
                onClick={() => signInWithGoogle(redirectTo)}
                className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 transition hover:bg-stone-50 hover:border-stone-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden>
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                {t('auth.magicLink.signInWithGoogle')}
              </button>

              {/* Divider */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center" aria-hidden>
                  <div className="w-full border-t border-stone-200" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-white px-3 font-medium uppercase tracking-wider text-stone-400">
                    {locale === 'zh' ? '或' : 'or'}
                  </span>
                </div>
              </div>

              {/* Email input */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-stone-700">
                  {t('auth.magicLink.email')}
                </label>
                <div className="relative mt-1.5">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                    <Mail className="h-4 w-4 text-stone-400" />
                  </div>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full rounded-xl border border-stone-200 bg-white py-2.5 pl-10 pr-3.5 text-sm placeholder-stone-400 transition focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                    placeholder={t('auth.magicLink.emailPlaceholder')}
                  />
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                aria-busy={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-teal-600/25 transition hover:bg-teal-700 hover:shadow-lg hover:shadow-teal-600/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 disabled:opacity-60 disabled:shadow-none"
              >
                {loading ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    {t('auth.magicLink.sending')}
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    {t('auth.magicLink.submit')}
                  </>
                )}
              </button>

              {/* Hint */}
              <p className="text-center text-xs text-stone-500">{t('auth.magicLink.firstTime')}</p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

function LoginFallback() {
  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-teal-500 border-t-transparent" />
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginContent />
    </Suspense>
  );
}
