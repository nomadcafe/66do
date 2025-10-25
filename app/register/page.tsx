'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useI18nContext } from '../../src/contexts/I18nProvider';
import { Mail, User, Lock } from 'lucide-react';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const { t, locale, setLocale } = useI18nContext();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    // 验证密码
    if (password !== confirmPassword) {
      setError('密码不匹配');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('密码至少需要6个字符');
      setLoading(false);
      return;
    }

    try {
      // 发送注册请求
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'register',
          email,
          password
        })
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || '注册失败');
      } else {
        setSuccess('注册成功！请查收邮件并点击验证链接完成账户激活');
        // 3秒后跳转到登录页面
        setTimeout(() => {
          router.push('/login');
        }, 3000);
      }
    } catch (error) {
      console.error('Registration error:', error);
      setError('注册失败，请重试');
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
            <h2 className="text-2xl font-bold text-gray-900 mb-2">注册成功！</h2>
            <p className="text-gray-600 mb-4">
              我们已向您的邮箱发送验证链接，请查收邮件并点击链接完成账户激活。
            </p>
            <p className="text-sm text-gray-500">
              验证完成后，您就可以登录使用系统了。
            </p>
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
          创建账户
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          注册账户以开始使用域名投资管理平台
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

            {success && (
              <div className="bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded-md">
                {success}
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
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                密码
              </label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="请输入密码（至少6个字符）"
                />
              </div>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                确认密码
              </label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="appearance-none block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="请再次输入密码"
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
                    注册中...
                  </div>
                ) : (
                  <div className="flex items-center">
                    <User className="h-4 w-4 mr-2" />
                    创建账户
                  </div>
                )}
              </button>
            </div>

            <div className="text-center">
              <p className="text-sm text-gray-600">
                已有账户？{' '}
                <a href="/login" className="font-medium text-blue-600 hover:text-blue-500">
                  立即登录
                </a>
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
