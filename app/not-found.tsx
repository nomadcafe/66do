'use client';

import Link from 'next/link';
import { Compass, ArrowLeft } from 'lucide-react';
import { useI18nContext } from '../src/contexts/I18nProvider';

export default function NotFound() {
  const { t } = useI18nContext();

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-teal-50/50 via-stone-50 to-amber-50/30 flex flex-col items-center justify-center px-4">
      {/* Decorative corner glows — same language as login / empty state */}
      <div className="pointer-events-none absolute -top-32 -right-32 h-96 w-96 rounded-full bg-gradient-to-br from-teal-200/30 via-emerald-100/20 to-transparent blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -left-40 h-[28rem] w-[28rem] rounded-full bg-gradient-to-tr from-amber-100/30 to-transparent blur-3xl" />

      <div className="relative text-center max-w-md">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-stone-900 text-white shadow-md shadow-stone-900/20">
          <Compass className="h-8 w-8" />
        </div>
        <p className="mt-6 text-sm font-semibold uppercase tracking-[0.2em] text-stone-400">
          404
        </p>
        <h1 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight text-stone-900">
          {t('common.notFoundTitle')}
        </h1>
        <p className="mt-3 text-base text-stone-600">
          {t('common.notFoundMessage')}
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex items-center gap-2 rounded-xl bg-teal-600 px-6 py-3 text-sm font-semibold text-white shadow-md shadow-teal-600/25 transition hover:bg-teal-700 hover:shadow-lg hover:shadow-teal-600/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('common.backHome')}
        </Link>
      </div>
    </div>
  );
}
