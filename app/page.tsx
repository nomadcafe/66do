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


  const homeFeatures = [
    { text: t('home.feature1') },
    { text: t('home.feature2') },
    { text: t('home.feature3') },
    { text: t('home.feature4') }
  ];

  const handleGetStarted = () => {
    if (user) {
      router.push('/dashboard');
    } else {
      router.push('/login');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Navigation */}
      <nav className="bg-black/20 backdrop-blur-xl border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-xl flex items-center justify-center shadow-lg">
                <Globe className="h-6 w-6 text-white" />
              </div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-white to-cyan-300 bg-clip-text text-transparent">
                {t('platform.name')}
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              {/* Language Selector */}
              <div className="relative">
                <select
                  value={locale}
                  onChange={(e) => setLocale(e.target.value as 'en' | 'zh')}
                  className="appearance-none bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-cyan-400"
                >
                  <option value="zh" className="bg-slate-800">中文</option>
                  <option value="en" className="bg-slate-800">English</option>
                </select>
              </div>
              {user ? (
                <button
                  onClick={() => router.push('/dashboard')}
                  className="bg-gradient-to-r from-cyan-500 to-blue-600 text-white px-6 py-2 rounded-lg hover:from-cyan-600 hover:to-blue-700 transition-all duration-200 shadow-lg hover:shadow-xl backdrop-blur-sm"
                >
                  {t('nav.goToDashboard')}
                </button>
              ) : (
                <a
                  href="/login"
                  className="bg-gradient-to-r from-cyan-500 to-blue-600 text-white px-6 py-2 rounded-lg hover:from-cyan-600 hover:to-blue-700 transition-all duration-200 shadow-lg hover:shadow-xl backdrop-blur-sm"
                >
                  Magic Link 登录
                </a>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative overflow-hidden">
        {/* Animated background */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900"></div>
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 via-transparent to-blue-500/10"></div>
        
        {/* Animated grid pattern */}
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.1'%3E%3Ccircle cx='30' cy='30' r='1.5'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
        }}></div>
        
        {/* Floating elements */}
        <div className="absolute top-20 left-10 w-72 h-72 bg-cyan-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 lg:py-32">
          <div className="text-center">
            {/* Badge */}
            <div className="inline-flex items-center px-6 py-3 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-cyan-300 text-sm font-medium mb-8 hover:bg-white/20 transition-all duration-300">
              <Star className="h-4 w-4 mr-2" />
              Trusted by 200+ domain investors
            </div>
            
            <h1 className="text-5xl md:text-7xl font-bold mb-8">
              <span className="bg-gradient-to-r from-white via-cyan-300 to-blue-400 bg-clip-text text-transparent">
                {t('home.title')}
              </span>
            </h1>
            
            <p className="text-xl md:text-2xl text-gray-300 mb-12 max-w-4xl mx-auto leading-relaxed">
              {t('home.subtitle')}
            </p>
            
            <div className="flex justify-center mb-16">
              <button
                onClick={handleGetStarted}
                className="group bg-gradient-to-r from-cyan-500 to-blue-600 text-white px-12 py-4 rounded-xl hover:from-cyan-600 hover:to-blue-700 flex items-center justify-center space-x-3 text-lg font-semibold shadow-2xl hover:shadow-cyan-500/25 transition-all duration-300 transform hover:-translate-y-1 backdrop-blur-sm"
              >
                <span>{t('home.getStarted')}</span>
                <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
            
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="bg-gradient-to-r from-slate-800/50 to-slate-900/50 backdrop-blur-sm py-20 border-y border-white/10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="space-y-6">
            {homeFeatures.map((feature, index) => (
              <div key={index} className="flex items-center space-x-4 group bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10 hover:bg-white/10 transition-all duration-300">
                <div className="w-2 h-2 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full flex-shrink-0"></div>
                <div className="text-gray-300 text-lg group-hover:text-white transition-colors duration-300">
                  {feature.text}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
              {t('features.title')}
            </h2>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              {t('features.subtitle')}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <div key={index} className="group bg-white/5 backdrop-blur-sm p-8 rounded-2xl border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all duration-300 transform hover:-translate-y-2">
                <div className={`w-16 h-16 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 shadow-lg`}>
                  <div className="text-white">{feature.icon}</div>
                </div>
                <h3 className="text-xl font-bold text-white mb-4">{feature.title}</h3>
                <p className="text-gray-300 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>


      {/* Benefits Section */}
      <div className="bg-gradient-to-br from-cyan-600 via-blue-700 to-purple-800 py-24 relative overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 via-transparent to-blue-500/20"></div>
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-white/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl"></div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-6">
              {t('benefits.title')}
            </h2>
            <p className="text-xl text-cyan-100 max-w-3xl mx-auto">
              {t('benefits.subtitle')}
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
            {benefits.map((benefit, index) => (
              <div key={index} className="text-center group bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20 hover:bg-white/20 transition-all duration-300">
                <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300">
                  <div className="text-white">{benefit.icon}</div>
                </div>
                <h3 className="text-xl font-bold text-white mb-4">{benefit.title}</h3>
                <p className="text-cyan-100">{benefit.description}</p>
              </div>
            ))}
          </div>
          
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 py-24 relative overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 via-transparent to-blue-500/5"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl"></div>
        
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative">
          <h2 className="text-4xl font-bold text-white mb-6">
            {t('home.startJourney')}
          </h2>
          <p className="text-xl text-gray-300 mb-12">
            {t('home.joinThousands')}
          </p>
          <div className="flex justify-center">
            <button
              onClick={handleGetStarted}
              className="bg-gradient-to-r from-cyan-500 to-blue-600 text-white px-12 py-4 rounded-xl hover:from-cyan-600 hover:to-blue-700 flex items-center justify-center space-x-3 text-lg font-semibold shadow-2xl hover:shadow-cyan-500/25 transition-all duration-300 transform hover:-translate-y-1 backdrop-blur-sm"
            >
              <span>{t('home.startFree')}</span>
              <ArrowRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-black/50 backdrop-blur-sm text-white py-16 border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
            <div className="md:col-span-1">
              <div className="flex items-center space-x-3 mb-6">
                <div className="w-10 h-10 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-xl flex items-center justify-center shadow-lg">
                  <Globe className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-2xl font-bold bg-gradient-to-r from-white to-cyan-300 bg-clip-text text-transparent">{t('platform.name')}</h3>
              </div>
              <p className="text-gray-300 leading-relaxed mb-6">
                {t('footer.description')}
              </p>
              <div className="flex space-x-4">
                <div className="w-10 h-10 bg-white/10 backdrop-blur-sm rounded-lg flex items-center justify-center hover:bg-white/20 transition-colors cursor-pointer border border-white/20">
                  <span className="text-sm font-bold">T</span>
                </div>
                <div className="w-10 h-10 bg-white/10 backdrop-blur-sm rounded-lg flex items-center justify-center hover:bg-white/20 transition-colors cursor-pointer border border-white/20">
                  <span className="text-sm font-bold">D</span>
                </div>
                <div className="w-10 h-10 bg-white/10 backdrop-blur-sm rounded-lg flex items-center justify-center hover:bg-white/20 transition-colors cursor-pointer border border-white/20">
                  <span className="text-sm font-bold">G</span>
                </div>
              </div>
            </div>
            
            <div>
              <h4 className="font-bold text-lg mb-6 text-cyan-300">{t('footer.product')}</h4>
              <ul className="space-y-3 text-gray-300">
                <li><a href="#" className="hover:text-cyan-300 transition-colors">{t('footer.investmentManagement')}</a></li>
                <li><a href="#" className="hover:text-cyan-300 transition-colors">{t('footer.dataAnalytics')}</a></li>
                <li><a href="#" className="hover:text-cyan-300 transition-colors">{t('footer.performanceTracking')}</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-bold text-lg mb-6 text-cyan-300">{t('footer.support')}</h4>
              <ul className="space-y-3 text-gray-300">
                <li><a href="#" className="hover:text-cyan-300 transition-colors">{t('footer.contactUs')}</a></li>
                <li><a href="#" className="hover:text-cyan-300 transition-colors">{t('footer.privacyPolicy')}</a></li>
                <li><a href="#" className="hover:text-cyan-300 transition-colors">Terms of Service</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-bold text-lg mb-6 text-cyan-300">{t('footer.contact')}</h4>
              <div className="space-y-3 text-gray-300">
                <p className="flex items-center">
                  <span className="w-2 h-2 bg-cyan-400 rounded-full mr-3"></span>
                  hello # 66do.com
                </p>
              </div>
            </div>
          </div>
          
          <div className="border-t border-white/10 mt-12 pt-8">
            <div className="flex flex-col md:flex-row justify-between items-center">
              <p className="text-gray-400 text-sm">
                &copy; 2024 66Do. All rights reserved. Built with ❤️ for domain investors.
              </p>
              <div className="flex space-x-6 mt-4 md:mt-0">
                <a href="#" className="text-gray-400 hover:text-cyan-300 text-sm transition-colors">Privacy</a>
                <a href="#" className="text-gray-400 hover:text-cyan-300 text-sm transition-colors">Terms</a>
                <a href="#" className="text-gray-400 hover:text-cyan-300 text-sm transition-colors">Cookies</a>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}