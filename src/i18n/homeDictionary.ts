import type { Metadata } from 'next';
import { getSiteUrl } from '../lib/siteUrl';

export type HomeLocale = 'zh' | 'en';

const LOCALE_COOKIE = 'domain_financial_locale';

type CookieStoreLike = { get(name: string): { value: string } | undefined };

/** 与客户端 localStorage key 一致，供首页 SSR / generateMetadata 读取 */
export function resolveHomeLocale(
  cookieStore: CookieStoreLike,
  acceptLanguage: string | null | undefined
): HomeLocale {
  const raw = cookieStore.get(LOCALE_COOKIE)?.value;
  if (raw === 'zh' || raw === 'en') return raw;
  const al = (acceptLanguage || '').toLowerCase();
  if (al.startsWith('zh')) return 'zh';
  return 'en';
}

export { LOCALE_COOKIE };

export interface HomeDictionary {
  htmlLang: string;
  platform: { name: string };
  settings: { selectLanguage: string };
  nav: { signIn: string; goToDashboard: string };
  home: {
    title: string;
    subtitle: string;
    getStarted: string;
    startJourney: string;
    trustedBy: string;
    joinThousands: string;
    startFree: string;
    feature1: string;
    feature2: string;
    feature3: string;
    feature4: string;
  };
  features: {
    title: string;
    subtitle: string;
    portfolio: { title: string; desc: string };
    analytics: { title: string; desc: string };
    data: { title: string; desc: string };
    security: { title: string; desc: string };
  };
  benefits: {
    title: string;
    subtitle: string;
    portfolio: { title: string; desc: string };
    analytics: { title: string; desc: string };
    market: { title: string; desc: string };
  };
  footer: {
    description: string;
    product: string;
    investmentManagement: string;
    dataAnalytics: string;
    performanceTracking: string;
    support: string;
    contactUs: string;
    changelog: string;
    privacyPolicy: string;
    contact: string;
    privacyShort: string;
    termsShort: string;
    cookiesShort: string;
    termsOfService: string;
    socialComingSoon: string;
    copyrightSuffix: string;
  };
}

const zh: HomeDictionary = {
  htmlLang: 'zh-CN',
  platform: { name: 'Domain.Financial' },
  settings: { selectLanguage: '选择语言' },
  nav: { signIn: '登录', goToDashboard: '进入仪表板' },
  home: {
    title: 'Domain.Financial – 追踪与增值你的域名',
    subtitle:
      '智能化的域名管理工具，帮您轻松追踪每个域名的成本、收益与表现。',
    getStarted: '开始使用',
    startJourney: '开始您的域名投资之旅',
    trustedBy: '已有 200+ 域名投资者使用',
    joinThousands:
      '加入域名投资者使用 Domain.Financial 追踪他们的域名投资组合',
    startFree: '免费开始',
    feature1: '从一个域名开始，管理你的数字资产。',
    feature2: '记录购买、出售与到期时间。',
    feature3: '已有用户开始用它管理他们的域名收藏。',
    feature4: '免费使用，持续改进中。',
  },
  features: {
    title: '核心功能',
    subtitle: '为域名持有者量身打造的智能管理工具',
    portfolio: {
      title: '域名组合管理',
      desc: '全面记录并追踪您的域名，轻松掌握动态',
    },
    analytics: {
      title: '数据分析',
      desc: '可视化分析域名表现，帮助您更好地规划决策',
    },
    data: {
      title: '智能洞察',
      desc: '通过数据趋势发现潜在机会与风险',
    },
    security: {
      title: '数据安全',
      desc: '加密存储与隔离机制，保障您的信息安全',
    },
  },
  benefits: {
    title: '为什么选择我们',
    subtitle: '少操心、少遗漏，把时间花在好域名上',
    portfolio: {
      title: '一个地方管好所有域名',
      desc: '不再遗漏续费，统一记录与追踪所有域名状态',
    },
    analytics: {
      title: '决策更清晰',
      desc: '数据可视化，续费与出售决策一目了然',
    },
    market: {
      title: '发现趋势与机会',
      desc: '优化成本，抓住买卖时机',
    },
  },
  footer: {
    description:
      '专业的域名投资管理平台，帮助投资者追踪投资组合、分析数据、优化收益。',
    product: '产品',
    investmentManagement: '投资管理',
    dataAnalytics: '数据分析',
    performanceTracking: '表现追踪',
    support: '支持',
    contactUs: '联系我们',
    changelog: '更新日志',
    privacyPolicy: '隐私政策',
    contact: '联系方式',
    privacyShort: '隐私',
    termsShort: '条款',
    cookiesShort: 'Cookie',
    termsOfService: '服务条款',
    socialComingSoon: '即将推出',
    copyrightSuffix: '保留所有权利。',
  },
};

