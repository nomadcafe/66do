'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSupabaseAuth } from '../../../src/contexts/SupabaseAuthContext';
import { useI18nContext } from '../../../src/contexts/I18nProvider';
import { supabase } from '../../../src/lib/supabase';

function MagicLinkContent() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const { } = useSupabaseAuth();
  const { t } = useI18nContext();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const handleMagicLink = async () => {
      try {
        // 检查当前会话状态
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('Session error:', sessionError);
        }
        
        if (session) {
          console.log('User already authenticated:', session.user);
          setSuccess(t('auth.magicLink.loginSuccess'));
          setTimeout(() => {
            router.push('/dashboard');
          }, 2000);
          return;
        }

        // 检查URL参数（Supabase Magic Link可能包含不同的参数）
        const accessToken = searchParams.get('access_token');
        const refreshToken = searchParams.get('refresh_token');
        const tokenType = searchParams.get('token_type');
        const token = searchParams.get('token');
        const type = searchParams.get('type');
        
        console.log('Magic link params:', { accessToken, refreshToken, tokenType, token, type });
        console.log('Current URL:', window.location.href);
        console.log('All search params:', Object.fromEntries(searchParams.entries()));
        
        if (accessToken && refreshToken) {
          // 使用Supabase的session设置
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          });

          console.log('Session set result:', { data, error });

          if (error) {
            console.error('Session setting error:', error);
            setError(t('auth.magicLink.loginFailed') + ': ' + error.message);
            setLoading(false);
            return;
          }

          if (data.user && data.session) {
            console.log('Magic link authentication successful:', data);
            setSuccess(t('auth.magicLink.loginSuccess'));
            setTimeout(() => {
              router.push('/dashboard');
            }, 2000);
          } else {
            console.log('No user or session after setting session');
            setError(t('auth.magicLink.loginFailed'));
            setLoading(false);
          }
        } else if (token && type) {
          // 尝试使用OTP验证
          const { data, error } = await supabase.auth.verifyOtp({
            token_hash: token,
            type: type as 'email'
          });

          console.log('OTP verification result:', { data, error });

          if (error) {
            console.error('OTP verification error:', error);
            setError(t('auth.magicLink.loginFailed') + ': ' + error.message);
            setLoading(false);
            return;
          }

          if (data.user && data.session) {
            console.log('OTP authentication successful:', data);
            setSuccess(t('auth.magicLink.loginSuccess'));
            setTimeout(() => {
              router.push('/dashboard');
            }, 2000);
          } else {
            console.log('No user or session after OTP verification');
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
  }, [searchParams, router]);

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

          {success && (
            <div className="text-center">
              <div className="bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded-md mb-4">
                {success}
              </div>
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
