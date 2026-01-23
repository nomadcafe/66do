'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSupabaseAuth } from '../../src/contexts/SupabaseAuthContext';
import { useI18nContext } from '../../src/contexts/I18nProvider';
import { logger } from '../../src/lib/logger';
import DomainList from '../../src/components/domain/DomainList';
import DomainForm from '../../src/components/domain/DomainForm';
import SmartDomainForm from '../../src/components/domain/SmartDomainForm';
import TransactionList from '../../src/components/transaction/TransactionList';
import TransactionForm from '../../src/components/transaction/TransactionForm';
import MobileNavigation from '../../src/components/layout/MobileNavigation';
// Mobile components for enhanced mobile experience
import TouchGestures from '../../src/components/mobile/TouchGestures';
import PullToRefresh from '../../src/components/mobile/PullToRefresh';
import { isMobile } from '../../src/lib/utils';
import ShareModal from '../../src/components/share/ShareModal';
import SaleSuccessModal from '../../src/components/share/SaleSuccessModal';
import RenewalModal from '../../src/components/domain/RenewalModal';
import { calculateAnnualRenewalCost } from '../../src/lib/renewalCalculations';
// import { domainExpiryManager } from '../../src/lib/domainExpiryManager';
import { calculateEnhancedFinancialMetrics, formatCurrency as formatCurrencyEnhanced } from '../../src/lib/enhancedFinancialMetrics';
// 懒加载组件
import { 
  LazyFinancialReport, 
  LazyFinancialAnalysis, 
  LazyInvestmentAnalytics, 
  LazyAdvancedRenewalAnalysis, 
  LazyExpiredDomainLossAnalysis,
  LazyDataImportExport,
  LazyUserPreferencesPanel,
  LazyWrapper,
  useSmartPreload
} from '../../src/components/LazyComponents';
import { auditLogger } from '../../src/lib/security';
import LoadingSpinner from '../../src/components/ui/LoadingSpinner';
import ErrorMessage from '../../src/components/ui/ErrorMessage';
import { Domain } from '../../src/types/domain';
import { 
  DomainWithTags,
  TransactionWithRequiredFields,
  ensureDomainWithTags,
  ensureTransactionWithRequiredFields
} from '../../src/types/dashboard';
import { useDashboardData } from '../../src/hooks/useDashboardData';
import { useDomainOperations } from '../../src/hooks/useDomainOperations';
import { useTransactionOperations } from '../../src/hooks/useTransactionOperations';
import { useDomainStats } from '../../src/hooks/useDomainStats';
import { 
  Globe, 
  Plus, 
  DollarSign, 
  TrendingUp, 
  TrendingDown,
  BarChart3, 
  LogOut, 
  User, 
  FileText,
  AlertTriangle,
  Calendar,
  Award,
  Share2,
  PieChart,
  Activity,
  Bell,
  Settings,
  RefreshCw,
  Zap,
  CheckCircle,
  Database,
  Target,
  Info
} from 'lucide-react';

// Domain and Transaction types are now imported from supabaseService
// DomainStats is now imported from useDomainStats hook



