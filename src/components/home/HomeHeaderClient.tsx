'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Globe } from 'lucide-react';
import { useSupabaseAuth } from '../../contexts/SupabaseAuthContext';
import {
  LOCALE_COOKIE,
  type HomeLocale,
} from '../../i18n/homeDictionary';

interface HomeHeaderClientProps {
  initialLocale: HomeLocale;
  /** 营销站路径前缀，如 `/zh`、`/en` */
  localePrefix: string;
  platformName: string;
  selectLanguageLabel: string;
  signInLabel: string;
  goToDashboardLabel: string;
}

function setLocaleCookie(locale: HomeLocale) {
  if (typeof document === 'undefined') return;
  document.cookie = `${LOCALE_COOKIE}=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`;
  try {
    localStorage.setItem('domain_financial_locale', locale);
  } catch {
    /* ignore */
  }
}

export default function HomeHeaderClient({
  initialLocale,
  localePrefix,
  platformName,
  selectLanguageLabel,
  signInLabel,
  goToDashboardLabel,
}: HomeHeaderClientProps) {
  const { user } = useSupabaseAuth();
  const router = useRouter();
  const pathname = usePathname();

  const onLocaleChange = (newLocale: HomeLocale) => {
    setLocaleCookie(newLocale);
    const nextPath =
      (pathname && /^\/(zh|en)(\/|$)/.test(pathname)
        ? pathname.replace(/^\/(zh|en)(?=\/|$)/, `/${newLocale}`)
        : `/${newLocale}`) || `/${newLocale}`;
    router.push(nextPath);
  };

  return (
    <header
      className="sticky top-0 z-50 border-b backdrop-blur-md"
      style={{
        borderColor: 'var(--home-border)',
        backgroundColor: 'var(--home-header-bg)',
      }}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <Link href={localePrefix || `/${initialLocale}`} className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#2d2a26] text-white shadow-sm">
            <Globe className="h-5 w-5" />
          </div>
          <span
            className="text-lg font-semibold tracking-tight"
            style={{ color: 'var(--home-text)' }}
          >
            {platformName}
          </span>
        </Link>
        <div className="flex items-center gap-3 sm:gap-5">
          <select
            value={initialLocale}
            onChange={(e) =>
              onLocaleChange(e.target.value as HomeLocale)
            }
            aria-label={selectLanguageLabel}
            className="rounded-lg border bg-white px-2.5 py-1.5 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
            style={{
              borderColor: 'var(--home-border)',
              color: 'var(--home-text)',
            }}
          >
            <option value="zh">中文</option>
            <option value="en">English</option>
          </select>
          {user ? (
            <Link
              href="/dashboard"
              prefetch
              className="rounded-xl bg-[#2d2a26] px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[#1c1917]"
            >
              {goToDashboardLabel}
            </Link>
          ) : (
            <Link
              href="/login"
              prefetch
              className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-teal-700"
            >
              {signInLabel}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
