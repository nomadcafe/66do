'use client';

import { useState, useEffect } from 'react';

type Locale = 'zh' | 'en';

interface Translations {
  [key: string]: string | Translations;
}

// 翻译数据
const translations: Record<Locale, Translations> = {
  zh: {
    platform: {
      name: '66Do',
      subtitle: '域名投资平台'
    },
    navigation: {
      signIn: '登录',
      signUp: '注册',
      signOut: '退出登录',
      overview: '概览',
      domains: '域名',
      transactions: '交易',
      analytics: '分析',
      alerts: '提醒',
      marketplace: '市场',
      settings: '设置',
      data: '数据'
    },
    auth: {
      signIn: {
        title: '登录账户',
        subtitle: '登录到您的账户',
        email: '邮箱地址',
        password: '密码',
        submit: '登录',
        noAccount: '还没有账户？',
        signUpLink: '立即注册'
      },
      signUp: {
        title: '创建账户',
        subtitle: '注册新账户',
        email: '邮箱地址',
        password: '密码',
        confirmPassword: '确认密码',
        submit: '注册',
        hasAccount: '已有账户？',
        signInLink: '立即登录'
      },
      verify: {
        title: '验证邮箱',
        subtitle: '请输入发送到您邮箱的验证码',
        code: '验证码',
        submit: '验证',
        resend: '重新发送',
        backToLogin: '返回登录'
      }
    },
    dashboard: {
      title: '域名投资仪表板',
      welcome: '欢迎回来',
      totalInvestments: '总投资',
      totalCost: '总成本',
      totalRevenue: '总收入',
      totalProfit: '净利润',
      roi: '投资回报率',
      addInvestment: '添加域名',
      editInvestment: '编辑域名',
      deleteInvestment: '删除域名',
      investmentName: '域名名称',
      investmentAmount: '投资金额',
      investmentNamePlaceholder: '例如：example.com、mydomain.net等',
      cancel: '取消',
      add: '添加',
      save: '保存',
      delete: '删除',
      confirm: '确认',
      noInvestments: '还没有添加任何域名',
      addFirstInvestment: '添加第一个域名'
    },
    mobile: {
      menu: '菜单',
      close: '关闭',
      swipeToNavigate: '滑动导航',
      tapToExpand: '点击展开',
      pullToRefresh: '下拉刷新'
    },
    gesture: {
      swipeLeft: '向左滑动',
      swipeRight: '向右滑动',
      pullDown: '下拉',
      pullUp: '上拉'
    },
    responsive: {
      mobileView: '移动视图',
      tabletView: '平板视图',
      desktopView: '桌面视图'
    },
    touch: {
      tap: '点击',
      doubleTap: '双击',
      longPress: '长按',
      swipe: '滑动'
    },
    stats: {
      totalUsers: '活跃用户',
      portfolioValue: '投资组合价值',
      domainsManaged: '管理域名数',
      successRate: '成功率',
      investmentCount: '投资数量'
    },
    home: {
      title: '域名投资平台',
      subtitle: '专业的域名投资管理工具，帮助您追踪域名投资组合、管理成本和收益。专注于域名投资。',
      getStarted: '开始使用',
      startJourney: '开始您的域名投资之旅',
      joinThousands: '加入域名投资者使用66Do追踪他们的域名投资组合',
      startFree: '免费开始'
    },
    nav: {
      goToDashboard: '进入仪表板'
    },
    features: {
      title: '核心功能',
      subtitle: '为域名投资者量身定制的专业工具',
      portfolio: {
        title: '投资组合管理',
        desc: '全面追踪您的域名投资组合，实时监控投资表现'
      },
      analytics: {
        title: '投资分析',
        desc: '深度分析投资数据，提供专业的投资洞察和建议'
      },
      data: {
        title: '数据智能',
        desc: '智能数据处理，让您的投资决策更加精准'
      },
      security: {
        title: '安全可靠',
        desc: '企业级安全保障，保护您的投资数据安全'
      }
    },
    benefits: {
      title: '为什么选择我们',
      subtitle: '专业的域名投资管理解决方案',
      portfolio: {
        title: '投资组合追踪',
        desc: '实时监控您的域名投资组合表现'
      },
      analytics: {
        title: '投资分析',
        desc: '深度分析投资数据，提供专业洞察'
      },
      market: {
        title: '市场洞察',
        desc: '获取最新的域名市场趋势和机会'
      }
    }
  },
  en: {
    platform: {
      name: '66Do',
      subtitle: 'Domain Investment Platform'
    },
    navigation: {
      signIn: 'Sign In',
      signUp: 'Sign Up',
      signOut: 'Sign Out',
      overview: 'Overview',
      domains: 'Domains',
      transactions: 'Transactions',
      analytics: 'Analytics',
      alerts: 'Alerts',
      marketplace: 'Marketplace',
      settings: 'Settings',
      data: 'Data'
    },
    auth: {
      signIn: {
        title: 'Sign in to your account',
        subtitle: 'Enter your credentials to access your account',
        email: 'Email address',
        password: 'Password',
        submit: 'Sign In',
        noAccount: 'Don\'t have an account?',
        signUpLink: 'Sign up now'
      },
      signUp: {
        title: 'Create your account',
        subtitle: 'Sign up for a new account',
        email: 'Email address',
        password: 'Password',
        confirmPassword: 'Confirm password',
        submit: 'Sign Up',
        hasAccount: 'Already have an account?',
        signInLink: 'Sign in now'
      },
      verify: {
        title: 'Verify your email',
        subtitle: 'Enter the verification code sent to your email',
        code: 'Verification code',
        submit: 'Verify',
        resend: 'Resend code',
        backToLogin: 'Back to login'
      }
    },
    dashboard: {
      title: 'Domain Investment Dashboard',
      welcome: 'Welcome back',
      totalInvestments: 'Total Investments',
      totalCost: 'Total Cost',
      totalRevenue: 'Total Revenue',
      totalProfit: 'Net Profit',
      roi: 'ROI',
      addInvestment: 'Add Domain',
      editInvestment: 'Edit Domain',
      deleteInvestment: 'Delete Domain',
      investmentName: 'Domain Name',
      investmentAmount: 'Investment Amount',
      investmentNamePlaceholder: 'e.g., example.com, mydomain.net, etc.',
      cancel: 'Cancel',
      add: 'Add',
      save: 'Save',
      delete: 'Delete',
      confirm: 'Confirm',
      noInvestments: 'No domains added yet',
      addFirstInvestment: 'Add your first domain'
    },
    mobile: {
      menu: 'Menu',
      close: 'Close',
      swipeToNavigate: 'Swipe to navigate',
      tapToExpand: 'Tap to expand',
      pullToRefresh: 'Pull to refresh'
    },
    gesture: {
      swipeLeft: 'Swipe left',
      swipeRight: 'Swipe right',
      pullDown: 'Pull down',
      pullUp: 'Pull up'
    },
    responsive: {
      mobileView: 'Mobile view',
      tabletView: 'Tablet view',
      desktopView: 'Desktop view'
    },
    touch: {
      tap: 'Tap',
      doubleTap: 'Double tap',
      longPress: 'Long press',
      swipe: 'Swipe'
    },
    stats: {
      totalUsers: 'Active Users',
      portfolioValue: 'Portfolio Value',
      domainsManaged: 'Domains Managed',
      successRate: 'Success Rate',
      investmentCount: 'Investment Count'
    },
    home: {
      title: 'Domain Investment Platform',
      subtitle: 'Professional domain investment management tools to help you track domain portfolios, monitor renewals, and maximize returns. Focused on domain investment.',
      getStarted: 'Get Started',
      startJourney: 'Start Your Domain Investment Journey',
      joinThousands: 'Join domain investors using 66Do to track their domain portfolios',
      startFree: 'Start Free'
    },
    nav: {
      goToDashboard: 'Go to Dashboard'
    },
    features: {
      title: 'Core Features',
      subtitle: 'Professional tools tailored for domain investors',
      portfolio: {
        title: 'Portfolio Management',
        desc: 'Comprehensive tracking of your domain investment portfolio with real-time performance monitoring'
      },
      analytics: {
        title: 'Investment Analytics',
        desc: 'Deep analysis of investment data with professional insights and recommendations'
      },
      data: {
        title: 'Data Intelligence',
        desc: 'Smart data processing to make your investment decisions more precise'
      },
      security: {
        title: 'Secure & Reliable',
        desc: 'Enterprise-grade security to protect your investment data'
      }
    },
    benefits: {
      title: 'Why Choose Us',
      subtitle: 'Professional domain investment management solution',
      portfolio: {
        title: 'Portfolio Tracking',
        desc: 'Real-time monitoring of your domain investment portfolio performance'
      },
      analytics: {
        title: 'Investment Analytics',
        desc: 'Deep analysis of investment data with professional insights'
      },
      market: {
        title: 'Market Insights',
        desc: 'Get the latest domain market trends and opportunities'
      }
    }
  }
};

