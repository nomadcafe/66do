'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useSupabaseAuth } from '../../src/contexts/SupabaseAuthContext';
import { useI18nContext } from '../../src/contexts/I18nProvider';
import { logger } from '../../src/lib/logger';
import DomainList from '../../src/components/domain/DomainList';
import DomainForm from '../../src/components/domain/DomainForm';
import SmartDomainForm from '../../src/components/domain/SmartDomainForm';
import TransactionList from '../../src/components/transaction/TransactionList';
import TransactionForm from '../../src/components/transaction/TransactionForm';
import MobileNavigation from '../../src/components/layout/MobileNavigation';
import ShareModal from '../../src/components/share/ShareModal';
import SaleSuccessModal from '../../src/components/share/SaleSuccessModal';
import RenewalModal from '../../src/components/domain/RenewalModal';
import { calculateAnnualRenewalCost, formatRenewalCycleDistributionLabel } from '../../src/lib/renewalCalculations';
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
  LazyAutoDomainMonitor,
  LazyWrapper,
  useSmartPreload
} from '../../src/components/LazyComponents';
import { auditLogger } from '../../src/lib/security';
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
import { calculateBasicFinancialMetrics, sellNetUSD } from '../../src/lib/coreCalculations';
import { totalHoldingCostForDomain } from '../../src/lib/renewalCostBasis';
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
  Database,
  X,
  Info,
} from 'lucide-react';

// Domain and Transaction types are now imported from supabaseService
// DomainStats is now imported from useDomainStats hook



