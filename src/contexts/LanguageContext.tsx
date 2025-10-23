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
    'home.startJourney': 'Ready to Start Your Domain Investment Journey?',
    'home.joinThousands': 'Join thousands of successful domain investors who trust 66Do for portfolio management',
    
    // Features
    'features.title': 'Core Features',
    'features.subtitle': 'Everything you need to succeed in domain investing',
    'features.portfolio.title': 'Portfolio Management',
    'features.portfolio.desc': 'Track all your domains with automated renewal alerts, cost monitoring, and status updates',
    'features.analytics.title': 'Investment Analytics',
    'features.analytics.desc': 'Calculate ROI, track profits, and analyze performance with detailed financial reports',
    'features.data.title': 'Market Intelligence',
    'features.data.desc': 'Get domain valuations, market trends, and pricing insights to make smart investment decisions',
    'features.security.title': 'Secure & Reliable',
    'features.security.desc': 'Your data is protected with enterprise-grade security and automatic backups',
    
    // Benefits
    'benefits.title': 'Complete Domain Investment Solution',
    'benefits.subtitle': 'From portfolio tracking to ROI analysis, 66Do provides everything you need to succeed in domain investing',
    'benefits.portfolio.title': 'Portfolio Tracking',
    'benefits.portfolio.desc': 'Monitor all your domains with automated renewal alerts and cost tracking',
    'benefits.analytics.title': 'ROI Analysis',
    'benefits.analytics.desc': 'Track investment returns, calculate profits, and optimize your domain strategy',
    'benefits.market.title': 'Market Insights',
    'benefits.market.desc': 'Access domain valuation data and market trends to make informed decisions',
    'benefits.startTrial': 'Start Free Trial',
    
    // Stats
    'stats.totalUsers': 'Active Users',
    'stats.portfolioValue': 'Portfolio Value',
    'stats.investmentCount': 'Domains Managed',
    'stats.successRate': 'User Satisfaction',
    
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
    'auth.registrationSuccess': 'Registration Successful!',
    'auth.checkEmail': 'Account created successfully! Redirecting to login page...',
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
    'home.subtitle': '专业的域名投资管理工具，帮助您追踪域名投资组合、管理成本和收益。专注于域名投资的专业平台。',
    'home.getStarted': '立即开始',
    'home.learnMore': '了解更多',
    'home.startFree': '免费开始',
    'home.startJourney': '准备开始您的域名投资之旅？',
    'home.joinThousands': '加入数千名成功的域名投资者，他们信任66Do进行投资组合管理',
    
    // Features
    'features.title': '核心功能',
    'features.subtitle': '域名投资成功所需的一切功能',
    'features.portfolio.title': '投资组合管理',
    'features.portfolio.desc': '追踪所有域名，自动续费提醒，成本监控和状态更新',
    'features.analytics.title': '投资分析',
    'features.analytics.desc': '计算ROI，追踪利润，通过详细财务报告分析投资表现',
    'features.data.title': '市场情报',
    'features.data.desc': '获取域名估值、市场趋势和定价洞察，做出明智的投资决策',
    'features.security.title': '安全可靠',
    'features.security.desc': '企业级安全保护和自动备份，确保您的数据安全',
    
    // Benefits
    'benefits.title': '完整的域名投资解决方案',
    'benefits.subtitle': '从投资组合追踪到ROI分析，66Do提供域名投资成功所需的一切',
    'benefits.portfolio.title': '投资组合追踪',
    'benefits.portfolio.desc': '监控所有域名，自动续费提醒和成本追踪',
    'benefits.analytics.title': 'ROI分析',
    'benefits.analytics.desc': '追踪投资回报，计算利润，优化您的域名投资策略',
    'benefits.market.title': '市场洞察',
    'benefits.market.desc': '获取域名估值数据和市场趋势，做出明智的投资决策',
    'benefits.startTrial': '免费开始',
    
    // Stats
    'stats.totalUsers': '活跃用户',
    'stats.portfolioValue': '投资组合价值',
    'stats.investmentCount': '管理域名数',
    'stats.successRate': '用户满意度',
    
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
    'auth.registrationSuccess': '注册成功！',
    'auth.checkEmail': '账户创建成功！正在跳转到登录页面...',
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
