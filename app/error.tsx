'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react';
import { useI18nContext } from '../src/contexts/I18nProvider';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useI18nContext();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-rose-50/40 via-stone-50 to-amber-50/30 flex flex-col items-center justify-center px-4">
      <div className="pointer-events-none absolute -top-32 -right-32 h-96 w-96 rounded-full bg-gradient-to-br from-rose-200/30 to-transparent blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -left-40 h-[28rem] w-[28rem] rounded-full bg-gradient-to-tr from-amber-100/30 to-transparent blur-3xl" />

      <div className="relative text-center max-w-md">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-100 text-rose-700">
          <AlertTriangle className="h-8 w-8" />
        </div>
        <h1 className="mt-6 text-3xl sm:text-4xl font-bold tracking-tight text-stone-900">
          {t('common.errorTitle')}
        </h1>
        <p className="mt-3 text-base text-stone-600">
          {t('common.errorMessage')}
        </p>
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-6 py-3 text-sm font-semibold text-white shadow-md shadow-teal-600/25 transition hover:bg-teal-700 hover:shadow-lg hover:shadow-teal-600/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
          >
            <RefreshCw className="h-4 w-4" />
            {t('common.retry')}
          </button>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-xl border border-stone-300 bg-white px-6 py-3 text-sm font-semibold text-stone-700 transition hover:bg-stone-50 hover:border-stone-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('common.backHome')}
          </Link>
        </div>
      </div>
    </div>
  );
}
