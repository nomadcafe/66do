'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
  Database,
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
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (session?.access_token) {
        (headers as Record<string, string>)['Authorization'] = `Bearer ${session.access_token}`;
      }
      const response = await fetch(`/api/domains/${id}`, {
        method: 'DELETE',
        headers
      });
      if (!response.ok) throw new Error('Failed to delete domain');
      await refreshData();
    } catch (error) {
      setError(`Failed to delete domain: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [user?.id, session?.access_token, refreshData, setError]);

  const domainOps = useDomainOperations(
    domains,
    saveData,
    handleDeleteDomain
  );

  const domainFormCloseRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    domainFormCloseRef.current = () => {
      domainOps.setShowDomainForm(false);
      domainOps.setEditingDomain(undefined);
    };
  }, [domainOps]);

  useEffect(() => {
    if (!domainOps.showDomainForm) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest?.('[data-close-domain-form]')) return;
      e.preventDefault();
      e.stopPropagation();
      domainFormCloseRef.current?.();
    };
    document.addEventListener('click', handler, true);
    return () => document.removeEventListener('click', handler, true);
  }, [domainOps.showDomainForm]);
  
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
        
        await saveData(updatedDomains, transactions, { domainsOnly: true });
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
        await saveData(updatedDomains, transactions, { domainsOnly: true });
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
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-stone-200 border-t-teal-600 mx-auto" />
          <p className="mt-4 text-sm text-stone-600">{t('common.verifyingIdentity')}</p>
        </div>
      </div>
    );
  }

  if (domainOps.showDomainForm) {
    return (
      <DomainForm
        key={domainOps.editingDomain?.id || 'new'}
        domain={domainOps.editingDomain}
        isOpen={true}
        onClose={() => {
          domainOps.setShowDomainForm(false);
          domainOps.setEditingDomain(undefined);
        }}
        onSave={handleSaveDomain}
        closeRef={domainFormCloseRef}
      />
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 antialiased">
      {/* Desktop Header */}
      <header className="hidden lg:block border-b border-stone-200/80 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-stone-800 rounded-lg flex items-center justify-center">
                <Globe className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-semibold tracking-tight text-stone-900">{t('platform.name')}</h1>
                <p className="text-xs text-stone-500">{t('dashboard.title')}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <select
                value={locale}
                onChange={(e) => setLocale(e.target.value as 'en' | 'zh')}
                className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              >
                <option value="zh">中文</option>
                <option value="en">English</option>
              </select>
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-stone-200 bg-white">
                <div className="w-8 h-8 bg-stone-700 rounded-full flex items-center justify-center text-white text-sm font-medium">
                  {user?.email ? user.email.charAt(0).toUpperCase() : <User className="h-4 w-4" />}
                </div>
                <div className="hidden xl:block">
                  <span className="text-sm font-medium text-stone-900 block leading-tight">{user?.email?.split('@')[0] || 'User'}</span>
                  <span className="text-xs text-stone-500 block leading-tight truncate max-w-[140px]">{user?.email || ''}</span>
                </div>
              </div>
              <button
                onClick={domainOps.handleAddDomain}
                className="bg-teal-600 text-white px-5 py-2.5 rounded-lg hover:bg-teal-700 flex items-center gap-2 text-sm font-medium shadow-sm"
              >
                <Plus size={18} />
                <span>{t('dashboard.addInvestment')}</span>
              </button>
              <button
                onClick={async () => { await signOut(); router.push('/'); }}
                className="text-stone-500 hover:text-stone-800 flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-stone-100 text-sm font-medium"
              >
                <LogOut size={18} />
                <span>{t('dashboard.signOut')}</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Header */}
      <header className="lg:hidden border-b border-stone-200/80 bg-white/95 backdrop-blur-sm sticky top-0 z-50">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 bg-stone-800 rounded-lg flex items-center justify-center">
                <Globe className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-base font-semibold text-stone-900">{t('platform.name')}</h1>
                <p className="text-xs text-stone-500">{t('dashboard.title')}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-stone-700 rounded-full flex items-center justify-center text-white text-xs font-medium">
                {user?.email ? user.email.charAt(0).toUpperCase() : <User className="h-4 w-4" />}
              </div>
              <button onClick={domainOps.handleAddDomain} className="bg-teal-600 text-white p-2.5 rounded-lg hover:bg-teal-700">
                <Plus size={18} />
              </button>
              <button onClick={async () => { await signOut(); router.push('/'); }} className="text-stone-600 p-2.5 rounded-lg hover:bg-stone-100 border border-stone-200">
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-2xl border border-stone-200/80 p-5 shadow-sm hover:shadow transition">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-stone-500">{t('dashboard.totalDomains')}</p>
                <p className="text-2xl font-bold text-stone-900 mt-1">{stats.totalDomains}</p>
                <p className="text-xs text-stone-500 mt-1">{t('dashboard.active')} {stats.activeDomains} · {t('dashboard.sold')} {stats.soldDomains}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-stone-100 flex items-center justify-center text-stone-600"><Globe className="h-5 w-5" /></div>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-stone-200/80 p-5 shadow-sm hover:shadow transition">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-stone-500">{t('dashboard.purchaseCost')}</p>
                <p className="text-2xl font-bold text-stone-900 mt-1">${stats.totalInvestment.toFixed(2)}</p>
                <p className="text-xs text-stone-500 mt-1">{t('dashboard.average')} ${stats.avgPurchasePrice.toFixed(2)}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600"><DollarSign className="h-5 w-5" /></div>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-stone-200/80 p-5 shadow-sm hover:shadow transition">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-stone-500">{t('dashboard.totalRevenue')}</p>
                <p className="text-2xl font-bold text-stone-900 mt-1">${stats.totalRevenue.toFixed(2)}</p>
                <p className="text-xs text-stone-500 mt-1">{t('dashboard.afterFees')}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600"><TrendingUp className="h-5 w-5" /></div>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-stone-200/80 p-5 shadow-sm hover:shadow transition">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-stone-500">ROI</p>
                <p className="text-2xl font-bold text-stone-900 mt-1">{stats.roi.toFixed(1)}%</p>
                <p className="text-xs text-stone-500 mt-1">{t('dashboard.totalProfit')} ${stats.totalProfit.toFixed(2)}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600"><BarChart3 className="h-5 w-5" /></div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-2xl border border-stone-200/80 shadow-sm mb-6 overflow-hidden">
          <nav className="flex gap-1 p-1.5 overflow-x-auto bg-stone-50/50 border-b border-stone-100" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('overview')}
              className={`rounded-lg px-4 py-2.5 text-sm font-medium whitespace-nowrap flex items-center gap-2 transition ${
                activeTab === 'overview' ? 'bg-stone-900 text-white shadow-sm' : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
              }`}
            >
              <Activity className="h-4 w-4" />
              {t('dashboard.overview')}
            </button>
            <button
              onClick={() => setActiveTab('domains')}
              className={`rounded-lg px-4 py-2.5 text-sm font-medium whitespace-nowrap flex items-center gap-2 transition ${
                activeTab === 'domains' ? 'bg-stone-900 text-white shadow-sm' : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
              }`}
            >
              <Globe className="h-4 w-4" />
              {t('dashboard.domains')}
            </button>
            <button
              onClick={() => setActiveTab('transactions')}
              className={`rounded-lg px-4 py-2.5 text-sm font-medium whitespace-nowrap flex items-center gap-2 transition ${
                activeTab === 'transactions' ? 'bg-stone-900 text-white shadow-sm' : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
              }`}
            >
              <FileText className="h-4 w-4" />
              {t('dashboard.transactions')}
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`rounded-lg px-4 py-2.5 text-sm font-medium whitespace-nowrap flex items-center gap-2 transition ${
                activeTab === 'analytics' ? 'bg-stone-900 text-white shadow-sm' : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
              }`}
            >
              <PieChart className="h-4 w-4" />
              {t('dashboard.analytics')}
            </button>
            <button
              onClick={() => setActiveTab('alerts')}
              className={`rounded-lg px-4 py-2.5 text-sm font-medium whitespace-nowrap flex items-center gap-2 transition ${
                activeTab === 'alerts' ? 'bg-stone-900 text-white shadow-sm' : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
              }`}
            >
              <Bell className="h-4 w-4" />
              {t('dashboard.alerts')}
              {expiringDomains.length > 0 && (
                <span className="ml-1 bg-red-500 text-white text-xs rounded-full px-2 py-0.5">{expiringDomains.length}</span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`rounded-lg px-4 py-2.5 text-sm font-medium whitespace-nowrap flex items-center gap-2 transition ${
                activeTab === 'settings' ? 'bg-stone-900 text-white shadow-sm' : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
              }`}
            >
              <Settings className="h-4 w-4" />
              {t('dashboard.settings')}
            </button>
            <button
              onClick={() => setActiveTab('data')}
              className={`rounded-lg px-4 py-2.5 text-sm font-medium whitespace-nowrap flex items-center gap-2 transition ${
                activeTab === 'data' ? 'bg-stone-900 text-white shadow-sm' : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
              }`}
            >
              <Database className="h-4 w-4" />
              {t('dashboard.data')}
            </button>
            <button
              onClick={() => setActiveTab('reports')}
              className={`rounded-lg px-4 py-2.5 text-sm font-medium whitespace-nowrap flex items-center gap-2 transition ${
                activeTab === 'reports' ? 'bg-stone-900 text-white shadow-sm' : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
              }`}
            >
              <BarChart3 className="h-4 w-4" />
              {t('dashboard.reports')}
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="flex justify-end mb-6">
              <button
                onClick={() => setShowShareModal(true)}
                className="rounded-xl bg-stone-800 text-white px-5 py-2.5 text-sm font-medium flex items-center gap-2 hover:bg-stone-700 transition"
              >
                <Share2 className="h-4 w-4" />
                {t('dashboard.shareResults')}
              </button>
            </div>

            {/* 财务指标 */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <div className="bg-white rounded-2xl border border-stone-200/80 p-4 shadow-sm">
                <p className="text-xs font-medium uppercase tracking-wider text-stone-500">{t('financial.totalSales')}</p>
                <p className="text-xl font-bold text-stone-900 mt-1">{formatCurrencyEnhanced(enhancedFinancialMetrics.totalSales)}</p>
                <p className="text-xs text-stone-500 mt-1">{t('financial.totalSalesDesc')}</p>
              </div>
              <div className="bg-white rounded-2xl border border-stone-200/80 p-4 shadow-sm">
                <p className="text-xs font-medium uppercase tracking-wider text-stone-500">{t('financial.platformFees')}</p>
                <p className="text-xl font-bold text-stone-900 mt-1">{formatCurrencyEnhanced(enhancedFinancialMetrics.totalPlatformFees)}</p>
                <p className="text-xs text-stone-500 mt-1">{t('financial.platformFeesDesc')}</p>
              </div>
              <div className="bg-white rounded-2xl border border-stone-200/80 p-4 shadow-sm">
                <p className="text-xs font-medium uppercase tracking-wider text-stone-500">{t('financial.annualSales')}</p>
                <p className="text-xl font-bold text-stone-900 mt-1">{formatCurrencyEnhanced(enhancedFinancialMetrics.annualSales)}</p>
                <p className="text-xs text-stone-500 mt-1">{t('financial.annualSalesDesc')}</p>
              </div>
              <div className={`bg-white rounded-2xl border p-4 shadow-sm ${enhancedFinancialMetrics.annualProfit >= 0 ? 'border-emerald-200/80' : 'border-red-200/80'}`}>
                <p className="text-xs font-medium uppercase tracking-wider text-stone-500">{t('financial.annualProfit')}</p>
                <p className={`text-xl font-bold mt-1 ${enhancedFinancialMetrics.annualProfit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{formatCurrencyEnhanced(enhancedFinancialMetrics.annualProfit)}</p>
                <p className="text-xs text-stone-500 mt-1">{t('financial.annualProfitDesc')}</p>
              </div>
            </div>

            {/* 续费分析 */}
            <div className="bg-white rounded-2xl border border-stone-200/80 p-6 shadow-sm mb-8">
              <h3 className="text-base font-semibold text-stone-900 mb-4">{t('renewal.analysis')}</h3>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="rounded-xl bg-stone-50 p-4 border border-stone-100">
                  <p className="text-xs font-medium text-stone-500">{t('renewal.thisYearCost')}</p>
                  <p className="text-xl font-bold text-stone-900 mt-1">{formatCurrencyEnhanced(renewalAnalysis.totalAnnualCost, 'USD')}</p>
                </div>
                <div className="rounded-xl bg-teal-50/50 p-4 border border-teal-100">
                  <p className="text-xs font-medium text-teal-700">{t('renewal.needRenewal')}</p>
                  <p className="text-xl font-bold text-stone-900 mt-1">{renewalAnalysis.domainsNeedingRenewal.length}</p>
                </div>
                <div className="rounded-xl bg-stone-50 p-4 border border-stone-100">
                  <p className="text-xs font-medium text-stone-500">{t('renewal.noRenewal')}</p>
                  <p className="text-xl font-bold text-stone-900 mt-1">{renewalAnalysis.domainsNotNeedingRenewal.length}</p>
                </div>
                <div className="rounded-xl bg-amber-50/50 p-4 border border-amber-100">
                  <p className="text-xs font-medium text-amber-800">{t('renewal.averageCostPerDomain')}</p>
                  <p className="text-xl font-bold text-stone-900 mt-1">
                    {renewalAnalysis.domainsNeedingRenewal.length > 0
                      ? formatCurrencyEnhanced(renewalAnalysis.totalAnnualCost / renewalAnalysis.domainsNeedingRenewal.length, 'USD')
                      : formatCurrencyEnhanced(0, 'USD')}
                  </p>
                </div>
              </div>
              {Object.keys(renewalAnalysis.costByCycle).length > 0 && (
                <div className="mt-5 pt-4 border-t border-stone-100">
                  <h4 className="text-sm font-medium text-stone-700 mb-3">{t('renewal.cycleDistribution')}</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {Object.entries(renewalAnalysis.costByCycle).map(([cycle, cost]) => (
                      <div key={cycle} className="bg-stone-50 rounded-lg p-3">
                        <p className="text-xs text-stone-500">{cycle}</p>
                        <p className="text-base font-semibold text-stone-900">{formatCurrencyEnhanced(cost, 'USD')}</p>
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

            {/* Quick Actions & Highlights */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <div className="bg-white rounded-2xl border border-stone-200/80 p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-stone-900 mb-3 flex items-center gap-2">
                  <Zap className="h-4 w-4 text-amber-500" />
                  {t('action.quickActions')}
                </h3>
                <div className="flex gap-2">
                  <button onClick={domainOps.handleAddDomain} className="flex-1 rounded-xl bg-teal-600 text-white px-4 py-2.5 text-sm font-medium flex items-center justify-center gap-2 hover:bg-teal-700">
                    <Plus className="h-4 w-4" />
                    {t('domain.add')}
                  </button>
                  <button onClick={transactionOps.handleAddTransaction} className="flex-1 rounded-xl bg-stone-800 text-white px-4 py-2.5 text-sm font-medium flex items-center justify-center gap-2 hover:bg-stone-700">
                    <FileText className="h-4 w-4" />
                    {t('transaction.add')}
                  </button>
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-stone-200/80 p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-stone-900 mb-2 flex items-center gap-2">
                  <Award className="h-4 w-4 text-emerald-500" />
                  {t('dashboard.bestPerformance')}
                </h3>
                <p className="text-lg font-bold text-stone-900">{stats.bestPerformingDomain}</p>
                <p className="text-xs text-stone-500 mt-1">{t('dashboard.bestInvestment')}</p>
              </div>
              <div className="bg-white rounded-2xl border border-stone-200/80 p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-stone-900 mb-2 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                  {t('dashboard.needAttention')}
                </h3>
                <p className="text-lg font-bold text-stone-900">{expiringDomains.length}</p>
                <p className="text-xs text-stone-500 mt-1">{t('dashboard.expiringSoon')}</p>
              </div>
            </div>

            {/* Recent Transactions */}
            <div className="bg-white rounded-2xl border border-stone-200/80 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-stone-100">
                <h3 className="text-base font-semibold text-stone-900">{t('common.recentTransactions')}</h3>
              </div>
              <div className="p-5">
                {transactions.slice(0, 5).length > 0 ? (
                  <div className="space-y-1">
                    {transactions.slice(0, 5).map((transaction) => (
                      <div key={transaction.id} className="flex items-center justify-between py-3 px-3 rounded-lg hover:bg-stone-50/80 transition">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                            transaction.type === 'buy' ? 'bg-teal-50 text-teal-600' :
                            transaction.type === 'sell' ? 'bg-emerald-50 text-emerald-600' :
                            transaction.type === 'renew' ? 'bg-amber-50 text-amber-600' : 'bg-stone-100 text-stone-600'
                          }`}>
                            {transaction.type === 'buy' ? <Plus className="h-4 w-4" /> :
                             transaction.type === 'sell' ? <TrendingUp className="h-4 w-4" /> :
                             transaction.type === 'renew' ? <RefreshCw className="h-4 w-4" /> :
                             <FileText className="h-4 w-4" />}
                          </div>
                          <div>
                            <p className="font-medium text-stone-900">
                              {domains.find(d => d.id === transaction.domain_id)?.domain_name || 'Unknown Domain'}
                            </p>
                            <p className="text-xs text-stone-500">{transaction.type} · {transaction.date}</p>
                          </div>
                        </div>
                        <p className={`font-semibold text-sm ${transaction.type === 'sell' ? 'text-emerald-600' : 'text-stone-700'}`}>
                          {transaction.type === 'sell' ? '+' : '-'}${transaction.amount.toFixed(2)}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-10 text-stone-500">
                    <FileText className="h-10 w-10 mx-auto mb-3 text-stone-300" />
                    <p className="text-sm">{t('common.noTransactions')}</p>
                    <button onClick={transactionOps.handleAddTransaction} className="mt-4 rounded-xl bg-teal-600 text-white px-4 py-2 text-sm font-medium hover:bg-teal-700">
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
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-2xl border border-stone-200/80 p-4 shadow-sm">
                <p className="text-xs font-medium text-stone-500">{t('common.totalExpiring')}</p>
                <p className="text-2xl font-bold text-stone-900 mt-1">{expiringDomains.length}</p>
                <Calendar className="h-8 w-8 text-stone-300 mt-2" />
              </div>
              <div className="bg-white rounded-2xl border border-red-200/80 p-4 shadow-sm">
                <p className="text-xs font-medium text-red-600">{t('common.critical')}</p>
                <p className="text-2xl font-bold text-stone-900 mt-1">{expiringDomains.filter(d => d.urgency === 'critical').length}</p>
                <AlertTriangle className="h-8 w-8 text-red-400 mt-2" />
              </div>
              <div className="bg-white rounded-2xl border border-amber-200/80 p-4 shadow-sm">
                <p className="text-xs font-medium text-amber-700">{t('common.urgent')}</p>
                <p className="text-2xl font-bold text-stone-900 mt-1">{expiringDomains.filter(d => d.urgency === 'urgent').length}</p>
                <AlertTriangle className="h-8 w-8 text-amber-400 mt-2" />
              </div>
              <div className="bg-white rounded-2xl border border-stone-200/80 p-4 shadow-sm">
                <p className="text-xs font-medium text-stone-500">{t('common.normal')}</p>
                <p className="text-2xl font-bold text-stone-900 mt-1">{expiringDomains.filter(d => d.urgency === 'normal').length}</p>
                <Calendar className="h-8 w-8 text-stone-300 mt-2" />
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-stone-200/80 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-stone-900">{t('common.expiringDomains')}</h3>
                {expiringDomains.length > 0 && (
                  <span className="text-sm text-stone-500">{expiringDomains.length} {t('common.domains')}</span>
                )}
              </div>
              {expiringDomains.length > 0 ? (
                <div className="space-y-3">
                  {expiringDomains.map((domain) => (
                    <div
                      key={domain.id}
                      className={`p-4 rounded-xl border ${
                        domain.urgency === 'critical' ? 'border-red-200 bg-red-50/50' :
                        domain.urgency === 'urgent' ? 'border-amber-200 bg-amber-50/50' : 'border-stone-200 bg-stone-50/50'
                      }`}
                    >
                      <div className="flex items-center justify-between flex-wrap gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-medium text-stone-900">{domain.domain_name}</h4>
                            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                              domain.urgency === 'critical' ? 'bg-red-100 text-red-800' :
                              domain.urgency === 'urgent' ? 'bg-amber-100 text-amber-800' : 'bg-stone-200 text-stone-700'
                            }`}>
                              {domain.urgency === 'critical' ? t('common.critical') : domain.urgency === 'urgent' ? t('common.urgent') : t('common.normal')}
                            </span>
                          </div>
                          <p className="text-sm text-stone-600 mt-1">
                            {t('common.daysUntilExpiry')}: {new Date(domain.expiry_date!).toLocaleDateString()} ·
                            {domain.daysUntilExpiry === 0 ? ` ${t('common.todayExpiry')}` :
                             domain.daysUntilExpiry < 0 ? ` ${t('common.expiredDaysAgo')} ${Math.abs(domain.daysUntilExpiry)} ${t('common.daysLeft')}` :
                             ` ${t('common.daysLeftExpiry')} ${domain.daysUntilExpiry} ${t('common.daysLeftExpiryEnd')}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => domainOps.handleEditDomain(domain)} className="rounded-lg px-3 py-1.5 text-sm font-medium bg-stone-100 text-stone-700 hover:bg-stone-200">
                            {t('common.edit')}
                          </button>
                          <button onClick={() => domainOps.handleRenewDomain(domain)} className="rounded-lg px-3 py-1.5 text-sm font-medium bg-teal-100 text-teal-700 hover:bg-teal-200">
                            {t('common.renew')}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10 text-stone-500">
                  <Calendar className="h-10 w-10 mx-auto mb-3 text-stone-300" />
                  <p className="text-sm">{t('common.noExpiringDomains')}</p>
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