const en: HomeDictionary = {
  htmlLang: 'en',
  platform: { name: 'Domain.Financial' },
  settings: { selectLanguage: 'Select language' },
  nav: { signIn: 'Sign In', goToDashboard: 'Go to Dashboard' },
  home: {
    title: 'Domain.Financial – Track & Grow Your Domains',
    subtitle:
      'Intelligent domain management tools to help you easily track the cost, revenue and performance of each domain.',
    getStarted: 'Get Started',
    startJourney: 'Start Your Domain Investment Journey',
    trustedBy: 'Trusted by 200+ domain investors',
    joinThousands:
      'Join domain investors using Domain.Financial to track their domain portfolios',
    startFree: 'Start Free',
    feature1: 'Start with one domain and manage your digital assets.',
    feature2: 'Track purchases, sales, and expiration dates.',
    feature3: 'Users are already using it to manage their domain collections.',
    feature4: 'Free to use, continuously improving.',
  },
  features: {
    title: 'Core Features',
    subtitle: 'Intelligent management tools designed for domain holders',
    portfolio: {
      title: 'Domain Portfolio Management',
      desc: 'Comprehensive recording and tracking of your domains with easy status monitoring',
    },
    analytics: {
      title: 'Data Analysis',
      desc: 'Visual analysis of domain performance to help you make better planning decisions',
    },
    data: {
      title: 'Smart Insights',
      desc: 'Discover potential opportunities and risks through data trends',
    },
    security: {
      title: 'Data Security',
      desc: 'Encrypted storage and isolation mechanisms to protect your information security',
    },
  },
  benefits: {
    title: 'Why Choose Us',
    subtitle: 'Spend less time on spreadsheets, more on the domains that matter',
    portfolio: {
      title: 'All domains in one place',
      desc: 'Never miss a renewal—unified recording and tracking of all domain statuses',
    },
    analytics: {
      title: 'Clearer decisions',
      desc: 'Charts and data so you know when to renew or sell',
    },
    market: {
      title: 'Spot trends and opportunities',
      desc: 'Optimize costs and seize buying or selling opportunities',
    },
  },
  footer: {
    description:
      'Professional domain investment management platform, helping investors track portfolios, analyze data, and optimize returns.',
    product: 'Product',
    investmentManagement: 'Investment Management',
    dataAnalytics: 'Data Analytics',
    performanceTracking: 'Performance Tracking',
    support: 'Support',
    contactUs: 'Contact Us',
    changelog: 'Changelog',
    privacyPolicy: 'Privacy Policy',
    contact: 'Contact',
    privacyShort: 'Privacy',
    termsShort: 'Terms',
    cookiesShort: 'Cookies',
    termsOfService: 'Terms of Service',
    socialComingSoon: 'Coming soon',
    copyrightSuffix: 'All rights reserved.',
  },
};

export function getHomeDictionary(locale: HomeLocale): HomeDictionary {
  return locale === 'zh' ? zh : en;
}

export function homePageMetadata(locale: HomeLocale): Metadata {
  const d = getHomeDictionary(locale);
  const isZh = locale === 'zh';
  const base = getSiteUrl();
  const canonical = new URL(`/${locale}`, base).href;
  const zhUrl = new URL('/zh', base).href;
  const enUrl = new URL('/en', base).href;
  return {
    title: d.home.title,
    description: d.home.subtitle,
    alternates: {
      canonical,
      languages: {
        'zh-CN': zhUrl,
        en: enUrl,
        'x-default': enUrl,
      },
    },
    openGraph: {
      url: canonical,
      title: d.home.title,
      description: d.home.subtitle,
      locale: isZh ? 'zh_CN' : 'en_US',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: d.home.title,
      description: d.home.subtitle,
    },
  };
}
