'use client';

import Link from 'next/link';
import { useI18nContext } from '../src/contexts/I18nProvider';

export default function NotFound() {
  const { t } = useI18nContext();

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center px-4">
      <h1 className="text-4xl font-bold text-stone-800 mt-4">
        {t('common.notFoundTitle')}
      </h1>
      <p className="text-stone-600 mt-2 text-center max-w-md">
        {t('common.notFoundMessage')}
      </p>
      <Link
        href="/"
        className="mt-8 px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
      >
        {t('common.backHome')}
      </Link>
    </div>
  );
}
