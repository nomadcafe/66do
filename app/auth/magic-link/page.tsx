'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSupabaseAuth } from '../../../src/contexts/SupabaseAuthContext';
import { useI18nContext } from '../../../src/contexts/I18nProvider';
import { supabase } from '../../../src/lib/supabase';

function MagicLinkContent() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { } = useSupabaseAuth();
  const { t } = useI18nContext();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const handleMagicLink = async () => {
      // Strip tokens from the address bar before anything awaits, so the URL
      // is clean even if Supabase/async hooks race. Does not affect history.
      const scrubUrl = () => {
        if (typeof window !== 'undefined') {
          window.history.replaceState(null, '', window.location.pathname);
        }
      };

      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          console.error('Session error:', sessionError);
        }

        if (session) {
          scrubUrl();
          router.replace('/dashboard');
          return;
        }

        // Supabase delivers magic-link tokens in the URL fragment by default;
        // fall back to query params for older templates / compatibility.
        const hash = typeof window !== 'undefined' ? window.location.hash : '';
        const hashParams = new URLSearchParams(hash.replace(/^#/, ''));
        const accessToken = hashParams.get('access_token') ?? searchParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token') ?? searchParams.get('refresh_token');
        const token = hashParams.get('token') ?? searchParams.get('token');
        const type = hashParams.get('type') ?? searchParams.get('type');

        if (accessToken && refreshToken) {
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          });
          scrubUrl();

          if (error) {
            console.error('Session setting error:', error.message);
            setError(t('auth.magicLink.loginFailed') + ': ' + error.message);
            setLoading(false);
            return;
          }

          if (data.user && data.session) {
            router.replace('/dashboard');
          } else {
            setError(t('auth.magicLink.loginFailed'));
            setLoading(false);
          }
        } else if (token && type) {
          const validTypes = ['email', 'signup', 'recovery', 'invite', 'email_change'] as const;
          type ValidOtpType = typeof validTypes[number];
          if (!validTypes.includes(type as ValidOtpType)) {
            scrubUrl();
            setError(t('auth.magicLink.invalidLink'));
            setLoading(false);
            return;
          }

          const { data, error } = await supabase.auth.verifyOtp({
            token_hash: token,
            type: type as ValidOtpType
          });
          scrubUrl();

          if (error) {
            console.error('OTP verification error:', error.message);
            setError(t('auth.magicLink.loginFailed') + ': ' + error.message);
            setLoading(false);
            return;
          }

          if (data.user && data.session) {
            router.replace('/dashboard');
          } else {
            setError(t('auth.magicLink.loginFailed'));
            setLoading(false);
          }
        } else {
          // 如果没有token参数，可能是直接访问页面
          setError(t('auth.magicLink.invalidLink'));
          setLoading(false);
        }

      } catch (error) {
        console.error('Magic link verification error:', error);
        setError(t('auth.magicLink.loginFailed'));
        setLoading(false);
      }
    };

    handleMagicLink();
  }, [searchParams, router, t]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">{t('platform.name')}</h1>
          <p className="mt-2 text-gray-600">{t('platform.subtitle')}</p>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          {loading && (
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">{t('auth.magicLink.verifying')}</p>
            </div>
          )}

          {error && (
            <div className="text-center">
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md mb-4">
                {error}
              </div>
              <button
                onClick={() => router.push('/login')}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                {t('auth.magicLink.returnToLogin')}
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

export default function MagicLinkPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">加载中...</p>
        </div>
      </div>
    }>
      <MagicLinkContent />
    </Suspense>
  );
}