export default function DashboardPage() {
  // 智能预加载组件
  useSmartPreload();
  
  const { user, session, loading: authLoading, signOut } = useSupabaseAuth();
  const { t, locale, setLocale } = useI18nContext();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // activeTab + settings sub-section are persisted in the URL so refresh and shared links preserve view
  const VALID_TABS = ['overview', 'domains', 'transactions', 'analytics', 'alerts', 'settings', 'reports'] as const;
  type TabType = typeof VALID_TABS[number];
  const tabParam = searchParams.get('tab');
  const activeTab: TabType = (VALID_TABS as readonly string[]).includes(tabParam ?? '')
    ? (tabParam as TabType)
    : 'overview';
  const settingsSection: 'preferences' | 'data' =
    searchParams.get('settings') === 'data' ? 'data' : 'preferences';

  const setActiveTab = useCallback((next: TabType) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === 'overview') params.delete('tab'); else params.set('tab', next);
    if (next !== 'settings') params.delete('settings');
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [searchParams, pathname, router]);

  const setSettingsSection = useCallback((next: 'preferences' | 'data') => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === 'preferences') params.delete('settings'); else params.set('settings', next);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [searchParams, pathname, router]);
  const [showShareModal, setShowShareModal] = useState(false);
  const [pendingDeleteDomainId, setPendingDeleteDomainId] = useState<string | null>(null);
  const [pendingDeleteTransactionId, setPendingDeleteTransactionId] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const deleteCancelRef = useRef<HTMLButtonElement>(null);
  const deleteConfirmRef = useRef<HTMLButtonElement>(null);
  const txDeleteCancelRef = useRef<HTMLButtonElement>(null);
  const txDeleteConfirmRef = useRef<HTMLButtonElement>(null);
  
  // 使用自定义Hooks管理数据和操作
  const {
    domains,
    transactions,
    loading,
    error,
    setError,
    saveData,
    refreshData
  } = useDashboardData(user?.id, session?.access_token, session?.refresh_token, t);

  // 数据源约定：transactions = 原始列表（列表/编辑/保存用）；transactionsForMetrics = 分期按实际已收折算（所有指标/图表/分享用）
  // 分期未完成时按实际已收折算的交易列表（Overview、Analytics、Share、Reports 统一使用）
  const transactionsForMetrics = useMemo(() => {
    return transactions
      .filter(transaction => (transaction.base_amount ?? transaction.amount) != null)
      .map(transaction => {
        const fullAmount = (transaction.base_amount ?? transaction.amount) ?? 0;
        let amountUSD = fullAmount;
        let platformFee: number | undefined = transaction.platform_fee ?? undefined;
        let netAmount: number | undefined = transaction.net_amount ?? fullAmount;
        // 仅真实「分期」出售才按已收款比例折算；lump_sum 时表单仍带 installment_amount=0 等字段，若误判会导致销售额/收入在指标里恒为 0
        const isInstallmentSell =
          transaction.type === 'sell' && transaction.payment_plan === 'installment';
        const hasInstallmentData =
          isInstallmentSell &&
          (transaction.installment_amount != null ||
            transaction.downpayment_amount != null ||
            (transaction.paid_periods != null && transaction.installment_period != null));
        const isInstallmentPartialOrCancelled =
          isInstallmentSell &&
          hasInstallmentData &&
          (transaction.installment_status === 'cancelled' ||
            ((transaction.paid_periods ?? 0) < (transaction.installment_period ?? 1)));
        if (isInstallmentPartialOrCancelled) {
          const down = transaction.downpayment_amount ?? 0;
          const paid = transaction.paid_periods ?? 0;
          const perPeriod = transaction.installment_amount ?? 0;
          const actualReceived = down + paid * perPeriod;
          if (fullAmount > 0 && actualReceived >= 0) {
            const ratio = actualReceived / fullAmount;
            amountUSD = actualReceived;
            platformFee = (transaction.platform_fee ?? 0) * ratio;
            netAmount = actualReceived - platformFee;
          }
        }
        return {
          ...transaction,
          base_amount: amountUSD,
          amount: amountUSD,
          platform_fee: platformFee ?? 0,
          net_amount: netAmount ?? amountUSD
        };
      });
  }, [transactions]);

  const stats = useDomainStats(domains, transactionsForMetrics);
  
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
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const msg = (body?.error ?? body?.details ?? response.statusText) || 'Failed to delete domain';
        throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
      }
      await refreshData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setMutationError(`${t('errors.deleteDomainFailed')}: ${msg}`);
      setTimeout(() => setMutationError(null), 5000);
    }
  }, [user?.id, session?.access_token, refreshData, t]);

  const domainOps = useDomainOperations(
    domains,
    transactions,
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

  // Delete-confirm dialog: focus mgmt, Esc to close, Enter to confirm (via natural focus on confirm), Tab trap, scroll lock
  useEffect(() => {
    if (!pendingDeleteDomainId) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    // Focus the destructive button so Enter naturally confirms; pair with focus-visible ring for clarity
    const focusTimer = window.setTimeout(() => deleteConfirmRef.current?.focus(), 0);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setPendingDeleteDomainId(null);
        return;
      }
      if (e.key === 'Tab') {
        const cancel = deleteCancelRef.current;
        const confirm = deleteConfirmRef.current;
        if (!cancel || !confirm) return;
        const active = document.activeElement;
        if (e.shiftKey && active === cancel) {
          e.preventDefault();
          confirm.focus();
        } else if (!e.shiftKey && active === confirm) {
          e.preventDefault();
          cancel.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus?.();
    };
  }, [pendingDeleteDomainId]);

  // Same a11y treatment for the transaction-delete dialog
  useEffect(() => {
    if (!pendingDeleteTransactionId) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const focusTimer = window.setTimeout(() => txDeleteConfirmRef.current?.focus(), 0);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setPendingDeleteTransactionId(null);
        return;
      }
      if (e.key === 'Tab') {
        const cancel = txDeleteCancelRef.current;
        const confirm = txDeleteConfirmRef.current;
        if (!cancel || !confirm) return;
        const active = document.activeElement;
        if (e.shiftKey && active === cancel) {
          e.preventDefault();
          confirm.focus();
        } else if (!e.shiftKey && active === confirm) {
          e.preventDefault();
          cancel.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus?.();
    };
  }, [pendingDeleteTransactionId]);

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
    setError,
    session?.access_token
  );
  
  // Redirect if not authenticated (but wait for auth to load)
  useEffect(() => {
    if (!authLoading && !user) {
      logger.log('No user found, redirecting to login');
      router.push('/login?redirect=/dashboard');
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

  // 即将到期 + 刚过期（7 天内）：30 天内到期或已过期 7 天内，便于续费/标记已售
  const EXPIRING_WINDOW_DAYS = 30;
  const RECENTLY_EXPIRED_DAYS = 7;
  const expiringDomains = useMemo(() => {
    return domains.filter(domain => {
      if (domain.status === 'sold') return false;
      if (!domain.expiry_date) return false;
      const daysUntilExpiry = Math.ceil((new Date(domain.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      return daysUntilExpiry <= EXPIRING_WINDOW_DAYS && daysUntilExpiry >= -RECENTLY_EXPIRED_DAYS;
    }).map(domain => {
      const daysUntilExpiry = Math.ceil((new Date(domain.expiry_date!).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      const urgency = daysUntilExpiry < 0
        ? 'expired'
        : daysUntilExpiry <= 7
          ? 'critical'
          : daysUntilExpiry <= 14
            ? 'urgent'
            : 'normal';
      return { ...domain, daysUntilExpiry, urgency };
    }).sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
  }, [domains]);

  // 最近交易：按交易日期降序取前 5 条，金额用 transactionsForMetrics（分期按实际已收）与 Overview 口径一致
  const recentTransactions = useMemo(() => {
    return [...transactionsForMetrics]
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      .slice(0, 5);
  }, [transactionsForMetrics]);

  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en-US', {
      year: 'numeric', month: 'short', day: 'numeric'
    }),
    [locale]
  );
  const formatTransactionDate = useCallback((d: string | null | undefined) => {
    if (!d) return '';
    const parsed = new Date(d);
    return Number.isNaN(parsed.getTime()) ? d : dateFormatter.format(parsed);
  }, [dateFormatter]);

  // 计算增强的财务指标（使用按分期调整后的交易列表）
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

    const validTransactions = transactionsForMetrics.map(t => ({
      id: t.id,
      domain_id: t.domain_id,
      type: t.type,
      amount: t.amount,
      platform_fee: t.platform_fee ?? 0,
      net_amount: t.net_amount ?? t.amount,
      date: t.date,
      category: t.category
    }));

    return calculateEnhancedFinancialMetrics(validDomains, validTransactions);
  }, [domains, transactionsForMetrics]);

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
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setMutationError(`${t('errors.saveDomainFailed')}: ${msg}`);
      setTimeout(() => setMutationError(null), 5000);
    }
  }, [domainOps, domains, transactions, saveData, t]);

  const handleViewDomain = useCallback((domain: DomainWithTags) => {
    domainOps.setEditingDomain(domain);
    domainOps.setShowDomainForm(true);
  }, [domainOps]);

  // Share 数据与 Analytics 一致：基于按分期调整后的交易（实际已收），非 domain.sale_price
  const shareData = useMemo(() => {
    const metrics = calculateBasicFinancialMetrics(domains, transactionsForMetrics);
    const totalInvestment = metrics.totalInvestment;
    const totalProfit = metrics.totalProfit;
    const roi = metrics.roi;

    // 最佳表现域名：按出售交易净收入 - 持有成本 计算单域名利润，与 Analytics 口径一致
    const sellTxByDomainId = transactionsForMetrics.filter((t) => t.type === 'sell').reduce((acc, t) => {
      const id = t.domain_id;
      acc[id] = (acc[id] || 0) + sellNetUSD(t);
      return acc;
    }, {} as Record<string, number>);

    let bestDomain: DomainWithTags | null = null;
    let bestProfit = -Infinity;
    for (const domain of domains) {
      const revenue = sellTxByDomainId[domain.id] ?? 0;
      if (revenue <= 0) continue;
      const holdingCost = totalHoldingCostForDomain(domain, transactionsForMetrics);
      const profit = revenue - holdingCost;
      if (profit > bestProfit) {
        bestProfit = profit;
        bestDomain = domain;
      }
    }

    // Investment period: earliest purchase → latest activity (last sale/transaction or now)
    const domainsWithPurchaseDate = domains.filter((d) => d.purchase_date);
    const purchaseDates = domainsWithPurchaseDate.map((d) => new Date(d.purchase_date!).getTime());
    const transactionDates = transactions.map((t) => new Date(t.date).getTime());
    const saleDates = domains.filter((d) => d.sale_date).map((d) => new Date(d.sale_date!).getTime());
    const now = Date.now();
    const startMs = purchaseDates.length > 0 ? Math.min(...purchaseDates) : now;
    const endMs = Math.max(now, ...transactionDates, ...saleDates, startMs);
    const days = Math.max(0, Math.floor((endMs - startMs) / (1000 * 60 * 60 * 24)));
    let investmentPeriod: string;
    if (days === 0) investmentPeriod = locale === 'zh' ? '—' : '—';
    else if (days < 30) investmentPeriod = locale === 'zh' ? `${days}天` : `${days} days`;
    else if (days < 365) investmentPeriod = locale === 'zh' ? `${Math.floor(days / 30)}个月` : `${Math.floor(days / 30)} months`;
    else {
      const years = Math.floor(days / 365);
      const months = Math.floor((days % 365) / 30);
      investmentPeriod = locale === 'zh' ? `${years}年${months}个月` : `${years}y ${months}mo`;
    }

    const soldDomains = domains.filter((d) => d.status === 'sold');
    return {
      totalProfit,
      roi,
      bestDomain: bestDomain?.domain_name ?? '—',
      investmentPeriod,
      domainCount: domains.length,
      totalInvestment,
      soldDomains
    };
  }, [domains, transactions, transactionsForMetrics, locale]);



  // Filter domains based on search and status

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 text-stone-900">
        <div className="border-b border-stone-200/60 bg-white/90 backdrop-blur-md sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-stone-200 rounded-xl animate-pulse" />
              <div className="space-y-1.5">
                <div className="h-4 w-32 bg-stone-200 rounded animate-pulse" />
                <div className="h-3 w-20 bg-stone-200 rounded animate-pulse" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-24 h-9 bg-stone-200 rounded-xl animate-pulse hidden sm:block" />
              <div className="w-32 h-10 bg-stone-200 rounded-xl animate-pulse" />
            </div>
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl border border-stone-200/80 p-5 shadow-sm">
                <div className="flex items-start justify-between">
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-24 bg-stone-200 rounded animate-pulse" />
                    <div className="h-7 w-20 bg-stone-200 rounded animate-pulse" />
                    <div className="h-3 w-28 bg-stone-100 rounded animate-pulse" />
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-stone-100 animate-pulse shrink-0" />
                </div>
              </div>
            ))}
          </div>
          <div className="bg-white rounded-2xl border border-stone-200/80 mb-6 p-1.5 shadow-sm">
            <div className="h-9 bg-stone-100 rounded-lg animate-pulse" />
          </div>
          <div className="bg-white rounded-2xl border border-stone-200/80 shadow-sm grid grid-cols-2 sm:grid-cols-4 divide-stone-100 sm:divide-x divide-y sm:divide-y-0 mb-8">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="p-4 space-y-2">
                <div className="h-3 w-20 bg-stone-200 rounded animate-pulse" />
                <div className="h-5 w-16 bg-stone-200 rounded animate-pulse" />
                <div className="h-3 w-28 bg-stone-100 rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
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

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 antialiased">
      {/* Desktop Header */}
      <header className="hidden lg:block border-b border-stone-200/60 bg-white/90 backdrop-blur-md sticky top-0 z-50 shadow-sm shadow-stone-200/50">
        <div className="max-w-6xl mx-auto px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="w-10 h-10 bg-stone-800 rounded-xl flex items-center justify-center text-white shadow-sm group-hover:bg-stone-700 transition-colors">
                <Globe className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-lg font-semibold tracking-tight text-stone-900 leading-tight">
                  <span className="text-stone-800">Domain</span>
                  <span className="text-teal-600">.Financial</span>
                </h1>
                <p className="text-xs text-stone-500 mt-0.5">{t('dashboard.title')}</p>
              </div>
            </Link>
            <div className="flex items-center gap-4">
              <div
                role="group"
                aria-label={t('settings.selectLanguage')}
                className="flex items-center gap-0.5 p-1 rounded-xl border border-stone-200 bg-stone-50/80"
              >
                <button
                  type="button"
                  onClick={() => setLocale('zh')}
                  aria-pressed={locale === 'zh'}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-1 ${
                    locale === 'zh' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  {t('settings.chinese')}
                </button>
                <button
                  type="button"
                  onClick={() => setLocale('en')}
                  aria-pressed={locale === 'en'}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-1 ${
                    locale === 'en' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  {t('settings.english')}
                </button>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-stone-200/80 bg-stone-50/80">
                <div className="w-8 h-8 bg-stone-700 rounded-full flex items-center justify-center text-white text-sm font-medium">
                  {user?.email ? user.email.charAt(0).toUpperCase() : <User className="h-4 w-4" />}
                </div>
                <div className="hidden xl:block">
                  <span className="text-sm font-medium text-stone-900 block leading-tight">{user?.email?.split('@')[0] || 'User'}</span>
                  <span className="text-xs text-stone-500 block leading-tight truncate max-w-[140px]">{user?.email || ''}</span>
                </div>
              </div>
              <button
                onClick={transactionOps.handleAddTransaction}
                className="border border-stone-300 text-stone-700 px-4 py-2.5 rounded-xl hover:bg-stone-100 flex items-center gap-2 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
              >
                <FileText size={18} />
                <span>{t('transaction.add')}</span>
              </button>
              <button
                onClick={domainOps.handleAddDomain}
                className="bg-teal-600 text-white px-5 py-2.5 rounded-xl hover:bg-teal-700 flex items-center gap-2 text-sm font-medium shadow-sm shadow-teal-600/20 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
              >
                <Plus size={18} />
                <span>{t('dashboard.addInvestment')}</span>
              </button>
              <button
                onClick={() => setShowShareModal(true)}
                aria-label={t('dashboard.shareResults')}
                title={t('dashboard.shareResults')}
                className="text-stone-500 hover:text-stone-800 p-2.5 rounded-xl hover:bg-stone-100 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
              >
                <Share2 size={18} />
              </button>
              <button
                onClick={async () => { await signOut(); router.push('/'); }}
                className="text-stone-500 hover:text-stone-800 flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-stone-100 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
              >
                <LogOut size={18} />
                <span>{t('dashboard.signOut')}</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Header */}
      <header className="lg:hidden border-b border-stone-200/60 bg-white/95 backdrop-blur-md sticky top-0 z-50 shadow-sm shadow-stone-200/50">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="w-9 h-9 bg-stone-800 rounded-xl flex items-center justify-center text-white shadow-sm">
                <Globe className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-base font-semibold tracking-tight text-stone-900 leading-tight">
                  <span className="text-stone-800">Domain</span>
                  <span className="text-teal-600">.Financial</span>
                </h1>
                <p className="text-xs text-stone-500 mt-0.5">{t('dashboard.title')}</p>
              </div>
            </Link>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-stone-700 rounded-full flex items-center justify-center text-white text-xs font-medium">
                {user?.email ? user.email.charAt(0).toUpperCase() : <User className="h-4 w-4" />}
              </div>
              <button onClick={domainOps.handleAddDomain} aria-label={t('dashboard.addInvestment')} className="bg-teal-600 text-white p-2.5 rounded-xl hover:bg-teal-700 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2">
                <Plus size={18} />
              </button>
              <button onClick={() => setShowShareModal(true)} aria-label={t('dashboard.shareResults')} className="text-stone-600 p-2.5 rounded-xl hover:bg-stone-100 border border-stone-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2">
                <Share2 size={18} />
              </button>
              <button onClick={async () => { await signOut(); router.push('/'); }} aria-label={t('dashboard.signOut')} className="text-stone-600 p-2.5 rounded-xl hover:bg-stone-100 border border-stone-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2">
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Inline mutation error (delete/save domain) */}
        {mutationError && (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-800">
            <span className="flex items-center gap-2 text-sm">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {mutationError}
            </span>
            <button
              type="button"
              onClick={() => setMutationError(null)}
              className="shrink-0 rounded-lg p-1.5 text-red-600 hover:bg-red-100"
              aria-label={t('common.close')}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

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
                <p className="text-2xl font-bold text-stone-900 mt-1">{formatCurrencyEnhanced(stats.totalInvestment)}</p>
                <p className="text-xs text-stone-500 mt-1">{t('dashboard.average')} {formatCurrencyEnhanced(stats.avgPurchasePrice)}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600"><DollarSign className="h-5 w-5" /></div>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-stone-200/80 p-5 shadow-sm hover:shadow transition">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-stone-500 flex items-center gap-1">
                  {t('dashboard.totalRevenue')}
                  <span className="relative inline-block group">
                    <button
                      type="button"
                      aria-label={t('dashboard.totalRevenueDesc')}
                      className="inline-flex text-stone-400 hover:text-stone-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 rounded"
                    >
                      <Info className="h-3.5 w-3.5" />
                    </button>
                    <span
                      role="tooltip"
                      className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-full mt-1.5 w-max max-w-[220px] whitespace-normal rounded-md bg-stone-900 px-2 py-1 text-[11px] font-normal normal-case tracking-normal text-white opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 z-20"
                    >
                      {t('dashboard.totalRevenueDesc')}
                    </span>
                  </span>
                </p>
                <p className="text-2xl font-bold text-stone-900 mt-1">{formatCurrencyEnhanced(stats.totalRevenue)}</p>
                <p className="text-xs text-stone-500 mt-1">{t('dashboard.afterFees')}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600"><TrendingUp className="h-5 w-5" /></div>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-stone-200/80 p-5 shadow-sm hover:shadow transition">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-stone-500">{t('dashboard.roi')}</p>
                <p className="text-2xl font-bold text-stone-900 mt-1">{stats.roi.toFixed(1)}%</p>
                <p className="text-xs text-stone-500 mt-1">{t('dashboard.totalProfit')} {formatCurrencyEnhanced(stats.totalProfit)}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600"><BarChart3 className="h-5 w-5" /></div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="relative bg-white rounded-2xl border border-stone-200/80 shadow-sm mb-6 overflow-hidden">
          <nav className="flex gap-1 p-1.5 overflow-x-auto bg-stone-50/50 border-b border-stone-100" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('overview')}
              className={`rounded-lg px-3.5 py-2 text-sm font-medium whitespace-nowrap flex items-center gap-1.5 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-1 ${
                activeTab === 'overview' ? 'bg-stone-900 text-white shadow-sm' : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
              }`}
            >
              <Activity className="h-4 w-4" />
              {t('dashboard.overview')}
            </button>
            <button
              onClick={() => setActiveTab('domains')}
              className={`rounded-lg px-3.5 py-2 text-sm font-medium whitespace-nowrap flex items-center gap-1.5 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-1 ${
                activeTab === 'domains' ? 'bg-stone-900 text-white shadow-sm' : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
              }`}
            >
              <Globe className="h-4 w-4" />
              {t('dashboard.domains')}
            </button>
            <button
              onClick={() => setActiveTab('transactions')}
              className={`rounded-lg px-3.5 py-2 text-sm font-medium whitespace-nowrap flex items-center gap-1.5 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-1 ${
                activeTab === 'transactions' ? 'bg-stone-900 text-white shadow-sm' : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
              }`}
            >
              <FileText className="h-4 w-4" />
              {t('dashboard.transactions')}
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`rounded-lg px-3.5 py-2 text-sm font-medium whitespace-nowrap flex items-center gap-1.5 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-1 ${
                activeTab === 'analytics' ? 'bg-stone-900 text-white shadow-sm' : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
              }`}
            >
              <PieChart className="h-4 w-4" />
              {t('dashboard.analytics')}
            </button>
            <button
              onClick={() => setActiveTab('alerts')}
              className={`rounded-lg px-3.5 py-2 text-sm font-medium whitespace-nowrap flex items-center gap-1.5 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-1 ${
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
              className={`rounded-lg px-3.5 py-2 text-sm font-medium whitespace-nowrap flex items-center gap-1.5 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-1 ${
                activeTab === 'settings' ? 'bg-stone-900 text-white shadow-sm' : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
              }`}
            >
              <Settings className="h-4 w-4" />
              {t('dashboard.settings')}
            </button>
            <button
              onClick={() => setActiveTab('reports')}
              className={`rounded-lg px-3.5 py-2 text-sm font-medium whitespace-nowrap flex items-center gap-1.5 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-1 ${
                activeTab === 'reports' ? 'bg-stone-900 text-white shadow-sm' : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
              }`}
            >
              <BarChart3 className="h-4 w-4" />
              {t('dashboard.reports')}
            </button>
          </nav>
          {/* Right-edge fade to hint horizontal overflow on narrow screens */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute right-0 top-0 bottom-px w-10 bg-gradient-to-l from-stone-50 via-stone-50/70 to-transparent lg:hidden"
          />
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* 次级财务指标：紧凑单容器，视觉层级让位于顶部 KPI */}
            <div className="bg-white rounded-2xl border border-stone-200/80 shadow-sm grid grid-cols-2 sm:grid-cols-4 divide-stone-100 sm:divide-x divide-y sm:divide-y-0 mb-8">
              <div className="p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-stone-500">{t('financial.totalSales')}</p>
                <p className="text-lg font-bold text-stone-900 mt-1">{formatCurrencyEnhanced(stats.totalGrossSales)}</p>
                <p className="text-xs text-stone-500 mt-1">{t('financial.totalSalesDesc')}</p>
              </div>
              <div className="p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-stone-500">{t('financial.platformFees')}</p>
                <p className="text-lg font-bold text-stone-900 mt-1">{formatCurrencyEnhanced(enhancedFinancialMetrics.totalPlatformFees)}</p>
                <p className="text-xs text-stone-500 mt-1">{t('financial.platformFeesDesc')}</p>
              </div>
              <div className="p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-stone-500">{t('financial.annualSales')}</p>
                <p className="text-lg font-bold text-stone-900 mt-1">{formatCurrencyEnhanced(enhancedFinancialMetrics.annualSales)}</p>
                <p className="text-xs text-stone-500 mt-1">{t('financial.annualSalesDesc')}</p>
              </div>
              <div className="p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-stone-500">{t('financial.annualProfit')}</p>
                <p className={`text-lg font-bold mt-1 ${enhancedFinancialMetrics.annualProfit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{formatCurrencyEnhanced(enhancedFinancialMetrics.annualProfit)}</p>
                <p className="text-xs text-stone-500 mt-1">{t('financial.annualProfitDesc')}</p>
              </div>
            </div>

            {/* 无域名时首屏引导 */}
            {domains.length === 0 && (
              <div className="bg-teal-50/80 border border-teal-200/80 rounded-2xl p-6 text-center mb-8">
                <p className="text-stone-700 mb-4">{t('domainList.getStarted')}</p>
                <button onClick={domainOps.handleAddDomain} className="rounded-xl bg-teal-600 text-white px-5 py-2.5 text-sm font-medium inline-flex items-center gap-2 hover:bg-teal-700">
                  <Plus className="h-4 w-4" />
                  {t('domainList.addFirstDomain')}
                </button>
              </div>
            )}

            {/* Highlights - Add 操作已移至 header，这里仅保留状态摘要 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              {(() => {
                const bestDomainObj = stats.bestPerformingDomain
                  ? domains.find((d) => d.domain_name === stats.bestPerformingDomain)
                  : undefined;
                const canOpenBest = Boolean(bestDomainObj);
                return (
                  <button
                    type="button"
                    onClick={() => bestDomainObj && handleViewDomain(bestDomainObj)}
                    disabled={!canOpenBest}
                    className={`text-left bg-white rounded-2xl border border-stone-200/80 p-5 shadow-sm transition ${
                      canOpenBest ? 'hover:border-stone-300 hover:shadow cursor-pointer' : 'cursor-default'
                    } focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500`}
                  >
                    <h3 className="text-sm font-semibold text-stone-900 mb-2 flex items-center gap-2">
                      <Award className="h-4 w-4 text-emerald-500" />
                      {t('dashboard.bestPerformance')}
                    </h3>
                    <p className="text-lg font-bold text-stone-900">{stats.bestPerformingDomain || '—'}</p>
                    <p className="text-xs text-stone-500 mt-1">{t('dashboard.bestInvestment')}</p>
                  </button>
                );
              })()}
              <button
                type="button"
                onClick={() => expiringDomains.length > 0 && setActiveTab('alerts')}
                disabled={expiringDomains.length === 0}
                className={`text-left bg-white rounded-2xl border border-stone-200/80 p-5 shadow-sm transition ${
                  expiringDomains.length > 0 ? 'hover:border-stone-300 hover:shadow cursor-pointer' : 'cursor-default'
                } focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500`}
              >
                <h3 className="text-sm font-semibold text-stone-900 mb-2 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                  {t('dashboard.needAttention')}
                </h3>
                <p className="text-lg font-bold text-stone-900">{expiringDomains.length}</p>
                <p className="text-xs text-stone-500 mt-1">{t('dashboard.expiringSoon')}</p>
              </button>
            </div>

            {/* 续费分析 */}
            <div className="bg-white rounded-2xl border border-stone-200/80 p-6 shadow-sm mb-8">
              <h3 className="text-base font-semibold text-stone-900 mb-4">{t('renewal.analysis')}</h3>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="rounded-xl bg-stone-50 p-4 border border-stone-100">
                  <p className="text-xs font-medium text-stone-500">{t('renewal.thisYearCost')}</p>
                  <p className="text-xl font-bold text-stone-900 mt-1">{formatCurrencyEnhanced(renewalAnalysis.totalAnnualCost, 'USD')}</p>
                </div>
                <div className="rounded-xl bg-stone-50 p-4 border border-stone-100">
                  <p className="text-xs font-medium text-stone-500">{t('renewal.needRenewal')}</p>
                  <p className="text-xl font-bold text-teal-700 mt-1">{renewalAnalysis.domainsNeedingRenewal.length}</p>
                </div>
                <div className="rounded-xl bg-stone-50 p-4 border border-stone-100">
                  <p className="text-xs font-medium text-stone-500">{t('renewal.noRenewal')}</p>
                  <p className="text-xl font-bold text-stone-900 mt-1">{renewalAnalysis.domainsNotNeedingRenewal.length}</p>
                </div>
                <div className="rounded-xl bg-stone-50 p-4 border border-stone-100">
                  <p className="text-xs font-medium text-stone-500">{t('renewal.averageCostPerDomain')}</p>
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
                        <p className="text-xs text-stone-500">
                          {formatRenewalCycleDistributionLabel(cycle, locale, t)}
                        </p>
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
              <LazyExpiredDomainLossAnalysis domains={domains} transactions={transactions} />
            </LazyWrapper>

            {/* Recent Transactions */}
            <div className="bg-white rounded-2xl border border-stone-200/80 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-stone-100">
                <h3 className="text-base font-semibold text-stone-900">{t('common.recentTransactions')}</h3>
              </div>
              <div className="p-5">
                {recentTransactions.length > 0 ? (
                  <div className="space-y-1">
                    {recentTransactions.map((transaction) => {
                      const domain = domains.find(d => d.id === transaction.domain_id);
                      const sign = transaction.type === 'sell' ? '+' : '-';
                      const amountColor =
                        transaction.type === 'sell' ? 'text-emerald-600' :
                        transaction.type === 'buy' ? 'text-teal-700' :
                        transaction.type === 'renew' ? 'text-amber-700' :
                        'text-stone-700';
                      return (
                        <button
                          key={transaction.id}
                          type="button"
                          onClick={() => domain && domainOps.handleEditDomain(domain)}
                          disabled={!domain}
                          aria-label={domain ? `${t(`transaction.${transaction.type}`)} · ${domain.domain_name}` : undefined}
                          className="w-full text-left flex items-center justify-between py-3 px-3 rounded-lg hover:bg-stone-50/80 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-1 disabled:cursor-default disabled:hover:bg-transparent"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center ${
                              transaction.type === 'buy' ? 'bg-teal-50 text-teal-600' :
                              transaction.type === 'sell' ? 'bg-emerald-50 text-emerald-600' :
                              transaction.type === 'renew' ? 'bg-amber-50 text-amber-600' : 'bg-stone-100 text-stone-600'
                            }`}>
                              {transaction.type === 'buy' ? <Plus className="h-4 w-4" /> :
                               transaction.type === 'sell' ? <TrendingUp className="h-4 w-4" /> :
                               transaction.type === 'renew' ? <RefreshCw className="h-4 w-4" /> :
                               <FileText className="h-4 w-4" />}
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-stone-900 truncate">
                                {domain?.domain_name || t('common.unknownDomain')}
                              </p>
                              <p className="text-xs text-stone-500">{t(`transaction.${transaction.type}`)} · {formatTransactionDate(transaction.date)}</p>
                            </div>
                          </div>
                          <p className={`font-semibold text-sm shrink-0 ml-3 ${amountColor}`}>
                            {sign}{formatCurrencyEnhanced(transaction.base_amount ?? transaction.amount)}
                          </p>
                        </button>
                      );
                    })}
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
              transactions={transactions}
              onEdit={domainOps.handleEditDomain}
              onDelete={setPendingDeleteDomainId}
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
            onDelete={setPendingDeleteTransactionId}
            onAdd={transactionOps.handleAddTransaction}
          />
        )}

        {activeTab === 'analytics' && (
          <LazyWrapper>
            <LazyInvestmentAnalytics 
            domains={domains} 
            transactions={transactionsForMetrics} 
          />
          </LazyWrapper>
        )}

        {activeTab === 'alerts' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              <div className="bg-white rounded-2xl border border-stone-200/80 p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-medium uppercase tracking-wider text-stone-500">{t('common.totalExpiring')}</p>
                    <p className="text-2xl font-bold text-stone-900 mt-1">{expiringDomains.length}</p>
                  </div>
                  <div className="w-9 h-9 rounded-xl bg-stone-100 flex items-center justify-center text-stone-500 shrink-0">
                    <Calendar className="h-4 w-4" />
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-stone-200/80 p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-medium uppercase tracking-wider text-stone-500">{t('common.critical')}</p>
                    <p className="text-2xl font-bold text-stone-900 mt-1">{expiringDomains.filter(d => d.urgency === 'critical').length}</p>
                  </div>
                  <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center text-red-600 shrink-0">
                    <AlertTriangle className="h-4 w-4" />
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-stone-200/80 p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-medium uppercase tracking-wider text-stone-500">{t('common.urgent')}</p>
                    <p className="text-2xl font-bold text-stone-900 mt-1">{expiringDomains.filter(d => d.urgency === 'urgent').length}</p>
                  </div>
                  <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 shrink-0">
                    <AlertTriangle className="h-4 w-4" />
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-stone-200/80 p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-medium uppercase tracking-wider text-stone-500">{t('common.normal')}</p>
                    <p className="text-2xl font-bold text-stone-900 mt-1">{expiringDomains.filter(d => d.urgency === 'normal').length}</p>
                  </div>
                  <div className="w-9 h-9 rounded-xl bg-stone-100 flex items-center justify-center text-stone-500 shrink-0">
                    <Calendar className="h-4 w-4" />
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-stone-200/80 p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-medium uppercase tracking-wider text-stone-500">{t('common.recentlyExpired')}</p>
                    <p className="text-2xl font-bold text-stone-900 mt-1">{expiringDomains.filter(d => d.urgency === 'expired').length}</p>
                  </div>
                  <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center text-red-700 shrink-0">
                    <AlertTriangle className="h-4 w-4" />
                  </div>
                </div>
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
                  {expiringDomains.map((domain) => {
                    const accent =
                      domain.urgency === 'expired' || domain.urgency === 'critical'
                        ? 'border-l-red-500'
                        : domain.urgency === 'urgent'
                          ? 'border-l-amber-500'
                          : 'border-l-stone-300';
                    const countdownColor =
                      domain.daysUntilExpiry < 0
                        ? 'text-red-700'
                        : domain.daysUntilExpiry <= 7
                          ? 'text-red-600'
                          : domain.daysUntilExpiry <= 14
                            ? 'text-amber-600'
                            : 'text-stone-600';
                    const countdownText =
                      domain.daysUntilExpiry === 0
                        ? t('common.todayExpiry')
                        : domain.daysUntilExpiry < 0
                          ? `${t('common.expiredDaysAgo')} ${Math.abs(domain.daysUntilExpiry)} ${t('common.daysAgo')}`
                          : `${t('common.daysLeftExpiry')} ${domain.daysUntilExpiry} ${t('common.daysLeftExpiryEnd')}`;
                    return (
                      <div
                        key={domain.id}
                        className={`flex items-center justify-between gap-3 flex-wrap p-3 rounded-xl border border-stone-200 border-l-4 ${accent} bg-white`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-medium text-stone-900 truncate">{domain.domain_name}</h4>
                            <span
                              className={`px-1.5 py-0.5 text-[10px] font-semibold rounded uppercase tracking-wide ${
                                domain.urgency === 'expired'
                                  ? 'bg-red-100 text-red-900'
                                  : domain.urgency === 'critical'
                                    ? 'bg-red-100 text-red-800'
                                    : domain.urgency === 'urgent'
                                      ? 'bg-amber-100 text-amber-800'
                                      : 'bg-stone-100 text-stone-700'
                              }`}
                            >
                              {domain.urgency === 'expired' ? t('common.expired') : domain.urgency === 'critical' ? t('common.critical') : domain.urgency === 'urgent' ? t('common.urgent') : t('common.normal')}
                            </span>
                          </div>
                          <p className="text-xs text-stone-500 mt-0.5 truncate">
                            {domain.registrar && <>{domain.registrar} · </>}
                            {new Date(domain.expiry_date!).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`text-xs font-semibold tabular-nums ${countdownColor}`}>{countdownText}</span>
                          <button onClick={() => domainOps.handleEditDomain(domain)} className="rounded-lg px-2.5 py-1 text-xs font-medium bg-stone-100 text-stone-700 hover:bg-stone-200">
                            {t('common.edit')}
                          </button>
                          <button onClick={() => domainOps.handleRenewDomain(domain)} className="rounded-lg px-2.5 py-1 text-xs font-medium bg-teal-600 text-white hover:bg-teal-700">
                            {t('common.renew')}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-10 text-stone-500">
                  <Calendar className="h-10 w-10 mx-auto mb-3 text-stone-300" />
                  <p className="text-sm font-medium text-stone-600">{t('common.noExpiringDomains')}</p>
                  <p className="text-xs text-stone-400 mt-1 max-w-sm mx-auto">{t('common.expiringEmptyHint')}</p>
                </div>
              )}
            </div>

            <LazyWrapper>
              <LazyAutoDomainMonitor domains={domains} showNotifications={true} />
            </LazyWrapper>
          </div>
        )}


        {activeTab === 'settings' && (
          <div className="space-y-4">
            <div className="flex gap-2 p-1 rounded-xl bg-stone-100 w-fit">
              <button
                onClick={() => setSettingsSection('preferences')}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                  settingsSection === 'preferences' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                {t('dashboard.settings')}
              </button>
              <button
                onClick={() => setSettingsSection('data')}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition flex items-center gap-2 ${
                  settingsSection === 'data' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <Database className="h-4 w-4" />
                {t('dashboard.dataAndBackup')}
              </button>
            </div>
            {settingsSection === 'preferences' && (
              <LazyWrapper>
                <LazyUserPreferencesPanel />
              </LazyWrapper>
            )}
            {settingsSection === 'data' && (
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
                  a.download = `domain-financial-backup-${new Date().toISOString().split('T')[0]}.json`;
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
          </div>
        )}

        {activeTab === 'reports' && (
          <div className="space-y-6">
            {/* 综合财务报告 */}
            <LazyWrapper>
              <LazyFinancialReport
              domains={domains}
              transactions={transactionsForMetrics}
            />
            </LazyWrapper>
            
            {/* 投资分析 */}
            <LazyWrapper>
              <LazyFinancialAnalysis
              domains={domains}
              transactions={transactionsForMetrics}
            />
            </LazyWrapper>
          </div>
        )}
        </div>

      {/* Delete Domain Confirmation Dialog */}
      {pendingDeleteDomainId && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="confirm-delete-title"
          aria-describedby="confirm-delete-desc"
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setPendingDeleteDomainId(null); }}
        >
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full">
            <h3 id="confirm-delete-title" className="text-base font-semibold text-stone-900">{t('common.confirmDelete')}</h3>
            <p id="confirm-delete-desc" className="mt-2 text-sm text-stone-600">
              {t('common.confirmDeleteDomain')}{' '}
              <span className="font-medium text-stone-900">
                {domains.find(d => d.id === pendingDeleteDomainId)?.domain_name ?? ''}
              </span>？
            </p>
            <div className="flex gap-3 mt-6">
              <button
                ref={deleteCancelRef}
                onClick={() => setPendingDeleteDomainId(null)}
                className="flex-1 rounded-xl px-4 py-2 text-sm font-medium bg-stone-100 text-stone-700 hover:bg-stone-200 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
              >
                {t('common.cancel')}
              </button>
              <button
                ref={deleteConfirmRef}
                onClick={async () => {
                  const id = pendingDeleteDomainId;
                  if (!id) return;
                  await domainOps.handleDeleteDomain(id);
                  setPendingDeleteDomainId(null);
                }}
                className="flex-1 rounded-xl px-4 py-2 text-sm font-medium bg-red-600 text-white hover:bg-red-700 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
              >
                {t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Transaction Confirmation Dialog */}
      {pendingDeleteTransactionId && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="confirm-delete-tx-title"
          aria-describedby="confirm-delete-tx-desc"
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setPendingDeleteTransactionId(null); }}
        >
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full">
            <h3 id="confirm-delete-tx-title" className="text-base font-semibold text-stone-900">{t('common.confirmDelete')}</h3>
            <p id="confirm-delete-tx-desc" className="mt-2 text-sm text-stone-600">
              {t('common.confirmDeleteTransaction')}
            </p>
            <div className="flex gap-3 mt-6">
              <button
                ref={txDeleteCancelRef}
                onClick={() => setPendingDeleteTransactionId(null)}
                className="flex-1 rounded-xl px-4 py-2 text-sm font-medium bg-stone-100 text-stone-700 hover:bg-stone-200 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
              >
                {t('common.cancel')}
              </button>
              <button
                ref={txDeleteConfirmRef}
                onClick={async () => {
                  const id = pendingDeleteTransactionId;
                  if (!id) return;
                  await transactionOps.handleDeleteTransaction(id);
                  setPendingDeleteTransactionId(null);
                }}
                className="flex-1 rounded-xl px-4 py-2 text-sm font-medium bg-red-600 text-white hover:bg-red-700 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
              >
                {t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Domain Edit Drawer */}
      <DomainForm
        key={domainOps.editingDomain?.id || 'edit-new'}
        domain={domainOps.editingDomain}
        isOpen={domainOps.showDomainForm}
        onClose={() => {
          domainOps.setShowDomainForm(false);
          domainOps.setEditingDomain(undefined);
        }}
        onSave={handleSaveDomain}
        closeRef={domainFormCloseRef}
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
        domains={domains}
        transactions={transactionsForMetrics}
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
          transactions={transactions}
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
          onRenew={async (domain, input) => {
            await domainOps.processRenewal(domain, input);
          }}
        />
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
