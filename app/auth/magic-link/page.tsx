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
        // 检查URL参数
        const token = searchParams.get('token');
        const type = searchParams.get('type');
        const email = searchParams.get('email');
        
        console.log('Magic link params:', { token, type, email });
        console.log('Current URL:', window.location.href);
        console.log('All search params:', Object.fromEntries(searchParams.entries()));
        
        if (!token) {
          setError('无效的登录链接');
          setLoading(false);
          return;
        }

        // 使用Supabase的魔法链接验证
        console.log('Verifying magic link with token:', token);
        
        const { data, error } = await supabase.auth.verifyOtp({
          token_hash: token,
          type: 'magiclink'
        });

        console.log('Verification result:', { data, error });

        if (error) {
          console.error('Magic link verification error:', error);
          console.error('Error details:', error);
          setError(error.message || '登录链接验证失败');
          setLoading(false);
          return;
        }

        if (data.user && data.session) {
          console.log('Magic link verification successful:', data);
          setSuccess('登录成功！正在跳转到您的仪表板...');
          
          // 跳转到仪表板
          setTimeout(() => {
            router.push('/dashboard');
          }, 2000);
        } else {
          console.log('No user or session in response:', data);
          setError('登录失败，请重试');
          setLoading(false);
        }

      } catch (error) {
        console.error('Magic link verification error:', error);
        setError('登录失败，请重试');
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
              <p className="mt-4 text-gray-600">正在验证您的登录链接...</p>
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
                返回登录页面
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
