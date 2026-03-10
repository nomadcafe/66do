'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useI18nContext } from '../../src/contexts/I18nProvider';
import { useSupabaseAuth } from '../../src/contexts/SupabaseAuthContext';
import { Mail, Send, ArrowLeft } from 'lucide-react';

function getSafeRedirect(redirect: string | null): string {
  if (!redirect || typeof redirect !== 'string') return '/dashboard';
  const path = redirect.trim();
  if (path.startsWith('/') && !path.includes('//') && !path.includes(':')) return path;
  return '/dashboard';
}

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const searchParams = useSearchParams();
  const { t, locale, setLocale } = useI18nContext();
  const { user, loading: authLoading } = useSupabaseAuth();
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
      // 发送Magic Link请求
      const response = await fetch('/api/send-magic-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email
        })
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-teal-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('common.backHome')}
        </Link>
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">{t('platform.name')}</h1>
          <p className="mt-2 text-gray-600">{t('platform.subtitle')}</p>
        </div>
        <div className="flex justify-center mt-4">
          <select
            value={locale}
            onChange={(e) => setLocale(e.target.value as 'en' | 'zh')}
            aria-label={locale === 'zh' ? '选择语言' : 'Select language'}
            className="appearance-none bg-white border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
          >
            <option value="zh">中文</option>
            <option value="en">English</option>
          </select>
        </div>
        <h2 className="mt-6 text-center text-2xl font-bold text-gray-900">
          {t('auth.magicLink.title')}
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          {t('auth.magicLink.subtitle')}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div role="alert" className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md">
                {error}
              </div>
            )}

            {success && (
              <div role="status" className="bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded-md">
                {success}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                {t('auth.magicLink.email')}
              </label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="appearance-none block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-teal-500 focus:border-teal-500"
                  placeholder={t('auth.magicLink.emailPlaceholder')}
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                aria-busy={loading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 disabled:opacity-50"
              >
                {loading ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    {t('auth.magicLink.sending')}
                  </div>
                ) : (
                  <div className="flex items-center">
                    <Send className="h-4 w-4 mr-2" />
                    {t('auth.magicLink.submit')}
                  </div>
                )}
              </button>
            </div>

            <div className="text-center">
              <p className="text-sm text-gray-600">
                {t('auth.magicLink.firstTime')}
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
