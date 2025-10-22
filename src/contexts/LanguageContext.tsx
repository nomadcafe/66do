'use client';

import { createContext, useContext, useState, useEffect } from 'react';

type Language = 'en' | 'zh';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// Translation files
const translations = {
  en: {
    // Navigation
    'nav.signIn': 'Sign In',
    'nav.signUp': 'Sign Up',
    'nav.goToDashboard': 'Go to Dashboard',
    
    // Homepage
    'home.title': 'Domain Investment Platform',
    'home.subtitle': 'Professional domain investment management tools to help you track domain portfolios, monitor renewals, and maximize returns. Your trusted partner in domain investing.',
    'home.getStarted': 'Get Started',
    'home.learnMore': 'Learn More',
    'home.startFree': 'Start Free',
    'home.startJourney': 'Start Your Domain Investment Journey',
    'home.joinThousands': 'Join domain investors using 66Do to track their domain portfolios',
    
    // Features
    'features.title': 'Core Features',
    'features.subtitle': 'Comprehensive domain investment management solutions',
    'features.portfolio.title': 'Domain Portfolio Management',
    'features.portfolio.desc': 'Easily manage your domain portfolio with detailed tracking of purchase costs, renewal fees, and market values',
    'features.analytics.title': 'Domain Performance Analytics',
    'features.analytics.desc': 'Track domain investment returns with ROI calculations, renewal cost analysis, and market value tracking',
    'features.data.title': 'Domain Data Analytics',
    'features.data.desc': 'Comprehensive domain statistics, trend analysis, and market insights to optimize your domain investments',
    'features.security.title': 'Data Security',
    'features.security.desc': 'Enterprise-grade encryption to ensure your investment data remains secure',
    
    // Stats
    'stats.totalUsers': 'Domain Investors',
    'stats.portfolioValue': 'Domain Portfolio Value',
    'stats.investmentCount': 'Domains Tracked',
    'stats.successRate': 'Success Rate',
    
    // Footer
    'footer.description': 'Professional domain investment management platform to help you achieve your domain investment goals.',
    'footer.product': 'Product',
    'footer.investmentManagement': 'Domain Management',
    'footer.dataAnalytics': 'Domain Analytics',
    'footer.performanceTracking': 'Performance Tracking',
    'footer.support': 'Support',
    'footer.helpCenter': 'Help Center',
    'footer.contactUs': 'Contact Us',
    'footer.privacyPolicy': 'Privacy Policy',
    'footer.contact': 'Contact',
    
    // Auth
    'auth.signIn.title': 'Sign in to your account',
    'auth.signUp.title': 'Create a new account',
    'auth.email': 'Email Address',
    'auth.password': 'Password',
    'auth.confirmPassword': 'Confirm Password',
    'auth.emailPlaceholder': 'Enter your email address',
    'auth.passwordPlaceholder': 'Enter your password',
    'auth.confirmPasswordPlaceholder': 'Confirm your password',
    'auth.passwordMinLength': 'Enter password (at least 6 characters)',
    'auth.signInButton': 'Sign In',
    'auth.signInLoading': 'Signing in...',
    'auth.signUpButton': 'Create Account',
    'auth.signUpLoading': 'Creating account...',
    'auth.noAccount': "Don't have an account?",
    'auth.hasAccount': 'Already have an account?',
    'auth.signUpNow': 'Sign up now',
    'auth.signInNow': 'Sign in now',
    'auth.verification': 'Security Verification',
    'auth.verificationRequired': 'Please complete the verification',
    'auth.verificationFailed': 'Verification failed. Please try again.',
    'auth.verificationExpired': 'Verification expired. Please verify again.',
    'auth.registrationSuccess': 'Registration Successful!',
    'auth.checkEmail': 'Please check your email and click the confirmation link to activate your account.',
    'auth.redirecting': 'Redirecting to login page in 2 seconds...',
    'auth.passwordsNotMatch': 'Passwords do not match',
    'auth.passwordTooShort': 'Password must be at least 6 characters',
    
    // Dashboard
    'dashboard.title': 'Domain Investment Tracker - Track your domain portfolio and returns',
    'dashboard.addInvestment': 'Add Domain',
    'dashboard.signOut': 'Sign Out',
    'dashboard.totalInvestments': 'Total Domains',
    'dashboard.totalCost': 'Total Cost',
    'dashboard.totalRevenue': 'Total Revenue',
    'dashboard.investmentPortfolio': 'Domain Portfolio',
    'dashboard.noInvestments': 'No domains added yet',
    'dashboard.addFirstInvestment': 'Add Your First Domain',
    'dashboard.investmentName': 'Domain Name',
    'dashboard.investmentAmount': 'Purchase Price',
    'dashboard.investmentNamePlaceholder': 'e.g., example.com, mydomain.net, etc.',
    'dashboard.cancel': 'Cancel',
    'dashboard.add': 'Add',
    'dashboard.addFunctionality': 'Add functionality in development...',
    
    // Platform name
    'platform.name': '66Do',
    'platform.subtitle': 'Domain Investment Platform'
  },
  zh: {
    // Navigation
    'nav.signIn': '登录',
    'nav.signUp': '注册',
    'nav.goToDashboard': '进入仪表板',
    
    // Homepage
    'home.title': '域名投资追踪器',
    'home.subtitle': '专业的域名投资管理工具，帮助您追踪域名投资组合、管理成本和收益。专注于域名投资，后期可扩展至其他投资领域。',
    'home.getStarted': '立即开始',
    'home.learnMore': '了解更多',
    'home.startFree': '免费开始',
    'home.startJourney': '开始您的域名投资之旅',
    'home.joinThousands': '加入域名投资者，使用66Do追踪您的域名投资组合',
    
    // Features
    'features.title': '核心功能',
    'features.subtitle': '为域名投资者提供全方位的投资管理解决方案',
    'features.portfolio.title': '域名投资组合管理',
    'features.portfolio.desc': '轻松管理您的域名投资组合，详细追踪购买成本、续费费用和市场价值',
    'features.analytics.title': '域名收益分析',
    'features.analytics.desc': '追踪域名投资收益，计算ROI、续费成本分析和市场价值追踪',
    'features.data.title': '域名数据分析',
    'features.data.desc': '全面的域名统计数据、趋势分析和市场洞察，优化您的域名投资决策',
    'features.security.title': '数据安全',
    'features.security.desc': '企业级数据加密，确保您的投资数据安全',
    
    // Stats
    'stats.totalUsers': '域名投资者',
    'stats.portfolioValue': '域名投资组合价值',
    'stats.investmentCount': '追踪域名数',
    'stats.successRate': '成功率',
    
    // Footer
    'footer.description': '专业的域名投资管理平台，助您实现域名投资目标。',
    'footer.product': '产品',
    'footer.investmentManagement': '域名管理',
    'footer.dataAnalytics': '域名分析',
    'footer.performanceTracking': '收益追踪',
    'footer.support': '支持',
    'footer.helpCenter': '帮助中心',
    'footer.contactUs': '联系我们',
    'footer.privacyPolicy': '隐私政策',
    'footer.contact': '联系',
    
    // Auth
    'auth.signIn.title': '登录您的账户',
    'auth.signUp.title': '创建新账户',
    'auth.email': '邮箱地址',
    'auth.password': '密码',
    'auth.confirmPassword': '确认密码',
    'auth.emailPlaceholder': '请输入邮箱地址',
    'auth.passwordPlaceholder': '请输入密码',
    'auth.confirmPasswordPlaceholder': '请再次输入密码',
    'auth.passwordMinLength': '请输入密码（至少6个字符）',
    'auth.signInButton': '登录',
    'auth.signInLoading': '登录中...',
    'auth.signUpButton': '注册账户',
    'auth.signUpLoading': '注册中...',
    'auth.noAccount': '还没有账户？',
    'auth.hasAccount': '已有账户？',
    'auth.signUpNow': '立即注册',
    'auth.signInNow': '立即登录',
    'auth.verification': '安全验证',
    'auth.verificationRequired': '请完成安全验证',
    'auth.verificationFailed': '验证失败，请重试',
    'auth.verificationExpired': '验证已过期，请重新验证',
    'auth.registrationSuccess': '注册成功！',
    'auth.checkEmail': '请检查您的邮箱，点击确认链接激活账户。',
    'auth.redirecting': '2秒后自动跳转到登录页面...',
    'auth.passwordsNotMatch': '密码不匹配',
    'auth.passwordTooShort': '密码至少需要6个字符',
    
    // Dashboard
    'dashboard.title': '域名投资追踪器，追踪你的域名投资组合和收益',
    'dashboard.addInvestment': '添加域名',
    'dashboard.signOut': '退出',
    'dashboard.totalInvestments': '总域名数',
    'dashboard.totalCost': '总成本',
    'dashboard.totalRevenue': '总收益',
    'dashboard.investmentPortfolio': '域名列表',
    'dashboard.noInvestments': '还没有添加任何域名',
    'dashboard.addFirstInvestment': '添加第一个域名',
    'dashboard.investmentName': '域名名称',
    'dashboard.investmentAmount': '购买价格',
    'dashboard.investmentNamePlaceholder': '例如：example.com、mydomain.net等',
    'dashboard.cancel': '取消',
    'dashboard.add': '添加',
    'dashboard.addFunctionality': '添加功能开发中...',
    
    // Platform name
    'platform.name': '66Do',
    'platform.subtitle': '域名投资平台'
  }
};

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>('zh');

  // Detect browser language and load from localStorage on mount
  useEffect(() => {
    // First check if user has previously selected a language
    const savedLanguage = localStorage.getItem('66do-language') as Language;
    if (savedLanguage && (savedLanguage === 'en' || savedLanguage === 'zh')) {
      setLanguage(savedLanguage);
      return;
    }

    // If no saved language, detect browser language
    const browserLanguage = navigator.language || navigator.languages?.[0] || 'en';
    
    // Check if browser language is Chinese (zh, zh-CN, zh-TW, etc.)
    if (browserLanguage.startsWith('zh')) {
      setLanguage('zh');
    } else {
      // Default to English for all other languages
      setLanguage('en');
    }
  }, []);

  // Save language to localStorage when it changes
  const handleSetLanguage = (lang: Language) => {
    setLanguage(lang);
    localStorage.setItem('66do-language', lang);
  };

  const t = (key: string): string => {
    return translations[language][key as keyof typeof translations[typeof language]] || key;
  };

  const value = {
    language,
    setLanguage: handleSetLanguage,
    t,
  };

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
