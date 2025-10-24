'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
// import { useAuth } from '../../src/contexts/AuthContext';
import { useI18nContext } from '../../src/contexts/I18nProvider';
import { Mail, ArrowLeft } from 'lucide-react';

export default function VerifyPage() {
  const [verificationCode, setVerificationCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // const [success, setSuccess] = useState('');
  const [email, setEmail] = useState('');
  // completeRegistration不再需要，验证成功后用户重新登录
  const { t, locale, setLocale } = useI18nContext();
  const router = useRouter();

  useEffect(() => {
    // 从URL参数或sessionStorage获取邮箱
    const urlParams = new URLSearchParams(window.location.search);
    const emailParam = urlParams.get('email');
    
    if (emailParam) {
      setEmail(emailParam);
    } else {
      // 尝试从sessionStorage获取
      const storedEmail = sessionStorage.getItem('66do_verification_email');
      if (storedEmail) {
        setEmail(storedEmail);
      } else {
        // No verification data, redirect to register
        router.push('/register');
      }
    }
  }, [router]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (verificationCode.length !== 6) {
      setError('请输入6位验证码');
      setLoading(false);
      return;
    }

    try {
      if (!email) {
        setError('邮箱地址不存在，请重新注册');
        setLoading(false);
        return;
      }

      // 调用API验证验证码
      const response = await fetch('/api/verify-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: verificationCode
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.error || '验证失败');
        setLoading(false);
        return;
      }

      const result = await response.json();
      if (!result.success) {
        setError(result.error || '验证码错误');
        setLoading(false);
        return;
      }

      // 更新用户邮箱验证状态
      const updateResponse = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'updateUserEmailVerification',
          email: email,
          user: { email_verified: true }
        })
      });

      if (!updateResponse.ok) {
        setError('邮箱验证状态更新失败');
        setLoading(false);
        return;
      }

      // 验证成功后，用户需要重新登录
      // setSuccess('邮箱验证成功！请重新登录');
      setTimeout(() => {
        // 清理sessionStorage
        sessionStorage.removeItem('66do_verification_email');
        router.push('/login');
      }, 2000);
      
    } catch {
      setError('验证失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setLoading(true);
    setError('');

    try {
      if (!email) {
        setError('邮箱地址不存在');
        setLoading(false);
        return;
      }
      
      // 调用API重新发送验证码
      const response = await fetch('/api/send-verification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email
        })
      });

      if (!response.ok) {
        throw new Error('发送验证码失败');
      }

      const result = await response.json();
      if (result.success) {
        // setSuccess('验证码已重新发送');
        // 生产环境不应在控制台显示验证码
      } else {
        throw new Error(result.error || '发送失败');
      }
      
    } catch {
      setError('重新发送失败，请重试');
    } finally {
      setLoading(false);
    }
  };

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
        <h2 className="mt-6 text-center text-3xl font-bold text-gray-900">
          邮箱验证
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          我们已向 <span className="font-medium text-blue-600">{email}</span> 发送了验证码
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <form className="space-y-6" onSubmit={handleVerify}>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="verificationCode" className="block text-sm font-medium text-gray-700">
                验证码
              </label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="verificationCode"
                  name="verificationCode"
                  type="text"
                  required
                  maxLength={6}
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                  className="appearance-none block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-center text-2xl tracking-widest"
                  placeholder="000000"
                />
              </div>
              <p className="mt-2 text-sm text-gray-500">
                请输入6位数字验证码
              </p>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading || verificationCode.length !== 6}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? '验证中...' : '验证邮箱'}
              </button>
            </div>

            <div className="text-center">
              <button
                type="button"
                onClick={handleResend}
                disabled={loading}
                className="text-sm text-blue-600 hover:text-blue-500 disabled:opacity-50"
              >
                没有收到验证码？重新发送
              </button>
            </div>

            <div className="text-center">
              <button
                type="button"
                onClick={() => router.push('/register')}
                className="text-sm text-gray-600 hover:text-gray-500 flex items-center justify-center"
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                返回注册页面
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
