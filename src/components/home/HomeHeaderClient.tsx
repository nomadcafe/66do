'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { AtSign } from 'lucide-react';
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
    // router.replace 而非 push：locale 切换不应入历史栈（zh → en 然后按
    // 后退应回到之前那个页面，不是回到 zh 版本本身）。同时省一次 history
    // entry 写入，跳转略快。
    router.replace(nextPath);
  };

  // 把 platformName 拆成 "Domain" + ".Financial" — 与 DashboardHeader 和 Login
  // 页的品牌头同款双色（teal-600 后缀），这样从 marketing 到登录到 dashboard
  // 整条链路品牌字一致。fallback：拆不开就整体 stone-800 显示，避免崩。
  const dotIdx = platformName.indexOf('.');
  const namePart = dotIdx > 0 ? platformName.slice(0, dotIdx) : platformName;
  const tldPart = dotIdx > 0 ? platformName.slice(dotIdx) : '';

  return (
    <header
      className="sticky top-0 z-50 border-b border-stone-200/60 bg-white/90 backdrop-blur-md"
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <Link href={localePrefix || `/${initialLocale}`} className="flex items-center gap-2.5 group">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-stone-800 text-white shadow-sm transition group-hover:bg-stone-700">
            <AtSign className="h-5 w-5" />
          </div>
          <span className="text-lg font-semibold tracking-tight">
            <span className="text-stone-800">{namePart}</span>
            {tldPart && <span className="text-teal-600">{tldPart}</span>}
          </span>
        </Link>
        <div className="flex items-center gap-3">
          {/* Locale toggle — pill group instead of select dropdown.
              Same pattern as DashboardHeader and the Login page so the
              control reads identical end-to-end. */}
          <div
            role="group"
            aria-label={selectLanguageLabel}
            className="flex items-center gap-0.5 rounded-xl border border-stone-200 bg-stone-50/80 p-1"
          >
            <button
              type="button"
              onClick={() => onLocaleChange('zh')}
              aria-pressed={initialLocale === 'zh'}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-1 ${
                initialLocale === 'zh' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              中文
            </button>
            <button
              type="button"
              onClick={() => onLocaleChange('en')}
              aria-pressed={initialLocale === 'en'}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-1 ${
                initialLocale === 'en' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              EN
            </button>
          </div>
          {user ? (
            <Link
              href="/dashboard"
              prefetch
              className="rounded-xl bg-stone-800 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-stone-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
            >
              {goToDashboardLabel}
            </Link>
          ) : (
            <Link
              href="/login"
              prefetch
              className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-medium text-white shadow-md shadow-teal-600/20 transition hover:bg-teal-700 hover:shadow-lg hover:shadow-teal-600/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
            >
              {signInLabel}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
