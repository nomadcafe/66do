'use client';

import { useState } from 'react';
import { useI18nContext } from '../../src/contexts/I18nProvider';
import { Mail, ArrowLeft } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const { t, locale, setLocale } = useI18nContext();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // 发送重置密码请求
      const response = await fetch('/api/auth/forgot-password', {
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
        setError(result.error || '发送重置邮件失败');
      } else {
        setSuccess('重置密码邮件已发送！请查收您的邮箱并按照说明重置密码');
      }
    } catch (error) {
      console.error('Forgot password error:', error);
      setError('发送重置邮件失败，请重试');
    }
    
    setLoading(false);
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 text-center">
            <div className="text-green-600 mb-4">
              <svg className="mx-auto h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">邮件已发送！</h2>
            <p className="text-gray-600 mb-4">
              我们已向您的邮箱发送密码重置链接，请查收邮件并按照说明重置密码。
            </p>
            <p className="text-sm text-gray-500 mb-6">
              如果没有收到邮件，请检查垃圾邮件文件夹。
            </p>
            <a 
              href="/login" 
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
            >
              返回登录
            </a>
          </div>
        </div>
      </div>
    );
  }

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
        <h2 className="mt-6 text-center text-2xl font-bold text-gray-900">
          忘记密码
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          输入您的邮箱地址，我们将发送密码重置链接
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                邮箱地址
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
                  className="appearance-none block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="请输入您的邮箱地址"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {loading ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    发送中...
                  </div>
                ) : (
                  <div className="flex items-center">
                    <Mail className="h-4 w-4 mr-2" />
                    发送重置链接
                  </div>
                )}
              </button>
            </div>

            <div className="text-center">
              <p className="text-sm text-gray-600">
                记起密码了？{' '}
                <a href="/login" className="font-medium text-blue-600 hover:text-blue-500">
                  返回登录
                </a>
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
