'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useI18nContext } from '../../../src/contexts/I18nProvider';
import { supabase } from '../../../src/lib/supabase';

function getSafeRedirect(redirect: string | null): string {
  if (!redirect || typeof redirect !== 'string') return '/dashboard';
  const path = redirect.trim();
  if (path.startsWith('/') && !path.includes('//') && !path.includes(':')) return path;
  return '/dashboard';
}

function AuthCallbackContent() {
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useI18nContext();

  useEffect(() => {
    const handleCallback = async () => {
      const hash = typeof window !== 'undefined' ? window.location.hash : '';
      const params = new URLSearchParams(hash.replace(/^#/, ''));
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');

      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (error) {
          setErrorMessage(error.message);
          setStatus('error');
          return;
        }
        const redirectTo = getSafeRedirect(searchParams.get('redirect'));
        setStatus('ok');
        router.replace(redirectTo);
      } else {
        const redirectTo = getSafeRedirect(searchParams.get('redirect'));
        router.replace(redirectTo);
      }
    };

    handleCallback();
  }, [router, searchParams]);

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center py-12 px-4">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg max-w-md">
          {errorMessage || t('auth.magicLink.loginFailed')}
        </div>
        <button
          type="button"
          onClick={() => router.push('/login')}
          className="mt-4 text-sm font-medium text-teal-600 hover:text-teal-700"
        >
          {t('auth.magicLink.returnToLogin')}
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-teal-500 border-t-transparent mx-auto" />
        <p className="mt-4 text-gray-600">{t('auth.magicLink.verifying')}</p>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-teal-500 border-t-transparent" />
        </div>
      }
    >
      <AuthCallbackContent />
    </Suspense>
  );
}