// 获取嵌套对象的值
function getNestedValue(obj: Record<string, unknown>, path: string): string {
  const keys = path.split('.');
  let current: unknown = obj;
  
  for (const key of keys) {
    if (current && typeof current === 'object' && current !== null && key in current) {
      current = (current as Record<string, unknown>)[key];
    } else {
      return path; // 如果路径不存在，返回原始键
    }
  }
  
  return typeof current === 'string' ? current : path;
}

export function useI18n() {
  const [locale, setLocale] = useState<Locale>('zh');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // 从localStorage获取保存的语言设置
    const savedLocale = localStorage.getItem('66do-locale') as Locale;
    if (savedLocale && (savedLocale === 'zh' || savedLocale === 'en')) {
      setLocale(savedLocale);
    } else {
      // 检测浏览器语言
      const browserLang = navigator.language || navigator.languages?.[0] || 'en';
      const detectedLocale = browserLang.startsWith('zh') ? 'zh' : 'en';
      setLocale(detectedLocale);
    }
    setIsLoading(false);
  }, []);

  const changeLocale = (newLocale: Locale) => {
    setLocale(newLocale);
    localStorage.setItem('66do-locale', newLocale);
  };

  const t = (key: string): string => {
    if (isLoading) return key;
    return getNestedValue(translations[locale], key);
  };

  return {
    locale,
    setLocale: changeLocale,
    t,
    isLoading
  };
}
