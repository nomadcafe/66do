'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '../src/contexts/AuthContext';
import { useLanguage } from '../src/contexts/LanguageContext';
import { 
  Globe, 
  TrendingUp, 
  BarChart3, 
  ArrowRight, 
  Shield
} from 'lucide-react';

export default function HomePage() {
  const { user } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const router = useRouter();

  const features = [
    {
      icon: <Globe className="h-6 w-6" />,
      title: t('features.portfolio.title'),
      description: t('features.portfolio.desc')
    },
    {
      icon: <TrendingUp className="h-6 w-6" />,
      title: t('features.analytics.title'),
      description: t('features.analytics.desc')
    },
    {
      icon: <BarChart3 className="h-6 w-6" />,
      title: t('features.data.title'),
      description: t('features.data.desc')
    },
    {
      icon: <Shield className="h-6 w-6" />,
      title: t('features.security.title'),
      description: t('features.security.desc')
    }
  ];

  const stats = [
    { label: t('stats.totalUsers'), value: "200+" },
    { label: t('stats.portfolioValue'), value: "$1.2M+" },
    { label: t('stats.investmentCount'), value: "800+" },
    { label: t('stats.successRate'), value: "78%" }
  ];

  const handleGetStarted = () => {
    if (user) {
      router.push('/dashboard');
    } else {
      router.push('/login');
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gray-900">{t('platform.name')}</h1>
            </div>
            <div className="flex items-center space-x-4">
              {/* Language Selector */}
              <div className="relative">
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value as 'en' | 'zh')}
                  className="appearance-none bg-white border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="zh">中文</option>
                  <option value="en">English</option>
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
              {user ? (
                <button
                  onClick={() => router.push('/dashboard')}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  {t('nav.goToDashboard')}
                </button>
              ) : (
                <>
                  <a
                    href="/login"
                    className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
                  >
                    {t('nav.signIn')}
                  </a>
                  <a
                    href="/register"
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                  >
                    {t('nav.signUp')}
                  </a>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center">
            <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
              {t('home.title')}
            </h1>
            <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
              {t('home.subtitle')}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={handleGetStarted}
                className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 flex items-center justify-center space-x-2 text-lg"
              >
                <span>{t('home.getStarted')}</span>
                <ArrowRight className="h-5 w-5" />
              </button>
              <button className="border border-gray-300 text-gray-700 px-8 py-3 rounded-lg hover:bg-gray-50 text-lg">
                {t('home.learnMore')}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Section */}
      <div className="bg-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-3xl font-bold text-blue-600 mb-2">{stat.value}</div>
                <div className="text-gray-600">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="bg-gray-50 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">{t('features.title')}</h2>
            <p className="text-xl text-gray-600">
              {t('features.subtitle')}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <div key={index} className="bg-white p-6 rounded-lg shadow-sm">
                <div className="text-blue-600 mb-4">{feature.icon}</div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-blue-600 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            {t('home.startJourney')}
          </h2>
          <p className="text-xl text-blue-100 mb-8">
            {t('home.joinThousands')}
          </p>
          <button
            onClick={handleGetStarted}
            className="bg-white text-blue-600 px-8 py-3 rounded-lg hover:bg-gray-50 flex items-center justify-center space-x-2 text-lg mx-auto"
          >
            <span>{t('home.startFree')}</span>
            <ArrowRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <h3 className="text-lg font-semibold mb-4">{t('platform.name')}</h3>
              <p className="text-gray-400">
                {t('footer.description')}
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">{t('footer.product')}</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white">{t('footer.investmentManagement')}</a></li>
                <li><a href="#" className="hover:text-white">{t('footer.dataAnalytics')}</a></li>
                <li><a href="#" className="hover:text-white">{t('footer.performanceTracking')}</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">{t('footer.support')}</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white">{t('footer.helpCenter')}</a></li>
                <li><a href="#" className="hover:text-white">{t('footer.contactUs')}</a></li>
                <li><a href="#" className="hover:text-white">{t('footer.privacyPolicy')}</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">{t('footer.contact')}</h4>
              <p className="text-gray-400">hello@xfinance.app</p>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
            <p>&copy; 2024 X Finance. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}