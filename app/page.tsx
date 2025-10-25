'use client';

import { useRouter } from 'next/navigation';
import { useSupabaseAuth } from '../src/contexts/SupabaseAuthContext';
import { useI18nContext } from '../src/contexts/I18nProvider';
import { 
  Globe, 
  TrendingUp, 
  BarChart3, 
  ArrowRight, 
  Shield,
  Star,
  Zap,
  Target,
  Users
} from 'lucide-react';

export default function HomePage() {
  const { user } = useSupabaseAuth();
  const { t, locale, setLocale } = useI18nContext();
  const router = useRouter();

  const features = [
    {
      icon: <Globe className="h-8 w-8" />,
      title: t('features.portfolio.title'),
      description: t('features.portfolio.desc'),
      color: 'from-blue-500 to-blue-600'
    },
    {
      icon: <TrendingUp className="h-8 w-8" />,
      title: t('features.analytics.title'),
      description: t('features.analytics.desc'),
      color: 'from-green-500 to-green-600'
    },
    {
      icon: <BarChart3 className="h-8 w-8" />,
      title: t('features.data.title'),
      description: t('features.data.desc'),
      color: 'from-purple-500 to-purple-600'
    },
    {
      icon: <Shield className="h-8 w-8" />,
      title: t('features.security.title'),
      description: t('features.security.desc'),
      color: 'from-orange-500 to-orange-600'
    }
  ];

  const benefits = [
    {
      icon: <Zap className="h-6 w-6" />,
      title: t('benefits.portfolio.title'),
      description: t('benefits.portfolio.desc')
    },
    {
      icon: <Target className="h-6 w-6" />,
      title: t('benefits.analytics.title'),
      description: t('benefits.analytics.desc')
    },
    {
      icon: <Users className="h-6 w-6" />,
      title: t('benefits.market.title'),
      description: t('benefits.market.desc')
    }
  ];


  const stats = [
    { label: t('stats.totalUsers'), value: "100+" },
    { label: t('stats.portfolioValue'), value: "$2.5M+" },
    { label: t('stats.investmentCount'), value: "1,200+" },
    { label: t('stats.successRate'), value: "100%" }
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
      <nav className="bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
                <Globe className="h-6 w-6 text-white" />
              </div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                {t('platform.name')}
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              {/* Language Selector */}
              <div className="relative">
                <select
                  value={locale}
                  onChange={(e) => setLocale(e.target.value as 'en' | 'zh')}
                  className="appearance-none bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                >
                  <option value="zh">中文</option>
                  <option value="en">English</option>
                </select>
              </div>
              {user ? (
                <button
                  onClick={() => router.push('/dashboard')}
                  className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-2 rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl"
                >
                  {t('nav.goToDashboard')}
                </button>
              ) : (
                <div className="flex space-x-3">
                  <a
                    href="/login"
                    className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-2 rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl"
                  >
                    登录
                  </a>
                  <a
                    href="/register"
                    className="bg-white text-blue-600 border border-blue-600 px-6 py-2 rounded-lg hover:bg-blue-50 transition-all duration-200 shadow-lg hover:shadow-xl"
                  >
                    注册
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative overflow-hidden">
        {/* Background with gradient and patterns */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-purple-50"></div>
        <div className="absolute inset-0 opacity-40" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%239C92AC' fill-opacity='0.05'%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
        }}></div>
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 lg:py-32">
          <div className="text-center">
            {/* Badge */}
            <div className="inline-flex items-center px-4 py-2 py-1 rounded-full bg-blue-100 text-blue-800 text-sm font-medium mb-8">
              <Star className="h-4 w-4 mr-2" />
              Trusted by 200+ domain investors
            </div>
            
            <h1 className="text-5xl md:text-7xl font-bold mb-8">
              <span className="bg-gradient-to-r from-gray-900 via-blue-900 to-purple-900 bg-clip-text text-transparent">
                {t('home.title')}
              </span>
            </h1>
            
            <p className="text-xl md:text-2xl text-gray-600 mb-12 max-w-4xl mx-auto leading-relaxed">
              {t('home.subtitle')}
            </p>
            
            <div className="flex justify-center mb-16">
              <button
                onClick={handleGetStarted}
                className="group bg-gradient-to-r from-blue-600 to-purple-600 text-white px-12 py-4 rounded-xl hover:from-blue-700 hover:to-purple-700 flex items-center justify-center space-x-3 text-lg font-semibold shadow-2xl hover:shadow-3xl transition-all duration-300 transform hover:-translate-y-1"
              >
                <span>{t('home.getStarted')}</span>
                <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
            
          </div>
        </div>
      </div>

      {/* Stats Section */}
      <div className="bg-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center group">
                <div className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-3 group-hover:scale-110 transition-transform duration-300">
                  {stat.value}
                </div>
                <div className="text-gray-600 font-medium">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="bg-gradient-to-br from-gray-50 to-blue-50 py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
              {t('features.title')}
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              {t('features.subtitle')}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <div key={index} className="group bg-white p-8 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 border border-gray-100">
                <div className={`w-16 h-16 bg-gradient-to-br ${feature.color} rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}>
                  <div className="text-white">{feature.icon}</div>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-4">{feature.title}</h3>
                <p className="text-gray-600 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>


      {/* Benefits Section */}
      <div className="bg-gradient-to-br from-blue-600 to-purple-700 py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-6">
              {t('benefits.title')}
            </h2>
            <p className="text-xl text-blue-100 max-w-3xl mx-auto">
              {t('benefits.subtitle')}
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
            {benefits.map((benefit, index) => (
              <div key={index} className="text-center">
                <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <div className="text-white">{benefit.icon}</div>
                </div>
                <h3 className="text-xl font-bold text-white mb-4">{benefit.title}</h3>
                <p className="text-blue-100">{benefit.description}</p>
              </div>
            ))}
          </div>
          
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-white py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold text-gray-900 mb-6">
            {t('home.startJourney')}
          </h2>
          <p className="text-xl text-gray-600 mb-12">
            {t('home.joinThousands')}
          </p>
          <div className="flex justify-center">
            <button
              onClick={handleGetStarted}
              className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-12 py-4 rounded-xl hover:from-blue-700 hover:to-purple-700 flex items-center justify-center space-x-3 text-lg font-semibold shadow-2xl hover:shadow-3xl transition-all duration-300 transform hover:-translate-y-1"
            >
              <span>{t('home.startFree')}</span>
              <ArrowRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
            <div className="md:col-span-1">
              <div className="flex items-center space-x-3 mb-6">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
                  <Globe className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-2xl font-bold">{t('platform.name')}</h3>
              </div>
              <p className="text-gray-400 leading-relaxed mb-6">
                {t('footer.description')}
              </p>
              <div className="flex space-x-4">
                <div className="w-10 h-10 bg-gray-800 rounded-lg flex items-center justify-center hover:bg-gray-700 transition-colors cursor-pointer">
                  <span className="text-sm font-bold">T</span>
                </div>
                <div className="w-10 h-10 bg-gray-800 rounded-lg flex items-center justify-center hover:bg-gray-700 transition-colors cursor-pointer">
                  <span className="text-sm font-bold">D</span>
                </div>
                <div className="w-10 h-10 bg-gray-800 rounded-lg flex items-center justify-center hover:bg-gray-700 transition-colors cursor-pointer">
                  <span className="text-sm font-bold">G</span>
                </div>
              </div>
            </div>
            
            <div>
              <h4 className="font-bold text-lg mb-6">{t('footer.product')}</h4>
              <ul className="space-y-3 text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">{t('footer.investmentManagement')}</a></li>
                <li><a href="#" className="hover:text-white transition-colors">{t('footer.dataAnalytics')}</a></li>
                <li><a href="#" className="hover:text-white transition-colors">{t('footer.performanceTracking')}</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-bold text-lg mb-6">{t('footer.support')}</h4>
              <ul className="space-y-3 text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">{t('footer.contactUs')}</a></li>
                <li><a href="#" className="hover:text-white transition-colors">{t('footer.privacyPolicy')}</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Terms of Service</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-bold text-lg mb-6">{t('footer.contact')}</h4>
              <div className="space-y-3 text-gray-400">
                <p className="flex items-center">
                  <span className="w-2 h-2 bg-blue-500 rounded-full mr-3"></span>
                  hello # 66do.com
                </p>
              </div>
            </div>
          </div>
          
          <div className="border-t border-gray-800 mt-12 pt-8">
            <div className="flex flex-col md:flex-row justify-between items-center">
              <p className="text-gray-400 text-sm">
                &copy; 2024 66Do. All rights reserved. Built with ❤️ for domain investors.
              </p>
              <div className="flex space-x-6 mt-4 md:mt-0">
                <a href="#" className="text-gray-400 hover:text-white text-sm transition-colors">Privacy</a>
                <a href="#" className="text-gray-400 hover:text-white text-sm transition-colors">Terms</a>
                <a href="#" className="text-gray-400 hover:text-white text-sm transition-colors">Cookies</a>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}