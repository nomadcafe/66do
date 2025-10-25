'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useI18nContext } from '../../src/contexts/I18nProvider';

function VerifyContent() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const { t, locale, setLocale } = useI18nContext();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const handleVerification = async () => {
      try {
        const token = searchParams.get('token');
        const email = searchParams.get('email');
        
        console.log('Verification params:', { token, email });
        
        if (!token || !email) {
          setError('无效的验证链接');
          setLoading(false);
          return;
        }

        // 验证令牌
        const response = await fetch('/api/verify-token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            token,
            email
          })
        });

        const result = await response.json();

        if (!response.ok) {
          setError(result.error || '验证失败');
        } else {
          setSuccess('邮箱验证成功！您现在可以登录了');
          // 3秒后跳转到登录页面
          setTimeout(() => {
            router.push('/login');
          }, 3000);
        }
      } catch (error) {
        console.error('Verification error:', error);
        setError('验证失败，请重试');
      }
      
      setLoading(false);
    };

    handleVerification();
  }, [searchParams, router]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">{t('platform.name')}</h1>
          <p className="mt-2 text-gray-600">{t('platform.subtitle')}</p>
        </div>
        <div className="flex justify-center mt-4">
          <select
            value={locale}
            onChange={(e) => setLocale(e.target.value as 'en' | 'zh')}
            className="appearance-none bg-white border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="zh">中文</option>
            <option value="en">English</option>
          </select>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 text-center">
          {loading && (
            <div>
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">正在验证...</h2>
              <p className="text-gray-600">请稍候，我们正在验证您的邮箱地址</p>
            </div>
          )}

          {error && (
            <div>
              <div className="text-red-600 mb-4">
                <svg className="mx-auto h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">验证失败</h2>
              <p className="text-gray-600 mb-4">{error}</p>
              <a 
                href="/login" 
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                返回登录
              </a>
            </div>
          )}

          {success && (
            <div>
              <div className="text-green-600 mb-4">
                <svg className="mx-auto h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">验证成功！</h2>
              <p className="text-gray-600 mb-4">{success}</p>
              <a 
                href="/login" 
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                立即登录
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">正在加载...</h2>
            <p className="text-gray-600">请稍候</p>
          </div>
        </div>
      </div>
    }>
      <VerifyContent />
    </Suspense>
  );
}