export default function DashboardPage() {
  // 智能预加载组件
  useSmartPreload();
  
  const { user, session, loading: authLoading, signOut } = useSupabaseAuth();
  const { t, locale, setLocale } = useI18nContext();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'overview' | 'domains' | 'transactions' | 'analytics' | 'alerts' | 'settings' | 'data' | 'reports'>('overview');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showShareModal, setShowShareModal] = useState(false);
  
  // 使用自定义Hooks管理数据和操作
  const {
    domains,
    transactions,
    loading,
    error,
    dataSource,
    setError,
    saveData,
    refreshData
  } = useDashboardData(user?.id, session?.access_token, t);
  
  const stats = useDomainStats(domains, transactions);
  
  // 使用useCallback优化删除域名的函数
  const handleDeleteDomain = useCallback(async (id: string) => {
    if (!user?.id) return;
    try {
      // Use RESTful DELETE /api/domains/[id]
      const response = await fetch(`/api/domains/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!response.ok) throw new Error('Failed to delete domain');
      await refreshData();
    } catch (error) {
      setError(`Failed to delete domain: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [user?.id, refreshData, setError]);

  const domainOps = useDomainOperations(
    domains,
    saveData,
    handleDeleteDomain
  );
  
  const transactionOps = useTransactionOperations(
    transactions,
    domains,
    user?.id,
    saveData,
    async () => {
      // Delete handler is implemented in the hook
    },
    setError
  );
  
  // Redirect if not authenticated (but wait for auth to load)
  useEffect(() => {
    if (!authLoading && !user) {
      logger.log('No user found, redirecting to login');
      router.push('/login');
    }
  }, [user, authLoading, router]);

  // 计算续费分析 - 使用缓存优化性能
  const renewalAnalysis = useMemo(() => {
    const validDomains = domains
      .filter(domain => 
        domain.status === 'active' && 
        domain.renewal_cost !== null && 
        domain.purchase_date !== null
      )
      .map(domain => ({
        id: domain.id,
                domain_name: domain.domain_name,
        renewal_cost: domain.renewal_cost!,
                renewal_cycle: domain.renewal_cycle,
                renewal_count: domain.renewal_count,
        purchase_date: domain.purchase_date!,
        expiry_date: domain.expiry_date || undefined,
        status: domain.status
      }));
    
    return calculateAnnualRenewalCost(validDomains);
  }, [domains]);

  // 计算即将到期的域名（30天内）
  const expiringDomains = useMemo(() => {
    return domains.filter(domain => {
      // 跳过已出售的域名
      if (domain.status === 'sold') return false;
      if (!domain.expiry_date) return false;
      
      const daysUntilExpiry = Math.ceil((new Date(domain.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      return daysUntilExpiry <= 30 && daysUntilExpiry >= 0;
    }).map(domain => {
      const daysUntilExpiry = Math.ceil((new Date(domain.expiry_date!).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      return {
        ...domain,
        daysUntilExpiry,
        urgency: daysUntilExpiry <= 7 ? 'critical' : daysUntilExpiry <= 14 ? 'urgent' : 'normal'
      };
    }).sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
  }, [domains]);

  // 计算增强的财务指标
  const enhancedFinancialMetrics = useMemo(() => {
    const validDomains = domains
      .filter(domain => 
        domain.purchase_cost !== null && 
        domain.renewal_cost !== null &&
        domain.purchase_date !== null
      )
      .map(domain => ({
        id: domain.id,
        purchase_cost: domain.purchase_cost!,
        renewal_cost: domain.renewal_cost!,
        renewal_count: domain.renewal_count,
        status: domain.status,
        purchase_date: domain.purchase_date!
      }));
    
    const validTransactions = transactions
      .filter(transaction => transaction.amount !== null)
      .map(transaction => ({
        id: transaction.id,
        domain_id: transaction.domain_id,
        type: transaction.type,
        amount: transaction.amount!,
        platform_fee: transaction.platform_fee || undefined,
        net_amount: transaction.net_amount || undefined,
        date: transaction.date,
        category: transaction.category
      }));
    
    return calculateEnhancedFinancialMetrics(validDomains, validTransactions);
  }, [domains, transactions]);

  // 处理域名保存（保留此函数因为需要特殊处理）- 使用useCallback优化
  const handleSaveDomain = useCallback(async (domainData: Omit<DomainWithTags, 'id'>) => {
    try {
      if (domainOps.editingDomain) {
        const updatedDomain: DomainWithTags = {
          ...domainOps.editingDomain,
        ...domainData,
          updated_at: new Date().toISOString()
        };
        
        const updatedDomains = domains.map(domain =>
          domain.id === domainOps.editingDomain!.id ? updatedDomain : domain
        );
        
        await saveData(updatedDomains, transactions);
        domainOps.setEditingDomain(undefined);
        domainOps.setShowDomainForm(false);
        domainOps.setShowSmartDomainForm(false);
    } else {
        const newDomain: DomainWithTags = {
          ...domainData,
          id: crypto.randomUUID(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        
        const updatedDomains = [...domains, newDomain];
        await saveData(updatedDomains, transactions);
        domainOps.setShowDomainForm(false);
        domainOps.setShowSmartDomainForm(false);
      }
    } catch (error) {
      setError(`Failed to save domain: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setTimeout(() => setError(null), 3000);
    }
  }, [domainOps, domains, transactions, saveData, setError]);

  const handleViewDomain = useCallback((domain: DomainWithTags) => {
    domainOps.setEditingDomain(domain);
    domainOps.setShowDomainForm(true);
  }, [domainOps]);

  // Calculate share data for social media - 使用useMemo优化
  const shareData = useMemo(() => {
    const soldDomains = domains.filter(d => d.status === 'sold');
    const totalProfit = soldDomains.reduce((sum, domain) => {
      const totalHoldingCost = (domain.purchase_cost || 0) + (domain.renewal_count * (domain.renewal_cost || 0));
      const platformFee = domain.platform_fee || 0;
      return sum + (domain.sale_price || 0) - totalHoldingCost - platformFee;
    }, 0);
    
    const totalInvestment = domains.reduce((sum, domain) => {
      return sum + (domain.purchase_cost || 0) + (domain.renewal_count * (domain.renewal_cost || 0));
    }, 0);
    
    const roi = totalInvestment > 0 ? (totalProfit / totalInvestment) * 100 : 0;
    
    const bestDomain = soldDomains.reduce((best, domain) => {
      const domainProfit = (domain.sale_price || 0) - (domain.purchase_cost || 0) - (domain.renewal_count * (domain.renewal_cost || 0)) - (domain.platform_fee || 0);
      const bestProfit = (best.sale_price || 0) - (best.purchase_cost || 0) - (best.renewal_count * (best.renewal_cost || 0)) - (best.platform_fee || 0);
      return domainProfit > bestProfit ? domain : best;
    }, soldDomains[0] || { domain_name: 'N/A' });
    
    const investmentPeriod = domains.length > 0 ? 
      `${Math.ceil((new Date().getTime() - new Date(Math.min(...domains.filter(d => d.purchase_date).map(d => new Date(d.purchase_date!).getTime()))).getTime()) / (1000 * 60 * 60 * 24 * 30))}个月` : 
      '0个月';
    
    return {
      totalProfit,
      roi,
      bestDomain: bestDomain.domain_name,
      investmentPeriod,
      domainCount: domains.length,
      totalInvestment
    };
  }, [domains]);



  // Filter domains based on search and status

  if (loading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return <ErrorMessage message={error} onRetry={() => window.location.reload()} />;
  }

  // 显示认证加载状态
  if (authLoading) {
  return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">{t('common.verifyingIdentity')}</p>
            </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Desktop Header - Clean & Modern */}
      <div className="hidden lg:block bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex justify-between items-center py-8">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-sm">
                <Globe className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{t('platform.name')}</h1>
                <p className="text-sm text-gray-500 mt-1">{t('dashboard.title')}</p>
              </div>
            </div>
            <div className="flex items-center space-x-6">
              {/* Language Selector */}
              <div className="relative">
                <select
                  value={locale}
                  onChange={(e) => setLocale(e.target.value as 'en' | 'zh')}
                  className="appearance-none bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 shadow-sm hover:shadow-md cursor-pointer"
                >
                  <option value="zh">中文</option>
                  <option value="en">English</option>
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
              
              {/* User Info - 改进的样式 */}
              <div className="relative group">
                <div className="flex items-center space-x-3 px-4 py-2.5 bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md hover:border-blue-300 transition-all duration-200 cursor-pointer">
                  <div className="w-9 h-9 bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 rounded-full flex items-center justify-center shadow-md ring-2 ring-blue-100">
                    {user?.email ? (
                      <span className="text-sm font-semibold text-white">
                        {user.email.charAt(0).toUpperCase()}
                      </span>
                    ) : (
                      <User className="h-5 w-5 text-white" />
                    )}
              </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-gray-900 leading-tight">
                      {user?.email?.split('@')[0] || 'User'}
                    </span>
                    <span className="text-xs text-gray-500 leading-tight">
                      {user?.email || ''}
                    </span>
                  </div>
                  <svg className="w-4 h-4 text-gray-400 group-hover:text-gray-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
              
              {/* Action Buttons */}
              <button
                onClick={domainOps.handleAddDomain}
                className="bg-blue-600 text-white px-6 py-2.5 rounded-lg hover:bg-blue-700 flex items-center space-x-2 font-medium transition-all duration-200 shadow-sm hover:shadow-md"
              >
                <Plus size={18} />
                <span>{t('dashboard.addInvestment')}</span>
              </button>
              
              <button
                onClick={async () => {
                  await signOut();
                  router.push('/');
                }}
                className="text-gray-500 hover:text-gray-700 flex items-center space-x-2 px-3 py-2 rounded-lg hover:bg-gray-50 transition-all duration-200"
              >
                <LogOut size={18} />
                <span className="text-sm font-medium">{t('dashboard.signOut')}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Header - Clean & Modern */}
      <div className="lg:hidden bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-sm">
                <Globe className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900">{t('platform.name')}</h1>
                <p className="text-xs text-gray-500">{t('dashboard.title')}</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {/* Mobile User Avatar */}
              <div className="flex items-center space-x-2 px-3 py-2 bg-white border border-gray-200 rounded-xl shadow-sm">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 rounded-full flex items-center justify-center ring-2 ring-blue-100">
                  {user?.email ? (
                    <span className="text-xs font-semibold text-white">
                      {user.email.charAt(0).toUpperCase()}
                    </span>
                  ) : (
                    <User className="h-4 w-4 text-white" />
                  )}
                </div>
              </div>
              <button
                onClick={domainOps.handleAddDomain}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-2.5 rounded-xl hover:from-blue-700 hover:to-indigo-700 shadow-md transition-all duration-200"
              >
                <Plus size={18} />
              </button>
              <button
                onClick={async () => {
                  await signOut();
                  router.push('/');
                }}
                className="text-gray-600 hover:text-gray-900 p-2.5 rounded-xl hover:bg-gray-100 transition-all duration-200 border border-gray-200 hover:border-gray-300"
              >
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content - Clean White Design */}
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-12">
        {/* Stats Cards - Modern Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <div className="bg-white p-6 rounded-2xl border border-gray-100 hover:shadow-lg transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">{t('dashboard.totalInvestments')}</p>
                <p className="text-3xl font-bold text-gray-900">{stats.totalDomains}</p>
              </div>
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
                <Globe className="h-6 w-6 text-white" />
              </div>
            </div>
          </div>


          <div className="bg-white p-6 rounded-2xl border border-gray-100 hover:shadow-lg transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">{t('analytics.totalLoss')}</p>
                <p className="text-3xl font-bold text-gray-900">${domains.filter(d => d.status === 'expired').reduce((sum, domain) => sum + (domain.purchase_cost || 0) + (domain.renewal_count * (domain.renewal_cost || 0)), 0).toFixed(2)}</p>
              </div>
              <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center">
                <TrendingDown className="h-6 w-6 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-gray-100 hover:shadow-lg transition-all duration-300">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm font-medium text-gray-500">{t('dashboard.profitMargin')}</p>
                  <div className="group relative">
                    <Info className="h-4 w-4 text-gray-400 cursor-help hover:text-gray-600 transition-colors" />
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10 max-w-xs">
                      <div className="text-center whitespace-normal">
                        {t('dashboard.profitMarginCalculation')}
              </div>
                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                        <div className="w-2 h-2 bg-gray-900 transform rotate-45"></div>
              </div>
            </div>
          </div>
              </div>
                <p className="text-3xl font-bold text-gray-900">{stats.totalRevenue > 0 ? ((stats.totalProfit / stats.totalRevenue) * 100).toFixed(1) : 0}%</p>
              </div>
              <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl flex items-center justify-center">
                <BarChart3 className="h-6 w-6 text-white" />
            </div>
          </div>
          </div>
        </div>


        {/* Enhanced Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-6 rounded-lg shadow-lg text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm font-medium">{t('dashboard.totalDomains')}</p>
                <p className="text-3xl font-bold">{stats.totalDomains}</p>
                <p className="text-blue-200 text-xs mt-1">
                  {t('dashboard.active')}: {stats.activeDomains} | {t('dashboard.sold')}: {stats.forSaleDomains}
                </p>
          </div>
              <Globe className="h-8 w-8 text-blue-200" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-500 to-green-600 p-6 rounded-lg shadow-lg text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100 text-sm font-medium">{t('dashboard.purchaseCost')}</p>
                <p className="text-3xl font-bold">${stats.totalInvestment.toFixed(2)}</p>
                <p className="text-green-200 text-xs mt-1">
                  {t('dashboard.average')}: ${stats.avgPurchasePrice.toFixed(2)}
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-green-200" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-6 rounded-lg shadow-lg text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100 text-sm font-medium">{t('dashboard.totalRevenue')}</p>
                <p className="text-3xl font-bold">${stats.totalRevenue.toFixed(2)}</p>
                <p className="text-purple-200 text-xs mt-1">
                  {t('dashboard.averageSalePrice')}: ${stats.avgSalePrice.toFixed(2)}
                </p>
                <p className="text-purple-200 text-xs mt-1">
                  {t('dashboard.afterFees')}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-purple-200" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 p-6 rounded-lg shadow-lg text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-yellow-100 text-sm font-medium">{t('dashboard.renewalCost')}</p>
                <p className="text-3xl font-bold">${stats.totalRenewalCost.toFixed(2)}</p>
                <p className="text-yellow-200 text-xs mt-1">
                  {t('dashboard.annualCost')}: ${stats.annualRenewalCost.toFixed(2)}
                </p>
              </div>
              <RefreshCw className="h-8 w-8 text-yellow-200" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 p-6 rounded-lg shadow-lg text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-indigo-100 text-sm font-medium">{t('dashboard.totalInvestment')}</p>
                <p className="text-3xl font-bold">${stats.totalHoldingCost.toFixed(2)}</p>
                <p className="text-indigo-200 text-xs mt-1">
                  {t('dashboard.purchaseRenewal')}
                </p>
              </div>
              <Database className="h-8 w-8 text-indigo-200" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-6 rounded-lg shadow-lg text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-orange-100 text-sm font-medium">ROI</p>
                <p className="text-3xl font-bold">{stats.roi.toFixed(1)}%</p>
                <p className="text-orange-200 text-xs mt-1">
                  {t('dashboard.totalProfit')}: ${stats.totalProfit.toFixed(2)}
                </p>
              </div>
              <BarChart3 className="h-8 w-8 text-orange-200" />
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm border mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8 px-6 overflow-x-auto">
                <button 
                onClick={() => setActiveTab('overview')}
                className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                  activeTab === 'overview'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Activity className="h-4 w-4 inline mr-2" />
                {t('dashboard.overview')}
                </button>
              <button
                onClick={() => setActiveTab('domains')}
                className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                  activeTab === 'domains'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Globe className="h-4 w-4 inline mr-2" />
                {t('dashboard.domains')}
              </button>
              <button
                onClick={() => setActiveTab('transactions')}
                className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                  activeTab === 'transactions'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <FileText className="h-4 w-4 inline mr-2" />
                {t('dashboard.transactions')}
              </button>
              <button
                onClick={() => setActiveTab('analytics')}
                className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                  activeTab === 'analytics'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <PieChart className="h-4 w-4 inline mr-2" />
                {t('dashboard.analytics')}
              </button>
              <button
                onClick={() => setActiveTab('alerts')}
                className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                  activeTab === 'alerts'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Bell className="h-4 w-4 inline mr-2" />
                {t('dashboard.alerts')}
                {expiringDomains.length > 0 && (
                  <span className="ml-1 bg-red-500 text-white text-xs rounded-full px-2 py-0.5">
                    {expiringDomains.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                  activeTab === 'settings'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Settings className="h-4 w-4 inline mr-2" />
                {t('dashboard.settings')}
              </button>
              <button
                onClick={() => setActiveTab('data')}
                className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                  activeTab === 'data'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Database className="h-4 w-4 inline mr-2" />
                {t('dashboard.data')}
              </button>
              <button
                onClick={() => setActiveTab('reports')}
                className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                  activeTab === 'reports'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <BarChart3 className="h-4 w-4 inline mr-2" />
                {t('dashboard.reports')}
              </button>
            </nav>
              </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* 分享按钮 */}
            <div className="flex justify-end mb-4">
              <button
                onClick={() => setShowShareModal(true)}
                className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-3 rounded-lg hover:from-purple-700 hover:to-pink-700 flex items-center space-x-2 shadow-lg hover:shadow-xl transition-all duration-300"
              >
                <Share2 className="h-5 w-5" />
                <span>{t('dashboard.shareResults')}</span>
              </button>
            </div>
            
            {/* 新增财务指标卡片 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-gradient-to-br from-cyan-500 to-cyan-600 p-6 rounded-lg shadow-lg text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-cyan-100 text-sm font-medium">{t('financial.totalSales')}</p>
                    <p className="text-3xl font-bold">{formatCurrencyEnhanced(enhancedFinancialMetrics.totalSales)}</p>
                    <p className="text-cyan-200 text-xs mt-1">
                      {t('financial.totalSalesDesc')}
                    </p>
                  </div>
                  <DollarSign className="h-8 w-8 text-cyan-200" />
                </div>
              </div>

              <div className="bg-gradient-to-br from-red-500 to-red-600 p-6 rounded-lg shadow-lg text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-red-100 text-sm font-medium">{t('financial.platformFees')}</p>
                    <p className="text-3xl font-bold">{formatCurrencyEnhanced(enhancedFinancialMetrics.totalPlatformFees)}</p>
                    <p className="text-red-200 text-xs mt-1">
                      {t('financial.platformFeesDesc')}
                    </p>
                  </div>
                  <TrendingDown className="h-8 w-8 text-red-200" />
                </div>
              </div>

              <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 p-6 rounded-lg shadow-lg text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-emerald-100 text-sm font-medium">{t('financial.annualSales')}</p>
                    <p className="text-3xl font-bold">{formatCurrencyEnhanced(enhancedFinancialMetrics.annualSales)}</p>
                    <p className="text-emerald-200 text-xs mt-1">
                      {t('financial.annualSalesDesc')}
                    </p>
                  </div>
                  <Calendar className="h-8 w-8 text-emerald-200" />
                </div>
              </div>

              <div className={`bg-gradient-to-br p-6 rounded-lg shadow-lg text-white ${enhancedFinancialMetrics.annualProfit >= 0 ? 'from-green-500 to-green-600' : 'from-red-500 to-red-600'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`text-sm font-medium ${enhancedFinancialMetrics.annualProfit >= 0 ? 'text-green-100' : 'text-red-100'}`}>{t('financial.annualProfit')}</p>
                    <p className="text-3xl font-bold">{formatCurrencyEnhanced(enhancedFinancialMetrics.annualProfit)}</p>
                    <p className={`text-xs mt-1 ${enhancedFinancialMetrics.annualProfit >= 0 ? 'text-green-200' : 'text-red-200'}`}>
                      {t('financial.annualProfitDesc')}
                    </p>
                  </div>
                  <Target className={`h-8 w-8 ${enhancedFinancialMetrics.annualProfit >= 0 ? 'text-green-200' : 'text-red-200'}`} />
                </div>
              </div>
            </div>

            {/* 续费分析卡片 */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('renewal.analysis')}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="flex items-center justify-between">
                      <div>
                      <p className="text-sm font-medium text-blue-600">{t('renewal.thisYearCost')}</p>
                      <p className="text-2xl font-bold text-blue-900">
                        {formatCurrencyEnhanced(renewalAnalysis.totalAnnualCost, 'USD')}
                      </p>
                      </div>
                    <Calendar className="h-8 w-8 text-blue-600" />
                    </div>
                    </div>
                
                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-green-600">{t('renewal.needRenewal')}</p>
                      <p className="text-2xl font-bold text-green-900">
                        {renewalAnalysis.domainsNeedingRenewal.length}
                      </p>
                    </div>
                    <Globe className="h-8 w-8 text-green-600" />
                  </div>
                </div>
                
                <div className="bg-purple-50 p-4 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-purple-600">{t('renewal.noRenewal')}</p>
                      <p className="text-2xl font-bold text-purple-900">
                        {renewalAnalysis.domainsNotNeedingRenewal.length}
                      </p>
                    </div>
                    <CheckCircle className="h-8 w-8 text-purple-600" />
                  </div>
                </div>
                
                <div className="bg-orange-50 p-4 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-orange-600">{t('renewal.averageCostPerDomain')}</p>
                      <p className="text-2xl font-bold text-orange-900">
                        {renewalAnalysis.domainsNeedingRenewal.length > 0 
                          ? formatCurrencyEnhanced(renewalAnalysis.totalAnnualCost / renewalAnalysis.domainsNeedingRenewal.length, 'USD')
                          : formatCurrencyEnhanced(0, 'USD')}
                      </p>
                    </div>
                    <DollarSign className="h-8 w-8 text-orange-600" />
                  </div>
                </div>
              </div>
              
              {/* 续费周期分布 */}
              {Object.keys(renewalAnalysis.costByCycle).length > 0 && (
                <div className="mt-6">
                  <h4 className="text-md font-medium text-gray-900 mb-3">{t('renewal.cycleDistribution')}</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {Object.entries(renewalAnalysis.costByCycle).map(([cycle, cost]) => (
                      <div key={cycle} className="bg-gray-50 p-3 rounded-lg">
                        <p className="text-sm text-gray-600">{cycle}</p>
                        <p className="text-lg font-semibold text-gray-900">{formatCurrencyEnhanced(cost, 'USD')}</p>
                  </div>
                ))}
                  </div>
              </div>
            )}
      </div>

            {/* 高级续费分析 */}
            <LazyWrapper>
              <LazyAdvancedRenewalAnalysis domains={domains} />
            </LazyWrapper>
            
            {/* 过期域名损失分析 */}
            <LazyWrapper>
              <LazyExpiredDomainLossAnalysis domains={domains} />
            </LazyWrapper>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">{t('action.quickActions')}</h3>
                  <Zap className="h-5 w-5 text-yellow-500" />
                </div>
                <div className="space-y-3">
              <button
                  onClick={domainOps.handleAddDomain}
                    className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center justify-center space-x-2"
                  >
                    <Plus className="h-4 w-4" />
                    <span>{t('domain.add')}</span>
                  </button>
                  <button
                    onClick={transactionOps.handleAddTransaction}
                    className="w-full bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center justify-center space-x-2"
                  >
                    <FileText className="h-4 w-4" />
                    <span>{t('transaction.add')}</span>
              </button>
            </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">{t('dashboard.bestPerformance')}</h3>
                  <Award className="h-5 w-5 text-green-500" />
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600">{stats.bestPerformingDomain}</p>
                  <p className="text-sm text-gray-600 mt-1">{t('dashboard.bestInvestment')}</p>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">{t('dashboard.needAttention')}</h3>
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-red-600">{expiringDomains.length}</p>
                  <p className="text-sm text-gray-600 mt-1">{t('dashboard.expiringSoon')}</p>
                </div>
              </div>
            </div>

            {/* Recent Transactions */}
            <div className="bg-white rounded-lg shadow-sm border">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">{t('common.recentTransactions')}</h3>
              </div>
              <div className="p-6">
                {transactions.slice(0, 5).length > 0 ? (
            <div className="space-y-4">
                    {transactions.slice(0, 5).map((transaction) => (
                      <div key={transaction.id} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-b-0">
                        <div className="flex items-center space-x-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            transaction.type === 'buy' ? 'bg-blue-100' :
                            transaction.type === 'sell' ? 'bg-green-100' :
                            transaction.type === 'renew' ? 'bg-yellow-100' : 'bg-gray-100'
                          }`}>
                            {transaction.type === 'buy' ? <Plus className="h-4 w-4 text-blue-600" /> :
                             transaction.type === 'sell' ? <TrendingUp className="h-4 w-4 text-green-600" /> :
                             transaction.type === 'renew' ? <RefreshCw className="h-4 w-4 text-yellow-600" /> :
                             <FileText className="h-4 w-4 text-gray-600" />}
                          </div>
              <div>
                            <p className="font-medium text-gray-900">
                              {domains.find(d => d.id === transaction.domain_id)?.domain_name || 'Unknown Domain'}
                            </p>
                            <p className="text-sm text-gray-600">{transaction.type} - {transaction.date}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`font-semibold ${
                            transaction.type === 'sell' ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {transaction.type === 'sell' ? '+' : '-'}${transaction.amount.toFixed(2)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>{t('common.noTransactions')}</p>
                    <button
                      onClick={transactionOps.handleAddTransaction}
                  className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                      {t('common.addFirstTransaction')}
                    </button>
                  </div>
                )}
              </div>
            </div>


          </div>
        )}

        {activeTab === 'domains' && (
          <div className="space-y-6">
            <DomainList
              domains={domains}
              onEdit={domainOps.handleEditDomain}
              onDelete={domainOps.handleDeleteDomain}
              onView={handleViewDomain}
              onAdd={domainOps.handleAddDomain}
                />
              </div>
        )}

        {activeTab === 'transactions' && (
          <TransactionList
            transactions={transactions}
            domains={domains}
            onEdit={transactionOps.handleEditTransaction}
            onDelete={transactionOps.handleDeleteTransaction}
            onAdd={transactionOps.handleAddTransaction}
          />
        )}

        {activeTab === 'analytics' && (
          <LazyWrapper>
            <LazyInvestmentAnalytics 
            domains={domains} 
            transactions={transactions} 
          />
          </LazyWrapper>
        )}

        {activeTab === 'alerts' && (
          <div className="space-y-6">
            {/* 过期域名统计概览 */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-lg shadow-sm border">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">{t('common.totalExpiring')}</p>
                    <p className="text-2xl font-bold text-gray-900">{expiringDomains.length}</p>
                  </div>
                  <Calendar className="h-8 w-8 text-blue-500" />
                </div>
              </div>
              
              <div className="bg-white p-4 rounded-lg shadow-sm border">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">{t('common.critical')}</p>
                    <p className="text-2xl font-bold text-red-600">
                      {expiringDomains.filter(d => d.urgency === 'critical').length}
                    </p>
                  </div>
                  <AlertTriangle className="h-8 w-8 text-red-500" />
                </div>
              </div>
              
              <div className="bg-white p-4 rounded-lg shadow-sm border">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">{t('common.urgent')}</p>
                    <p className="text-2xl font-bold text-orange-600">
                      {expiringDomains.filter(d => d.urgency === 'urgent').length}
                    </p>
                  </div>
                  <AlertTriangle className="h-8 w-8 text-orange-500" />
                </div>
              </div>
              
              <div className="bg-white p-4 rounded-lg shadow-sm border">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">{t('common.normal')}</p>
                    <p className="text-2xl font-bold text-yellow-600">
                      {expiringDomains.filter(d => d.urgency === 'normal').length}
                    </p>
                  </div>
                  <Calendar className="h-8 w-8 text-yellow-500" />
                </div>
              </div>
            </div>

            {/* 过期域名详细列表 */}
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">{t('common.expiringDomains')}</h3>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-500">
                    {expiringDomains.length > 0 ? `${expiringDomains.length} ${t('common.domains')}` : ''}
                  </span>
                </div>
              </div>
              {expiringDomains.length > 0 ? (
                <div className="space-y-4">
                  {expiringDomains.map((domain) => (
                    <div
                      key={domain.id}
                      className={`p-4 rounded-lg border-l-4 ${
                        domain.urgency === 'critical' 
                          ? 'border-red-500 bg-red-50' 
                          : domain.urgency === 'urgent' 
                          ? 'border-orange-500 bg-orange-50' 
                          : 'border-yellow-500 bg-yellow-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3">
                            <h4 className="text-lg font-medium text-gray-900">
                              {domain.domain_name}
                            </h4>
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                              domain.urgency === 'critical' 
                                ? 'bg-red-100 text-red-800' 
                                : domain.urgency === 'urgent' 
                                ? 'bg-orange-100 text-orange-800' 
                                : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {domain.urgency === 'critical' ? t('common.critical') : 
                               domain.urgency === 'urgent' ? t('common.urgent') : t('common.normal')}
                            </span>
                          </div>
                          <div className="mt-2 text-sm text-gray-600">
                            <p>{t('common.daysUntilExpiry')}: {new Date(domain.expiry_date!).toLocaleDateString()}</p>
                            <p className="font-medium">
                              {domain.daysUntilExpiry === 0 
                                ? t('common.todayExpiry')
                                : domain.daysUntilExpiry < 0 
                                ? `${t('common.expiredDaysAgo')} ${Math.abs(domain.daysUntilExpiry)} ${t('common.daysLeft')}`
                                : `${t('common.daysLeftExpiry')} ${domain.daysUntilExpiry} ${t('common.daysLeftExpiryEnd')}`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => domainOps.handleEditDomain(domain)}
                            className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                          >
                            {t('common.edit')}
                          </button>
                          <button
                            onClick={() => domainOps.handleRenewDomain(domain)}
                            className="px-3 py-1 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors"
                          >
                            {t('common.renew')}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>{t('common.noExpiringDomains')}</p>
                </div>
              )}
            </div>
          </div>
        )}


        {activeTab === 'settings' && (
          <LazyWrapper>
            <LazyUserPreferencesPanel />
          </LazyWrapper>
        )}

        {activeTab === 'data' && (
          <LazyWrapper>
            <LazyDataImportExport
            onImport={async (data: unknown) => {
              try {
                const importData = data as { domains?: Domain[]; transactions?: TransactionWithRequiredFields[] };
                let typedDomains = domains;
                let typedTransactions = transactions;
                
                if (importData.domains) {
                  typedDomains = importData.domains.map(ensureDomainWithTags);
                }
                if (importData.transactions) {
                  typedTransactions = importData.transactions.map(ensureTransactionWithRequiredFields);
                }
                // Save imported data to Supabase database
                await saveData(typedDomains, typedTransactions);
                auditLogger.log(user?.id || 'default', 'data_imported', 'dashboard', { 
                  domainsCount: importData.domains?.length || 0,
                  transactionsCount: importData.transactions?.length || 0
                });
                logger.log(t('common.dataImportedSuccessfully'));
              } catch (error) {
                logger.error('Import failed:', error);
                setError(t('common.dataImportFailed'));
                auditLogger.log(user?.id || 'default', 'data_import_failed', 'dashboard', { error: (error as Error).message });
              }
            }}
            onExport={(format) => {
              try {
                const data = {
                  domains,
                  transactions,
                  exportDate: new Date().toISOString(),
                  version: '1.0'
                };
                
                if (format === 'json') {
                  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `66do-backup-${new Date().toISOString().split('T')[0]}.json`;
                  a.click();
                } else if (format === 'csv') {
                  // TODO: Implement CSV export
                  logger.log('CSV export not yet implemented');
                }
                
                auditLogger.log(user?.id || 'default', 'data_exported', 'dashboard', { format, dataSize: JSON.stringify(data).length });
                logger.log(t('common.dataExportedSuccessfully'));
              } catch (error) {
                logger.error('Export failed:', error);
                setError(t('common.dataExportFailed'));
                auditLogger.log(user?.id || 'default', 'data_export_failed', 'dashboard', { error: (error as Error).message });
              }
            }}
            onBackup={() => {
              try {
                const backup = {
                  domains,
                  transactions,
                  backupDate: new Date().toISOString(),
                  version: '1.0'
                };
                // Backup data to Supabase database (implement backup API if needed)
                logger.log('Backup created:', backup);
                auditLogger.log(user?.id || 'default', 'data_backed_up', 'dashboard', { 
                  domainsCount: domains.length,
                  transactionsCount: transactions.length
                });
                logger.log(t('common.dataBackedUpSuccessfully'));
              } catch (error) {
                logger.error('Backup failed:', error);
                setError(t('common.dataBackupFailed'));
                auditLogger.log(user?.id || 'default', 'data_backup_failed', 'dashboard', { error: (error as Error).message });
              }
            }}
            onRestore={async (backup: unknown) => {
              try {
                const restoreData = backup as { domains?: Domain[]; transactions?: TransactionWithRequiredFields[] };
                let typedDomains = domains;
                let typedTransactions = transactions;
                
                if (restoreData.domains) {
                  typedDomains = restoreData.domains.map(ensureDomainWithTags);
                }
                if (restoreData.transactions) {
                  typedTransactions = restoreData.transactions.map(ensureTransactionWithRequiredFields);
                }
                // Save restored data to Supabase database
                await saveData(typedDomains, typedTransactions);
                auditLogger.log(user?.id || 'default', 'data_restored', 'dashboard', { 
                  domainsCount: restoreData.domains?.length || 0,
                  transactionsCount: restoreData.transactions?.length || 0
                });
                logger.log(t('common.dataRestoredSuccessfully'));
              } catch (error) {
                logger.error('Restore failed:', error);
                setError(t('common.dataRestoreFailed'));
                auditLogger.log(user?.id || 'default', 'data_restore_failed', 'dashboard', { error: (error as Error).message });
              }
            }}
          />
          </LazyWrapper>
        )}
        
        {activeTab === 'reports' && (
          <div className="space-y-6">
            {/* 报告类型选择器 */}
            <div className="bg-white p-4 rounded-lg shadow-sm border">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">{t('common.financialReports')}</h3>
                <div className="flex items-center space-x-4">
                  <select
                    value={viewMode}
                    onChange={(e) => setViewMode(e.target.value as 'grid' | 'list')}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="grid">{t('common.gridView')}</option>
                    <option value="list">{t('common.listView')}</option>
                  </select>
                </div>
              </div>
            </div>

            {/* 综合财务报告 */}
            <LazyWrapper>
              <LazyFinancialReport
              domains={domains}
              transactions={transactions}
            />
            </LazyWrapper>
            
            {/* 投资分析 */}
            <LazyWrapper>
              <LazyFinancialAnalysis
              domains={domains}
              transactions={transactions}
            />
            </LazyWrapper>
          </div>
        )}
        </div>

      {/* Domain Form Modal */}
      <DomainForm
        key={domainOps.editingDomain?.id || 'new'}
        domain={domainOps.editingDomain}
        isOpen={domainOps.showDomainForm}
        onClose={() => {
          domainOps.setShowDomainForm(false);
          domainOps.setEditingDomain(undefined);
        }}
        onSave={handleSaveDomain}
      />

      {/* Smart Domain Form Modal */}
      <SmartDomainForm
        key={domainOps.editingDomain?.id || 'new'}
        domain={domainOps.editingDomain}
        isOpen={domainOps.showSmartDomainForm}
        onClose={() => {
          domainOps.setShowSmartDomainForm(false);
          domainOps.setEditingDomain(undefined);
        }}
        onSave={handleSaveDomain}
      />

      {/* Transaction Form Modal */}
      <TransactionForm
        key={transactionOps.editingTransaction?.id || 'new'}
        transaction={transactionOps.editingTransaction}
        domains={domains}
        isOpen={transactionOps.showTransactionForm}
        onClose={() => {
          transactionOps.setShowTransactionForm(false);
          transactionOps.setEditingTransaction(undefined);
        }}
        onSave={transactionOps.handleSaveTransaction}
        onSaleComplete={transactionOps.handleSaleComplete}
      />

      {/* Share Modal */}
      <ShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        shareData={shareData}
      />

      {/* Sale Success Modal */}
      {transactionOps.saleSuccessData && (
        <SaleSuccessModal
          isOpen={transactionOps.showSaleSuccessModal}
          onClose={() => {
            transactionOps.setShowSaleSuccessModal(false);
            transactionOps.setSaleSuccessData(null);
          }}
          domain={transactionOps.saleSuccessData.domain}
          transaction={transactionOps.saleSuccessData.transaction}
        />
      )}

      {/* Renewal Modal */}
      {domainOps.showRenewalModal && domainOps.renewalDomain && (
        <RenewalModal
          isOpen={domainOps.showRenewalModal}
          onClose={() => {
            domainOps.setShowRenewalModal(false);
            domainOps.setRenewalDomain(null);
          }}
          domain={domainOps.renewalDomain}
          onRenew={async (domain, renewalYears) => {
            await domainOps.processRenewal(domain, renewalYears);
          }}
        />
      )}

      {/* Data Source Indicator */}
      {dataSource && (
        <div className="fixed bottom-4 right-4 bg-gray-800 text-white px-3 py-2 rounded-lg text-sm">
          {t('common.dataSource')}: {dataSource === 'supabase' ? t('common.cloudDatabase') : t('common.cache')}
        </div>
      )}

      {/* Mobile Components */}
      {isMobile() && (
        <>
          <TouchGestures onSwipeLeft={() => setActiveTab('domains')} onSwipeRight={() => setActiveTab('overview')}>
            <div></div>
          </TouchGestures>
          <PullToRefresh onRefresh={async () => window.location.reload()}>
            <div></div>
          </PullToRefresh>
        </>
      )}

      {/* Mobile Navigation */}
      <MobileNavigation 
        activeTab={activeTab}
        onTabChange={setActiveTab}
        expiringCount={expiringDomains.length}
      />
    </div>
  );
}
