'use client';

import { useEffect } from 'react';
import Link from 'next/link';
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
    <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center px-4">
      <h1 className="text-4xl font-bold text-stone-800 mt-4">
        {t('common.errorTitle')}
      </h1>
      <p className="text-stone-600 mt-2 text-center max-w-md">
        {t('common.errorMessage')}
      </p>
      <div className="mt-8 flex gap-4">
        <button
          type="button"
          onClick={reset}
          className="px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
        >
          {t('common.retry')}
        </button>
        <Link
          href="/"
          className="px-6 py-3 border border-stone-300 text-stone-700 rounded-lg hover:bg-stone-100 transition-colors"
        >
          {t('common.backHome')}
        </Link>
      </div>
    </div>
  );
}
