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
    'stats.successRate': 'Success Rate',
    
    // Dashboard
    'dashboard.overview': 'Overview',
    'dashboard.domains': 'Domains',
    'dashboard.transactions': 'Transactions',
    'dashboard.analytics': 'Analytics',
    'dashboard.alerts': 'Alerts',
    'dashboard.marketplace': 'Marketplace',
    'dashboard.settings': 'Settings',
    'dashboard.data': 'Data Management',
    'dashboard.reports': 'Reports',
    'dashboard.analysis': 'Analysis',
    
    // Domain Management
    'domain.add': 'Add Domain',
    'domain.edit': 'Edit Domain',
    'domain.delete': 'Delete Domain',
    'domain.view': 'View Details',
    'domain.share': 'Share Success',
    'domain.name': 'Domain Name',
    'domain.registrar': 'Registrar',
    'domain.purchaseDate': 'Purchase Date',
    'domain.purchaseCost': 'Purchase Cost',
    'domain.renewalCost': 'Renewal Cost',
    'domain.renewalCycle': 'Renewal Cycle (Years)',
    'domain.renewalCount': 'Renewal Count',
    'domain.expiryDate': 'Expiry Date',
    'domain.status': 'Status',
    'domain.estimatedValue': 'Estimated Value',
    'domain.tags': 'Tags',
    'domain.saleDate': 'Sale Date',
    'domain.salePrice': 'Sale Price',
    'domain.platformFee': 'Platform Fee',
    'domain.totalHoldingCost': 'Total Holding Cost',
    'domain.netProfit': 'Net Profit',
    'domain.roi': 'ROI',
    'domain.holdingPeriod': 'Holding Period',
    
    // Transaction Management
    'transaction.add': 'Add Transaction',
    'transaction.edit': 'Edit Transaction',
    'transaction.delete': 'Delete Transaction',
    'transaction.type': 'Transaction Type',
    'transaction.amount': 'Amount',
    'transaction.currency': 'Currency',
    'transaction.exchangeRate': 'Exchange Rate',
    'transaction.platformFee': 'Platform Fee',
    'transaction.platformFeePercentage': 'Platform Fee (%)',
    'transaction.netAmount': 'Net Amount',
    'transaction.date': 'Date',
    'transaction.notes': 'Notes',
    'transaction.platform': 'Platform',
    'transaction.category': 'Category',
    'transaction.taxDeductible': 'Tax Deductible',
    'transaction.receiptUrl': 'Receipt URL',
    'transaction.buy': 'Purchase',
    'transaction.renew': 'Renewal',
    'transaction.sell': 'Sale',
    'transaction.transfer': 'Transfer',
    'transaction.fee': 'Fee',
    'transaction.marketing': 'Marketing',
    'transaction.advertising': 'Advertising',
    
    // Financial Metrics
    'financial.totalInvestment': 'Total Investment',
    'financial.totalRevenue': 'Total Revenue',
    'financial.totalProfit': 'Total Profit',
    'financial.totalSales': 'Total Sales',
    'financial.annualSales': 'Annual Sales',
    'financial.annualProfit': 'Annual Profit',
    'financial.platformFees': 'Platform Fees',
    'financial.roi': 'ROI',
    'financial.profitMargin': 'Profit Margin',
    'financial.activeDomains': 'Active Domains',
    'financial.soldDomains': 'Sold Domains',
    'financial.avgHoldingPeriod': 'Avg Holding Period',
    'financial.bestPerforming': 'Best Performing',
    'financial.worstPerforming': 'Worst Performing',
    
    // Status
    'status.active': 'Active',
    'status.forSale': 'For Sale',
    'status.sold': 'Sold',
    'status.expired': 'Expired',
    
    // Actions
    'action.save': 'Save',
    'action.cancel': 'Cancel',
    'action.delete': 'Delete',
    'action.edit': 'Edit',
    'action.view': 'View',
    'action.share': 'Share',
    'action.download': 'Download',
    'action.export': 'Export',
    'action.import': 'Import',
    'action.backup': 'Backup',
    'action.restore': 'Restore',
    'action.generate': 'Generate',
    'action.refresh': 'Refresh',
    'action.filter': 'Filter',
    'action.sort': 'Sort',
    'action.search': 'Search',
    'action.quickActions': 'Quick Actions',
    
    // Messages
    'message.success': 'Success',
    'message.error': 'Error',
    'message.warning': 'Warning',
    'message.info': 'Information',
    'message.loading': 'Loading...',
    'message.saving': 'Saving...',
    'message.deleting': 'Deleting...',
    'message.confirmDelete': 'Are you sure you want to delete this item?',
    'message.dataSaved': 'Data saved successfully',
    'message.dataDeleted': 'Data deleted successfully',
    'message.dataImported': 'Data imported successfully',
    'message.dataExported': 'Data exported successfully',
    'message.noData': 'No data available',
    'message.selectDomain': 'Please select a domain',
    'message.fillRequired': 'Please fill in all required fields',
    
    // Share
    'share.title': 'Share Investment Results',
    'share.generate': 'Generate Share Image',
    'share.download': 'Download Image',
    'share.social': 'Share to Social Media',
    'share.twitter': 'Twitter',
    'share.linkedin': 'LinkedIn',
    'share.facebook': 'Facebook',
    'share.wechat': 'WeChat',
    'share.copied': 'Content copied to clipboard',
    
    // Reports
    'reports.title': 'Financial Reports',
    'reports.period': 'Report Period',
    'reports.all': 'All Time',
    'reports.year': 'This Year',
    'reports.quarter': 'This Quarter',
    'reports.month': 'This Month',
    'reports.generate': 'Generate Report',
    'reports.download': 'Download Report',
    
    // Settings
    'settings.title': 'Settings',
    'settings.language': 'Language',
    'settings.currency': 'Currency',
    'settings.notifications': 'Notifications',
    'settings.privacy': 'Privacy',
    'settings.display': 'Display',
    'settings.theme': 'Theme',
    'settings.light': 'Light',
    'settings.dark': 'Dark',
    'settings.auto': 'Auto',
    
    // Data Management
    'data.title': 'Data Management',
    'data.import': 'Import Data',
    'data.export': 'Export Data',
    'data.backup': 'Backup Data',
    'data.restore': 'Restore Data',
    'data.format': 'Data Format',
    'data.json': 'JSON',
    'data.csv': 'CSV',
    'data.excel': 'Excel',
    
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
    'platform.subtitle': 'Domain Investment Platform',
    
    // Mobile specific
    'mobile.menu': 'Menu',
    'mobile.close': 'Close',
    'mobile.swipeToNavigate': 'Swipe to navigate',
    'mobile.tapToExpand': 'Tap to expand',
    'mobile.pullToRefresh': 'Pull to refresh',
    
    // Navigation
    'nav.overview': 'Overview',
    'nav.domains': 'Domains',
    'nav.transactions': 'Transactions',
    'nav.analytics': 'Analytics',
    'nav.alerts': 'Alerts',
    'nav.marketplace': 'Marketplace',
    'nav.settings': 'Settings',
    'nav.data': 'Data',
    
    // Mobile gestures
    'gesture.swipeLeft': 'Swipe left',
    'gesture.swipeRight': 'Swipe right',
    'gesture.pullDown': 'Pull down',
    'gesture.pullUp': 'Pull up',
    
    // Responsive design
    'responsive.mobileView': 'Mobile view',
    'responsive.tabletView': 'Tablet view',
    'responsive.desktopView': 'Desktop view',
    
    // Touch interactions
    'touch.tap': 'Tap',
    'touch.doubleTap': 'Double tap',
    'touch.longPress': 'Long press',
    'touch.swipe': 'Swipe'
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
    'stats.successRate': '成功率',
    
    // Dashboard
    'dashboard.overview': '概览',
    'dashboard.domains': '域名管理',
    'dashboard.transactions': '交易记录',
    'dashboard.analytics': '数据分析',
    'dashboard.alerts': '提醒通知',
    'dashboard.marketplace': '域名市场',
    'dashboard.settings': '设置',
    'dashboard.data': '数据管理',
    'dashboard.reports': '财务报告',
    'dashboard.analysis': '投资分析',
    
    // Domain Management
    'domain.add': '添加域名',
    'domain.edit': '编辑域名',
    'domain.delete': '删除域名',
    'domain.view': '查看详情',
    'domain.share': '分享成功',
    'domain.name': '域名名称',
    'domain.registrar': '注册商',
    'domain.purchaseDate': '购买日期',
    'domain.purchaseCost': '购买成本',
    'domain.renewalCost': '续费成本',
    'domain.renewalCycle': '续费周期（年）',
    'domain.renewalCount': '续费次数',
    'domain.expiryDate': '到期日期',
    'domain.status': '状态',
    'domain.estimatedValue': '估值',
    'domain.tags': '标签',
    'domain.saleDate': '出售日期',
    'domain.salePrice': '出售价格',
    'domain.platformFee': '平台手续费',
    'domain.totalHoldingCost': '总持有成本',
    'domain.netProfit': '净利润',
    'domain.roi': '投资回报率',
    'domain.holdingPeriod': '持有时间',
    
    // Transaction Management
    'transaction.add': '添加交易',
    'transaction.edit': '编辑交易',
    'transaction.delete': '删除交易',
    'transaction.type': '交易类型',
    'transaction.amount': '金额',
    'transaction.currency': '货币',
    'transaction.exchangeRate': '汇率',
    'transaction.platformFee': '平台手续费',
    'transaction.platformFeePercentage': '手续费百分比',
    'transaction.netAmount': '净收入',
    'transaction.date': '日期',
    'transaction.notes': '备注',
    'transaction.platform': '平台',
    'transaction.category': '分类',
    'transaction.taxDeductible': '可抵税',
    'transaction.receiptUrl': '收据链接',
    'transaction.buy': '购买',
    'transaction.renew': '续费',
    'transaction.sell': '出售',
    'transaction.transfer': '转移',
    'transaction.fee': '费用',
    'transaction.marketing': '营销',
    'transaction.advertising': '广告',
    
    // Financial Metrics
    'financial.totalInvestment': '总投资',
    'financial.totalRevenue': '总收入',
    'financial.totalProfit': '总利润',
    'financial.totalSales': '总销售额',
    'financial.annualSales': '年度销售额',
    'financial.annualProfit': '年度净利润',
    'financial.platformFees': '平台手续费',
    'financial.roi': '投资回报率',
    'financial.profitMargin': '利润率',
    'financial.activeDomains': '活跃域名',
    'financial.soldDomains': '已售域名',
    'financial.avgHoldingPeriod': '平均持有期',
    'financial.bestPerforming': '表现最佳',
    'financial.worstPerforming': '表现最差',
    
    // Status
    'status.active': '活跃',
    'status.forSale': '待售',
    'status.sold': '已售',
    'status.expired': '已过期',
    
    // Actions
    'action.save': '保存',
    'action.cancel': '取消',
    'action.delete': '删除',
    'action.edit': '编辑',
    'action.view': '查看',
    'action.share': '分享',
    'action.download': '下载',
    'action.export': '导出',
    'action.import': '导入',
    'action.backup': '备份',
    'action.restore': '恢复',
    'action.generate': '生成',
    'action.refresh': '刷新',
    'action.filter': '筛选',
    'action.sort': '排序',
    'action.search': '搜索',
    'action.quickActions': '快速操作',
    
    // Messages
    'message.success': '成功',
    'message.error': '错误',
    'message.warning': '警告',
    'message.info': '信息',
    'message.loading': '加载中...',
    'message.saving': '保存中...',
    'message.deleting': '删除中...',
    'message.confirmDelete': '确定要删除此项吗？',
    'message.dataSaved': '数据保存成功',
    'message.dataDeleted': '数据删除成功',
    'message.dataImported': '数据导入成功',
    'message.dataExported': '数据导出成功',
    'message.noData': '暂无数据',
    'message.selectDomain': '请选择域名',
    'message.fillRequired': '请填写所有必填字段',
    
    // Share
    'share.title': '分享投资成果',
    'share.generate': '生成分享图片',
    'share.download': '下载图片',
    'share.social': '分享到社交媒体',
    'share.twitter': 'Twitter',
    'share.linkedin': 'LinkedIn',
    'share.facebook': 'Facebook',
    'share.wechat': '微信',
    'share.copied': '内容已复制到剪贴板',
    
    // Reports
    'reports.title': '财务报告',
    'reports.period': '报告周期',
    'reports.all': '全部时间',
    'reports.year': '今年',
    'reports.quarter': '本季度',
    'reports.month': '本月',
    'reports.generate': '生成报告',
    'reports.download': '下载报告',
    
    // Settings
    'settings.title': '设置',
    'settings.language': '语言',
    'settings.currency': '货币',
    'settings.notifications': '通知',
    'settings.privacy': '隐私',
    'settings.display': '显示',
    'settings.theme': '主题',
    'settings.light': '浅色',
    'settings.dark': '深色',
    'settings.auto': '自动',
    
    // Data Management
    'data.title': '数据管理',
    'data.import': '导入数据',
    'data.export': '导出数据',
    'data.backup': '备份数据',
    'data.restore': '恢复数据',
    'data.format': '数据格式',
    'data.json': 'JSON',
    'data.csv': 'CSV',
    'data.excel': 'Excel',
    
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
    'platform.subtitle': '域名投资平台',
    
    // Mobile specific
    'mobile.menu': '菜单',
    'mobile.close': '关闭',
    'mobile.swipeToNavigate': '滑动导航',
    'mobile.tapToExpand': '点击展开',
    'mobile.pullToRefresh': '下拉刷新',
    
    // Navigation
    'nav.overview': '概览',
    'nav.domains': '域名',
    'nav.transactions': '交易',
    'nav.analytics': '分析',
    'nav.alerts': '提醒',
    'nav.marketplace': '市场',
    'nav.settings': '设置',
    'nav.data': '数据',
    
    // Mobile gestures
    'gesture.swipeLeft': '向左滑动',
    'gesture.swipeRight': '向右滑动',
    'gesture.pullDown': '下拉',
    'gesture.pullUp': '上拉',
    
    // Responsive design
    'responsive.mobileView': '移动视图',
    'responsive.tabletView': '平板视图',
    'responsive.desktopView': '桌面视图',
    
    // Touch interactions
    'touch.tap': '点击',
    'touch.doubleTap': '双击',
    'touch.longPress': '长按',
    'touch.swipe': '滑动'
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
