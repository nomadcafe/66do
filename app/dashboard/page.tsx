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
import PortfolioHealthCard from '../../src/components/dashboard/PortfolioHealthCard';
import WeeklyBriefing, { type BriefingCard } from '../../src/components/dashboard/WeeklyBriefing';
import SettingsDrawer from '../../src/components/dashboard/SettingsDrawer';
import { calculateAnnualRenewalCost, formatRenewalCycleDistributionLabel } from '../../src/lib/renewalCalculations';
// import { domainExpiryManager } from '../../src/lib/domainExpiryManager';
import { formatCurrency as formatCurrencyEnhanced } from '../../src/lib/enhancedFinancialMetrics';
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
  TrendingUp,
  LogOut,
  User,
  FileText,
  AlertTriangle,
  Calendar,
  Award,
  Share2,
  PieChart,
  Settings,
  RefreshCw,
  X,
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

  // 3-tab structure (Portfolio / Activity / Insights). Settings is a header drawer, not a tab.
  // Old ?tab= values are normalized for backwards compat with existing links.
  const VALID_TABS = ['portfolio', 'activity', 'insights'] as const;
  type TabType = typeof VALID_TABS[number];

  const normalizeTab = (raw: string | null): TabType => {
    if (raw === 'portfolio' || raw === 'activity' || raw === 'insights') return raw;
    if (raw === 'transactions') return 'activity';
    if (raw === 'analytics' || raw === 'reports') return 'insights';
    // overview, domains, alerts, settings (handled separately), or null/unknown → portfolio
    return 'portfolio';
  };
  const tabParam = searchParams.get('tab');
  const activeTab: TabType = normalizeTab(tabParam);

  // Settings drawer state (in-memory; section can be seeded from URL for backwards-compat)
  const [settingsDrawerOpen, setSettingsDrawerOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState<'preferences' | 'data'>(
    searchParams.get('settings') === 'data' ? 'data' : 'preferences'
  );

  const setActiveTab = useCallback((next: TabType) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === 'portfolio') params.delete('tab'); else params.set('tab', next);
    params.delete('settings');
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [searchParams, pathname, router]);

  // Backwards-compat: old ?tab=settings opens the drawer; old non-canonical ?tab= values get cleaned in URL
  useEffect(() => {
    if (tabParam === 'settings') {
      setSettingsDrawerOpen(true);
      const params = new URLSearchParams(searchParams.toString());
      params.delete('tab');
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      return;
    }
    if (tabParam && !(VALID_TABS as readonly string[]).includes(tabParam)) {
      const normalized = normalizeTab(tabParam);
      const params = new URLSearchParams(searchParams.toString());
      if (normalized === 'portfolio') params.delete('tab'); else params.set('tab', normalized);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabParam]);
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

  // Trend window for the portfolio sparkline (affects sparkline only — totals stay all-time)
  const [trendWindow, setTrendWindow] = useState<'3M' | '6M' | '1Y' | 'All'>('1Y');

  const monthlyRevenueSeries = useMemo(() => {
    let monthCount: number;
    if (trendWindow === '3M') monthCount = 3;
    else if (trendWindow === '6M') monthCount = 6;
    else if (trendWindow === '1Y') monthCount = 12;
    else {
      // All: span from earliest sell month to now (capped at 60 months for sparkline sanity)
      let earliestMs: number | null = null;
      for (const tx of transactionsForMetrics) {
        if (tx.type !== 'sell' || !tx.date) continue;
        const ms = new Date(tx.date).getTime();
        if (!Number.isFinite(ms)) continue;
        if (earliestMs === null || ms < earliestMs) earliestMs = ms;
      }
      if (earliestMs === null) {
        monthCount = 12;
      } else {
        const now = new Date();
        const earliest = new Date(earliestMs);
        const diff = (now.getFullYear() - earliest.getFullYear()) * 12 + (now.getMonth() - earliest.getMonth()) + 1;
        monthCount = Math.max(1, Math.min(60, diff));
      }
    }
    const buckets = new Array(monthCount).fill(0) as number[];
    const now = new Date();
    const startMonth = new Date(now.getFullYear(), now.getMonth() - (monthCount - 1), 1);
    for (const tx of transactionsForMetrics) {
      if (tx.type !== 'sell' || !tx.date) continue;
      const txDate = new Date(tx.date);
      if (Number.isNaN(txDate.getTime())) continue;
      const monthsDiff = (txDate.getFullYear() - startMonth.getFullYear()) * 12 + (txDate.getMonth() - startMonth.getMonth());
      if (monthsDiff >= 0 && monthsDiff < monthCount) {
        buckets[monthsDiff] += Number(tx.base_amount ?? tx.amount ?? 0);
      }
    }
    return buckets;
  }, [transactionsForMetrics, trendWindow]);

  const trendWindowOptions: { key: '3M' | '6M' | '1Y' | 'All'; label: string }[] = [
    { key: '3M', label: '3M' },
    { key: '6M', label: '6M' },
    { key: '1Y', label: '1Y' },
    { key: 'All', label: t('dashboard.allTime') },
  ];

  const trendWindowCaption =
    trendWindow === '3M' ? t('dashboard.last3Months')
    : trendWindow === '6M' ? t('dashboard.last6Months')
    : trendWindow === '1Y' ? t('dashboard.last12Months')
    : t('dashboard.allTime');

  // Headline number for the health card: matches the active window so the big number aligns with the sparkline.
  // For 'All' we use the canonical totalRevenue (not the 60-month-capped series sum).
  const windowedRevenue = useMemo(() => {
    if (trendWindow === 'All') return stats.totalRevenue;
    return monthlyRevenueSeries.reduce((sum, v) => sum + v, 0);
  }, [trendWindow, stats.totalRevenue, monthlyRevenueSeries]);

  // Days until the next non-sold domain expires (negative = already expired but not yet marked)
  const nextExpiryDays = useMemo(() => {
    const candidates = domains
      .filter((d) => d.status !== 'sold' && d.expiry_date)
      .map((d) => Math.ceil((new Date(d.expiry_date!).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
      .sort((a, b) => a - b);
    return candidates.length > 0 ? candidates[0] : null;
  }, [domains]);

  // "Stuck" = active/for_sale, held > 12 months, never sold. Investor signal to consider listing.
  const stuckDomains = useMemo(() => {
    const oneYearMs = 365 * 24 * 60 * 60 * 1000;
    const soldDomainIds = new Set(
      transactionsForMetrics.filter((t) => t.type === 'sell').map((t) => t.domain_id)
    );
    return domains.filter((d) => {
      if (d.status !== 'active' && d.status !== 'for_sale') return false;
      if (!d.purchase_date) return false;
      if (soldDomainIds.has(d.id)) return false;
      const heldMs = Date.now() - new Date(d.purchase_date).getTime();
      return heldMs > oneYearMs;
    });
  }, [domains, transactionsForMetrics]);

  // Expiring within 7 days, with annual renewal cost summed
  const expiringThisWeek = useMemo(() => {
    return expiringDomains.filter((d) => d.daysUntilExpiry >= 0 && d.daysUntilExpiry <= 7);
  }, [expiringDomains]);
  const expiringThisWeekCost = useMemo(() => {
    return expiringThisWeek.reduce((sum, d) => sum + (d.renewal_cost ?? 0), 0);
  }, [expiringThisWeek]);


  // 处理域名保存（保留此函数因为需要特殊处理）- 使用useCallback优化
  const handleSaveDomain = useCallback(async (domainData: Omit<DomainWithTags, 'id'>) => {
    console.log('[dashboard] handleSaveDomain start, editing=', !!domainOps.editingDomain);
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

        console.log('[dashboard] handleSaveDomain awaiting saveData');
        await saveData(updatedDomains, transactions, { domainsOnly: true });
        console.log('[dashboard] handleSaveDomain saveData resolved; clearing form state');
        domainOps.setEditingDomain(undefined);
        domainOps.setShowDomainForm(false);
        domainOps.setShowSmartDomainForm(false);
        console.log('[dashboard] handleSaveDomain done');
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
      console.log('[dashboard] handleSaveDomain caught', err);
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setMutationError(`${t('errors.saveDomainFailed')}: ${msg}`);
      setTimeout(() => setMutationError(null), 5000);
    }
  }, [domainOps, domains, transactions, saveData, t]);

  // Quick inline update for DomainTable (status / estimated_value cells).
  // Spreads the patch onto the domain and persists via the same saveData path as the full editor.
  const handleQuickUpdateDomain = useCallback(async (domain: DomainWithTags, patch: Partial<DomainWithTags>) => {
    try {
      const updatedDomain: DomainWithTags = {
        ...domain,
        ...patch,
        updated_at: new Date().toISOString(),
      };
      const updatedDomains = domains.map((d) => (d.id === domain.id ? updatedDomain : d));
      await saveData(updatedDomains, transactions, { domainsOnly: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setMutationError(`${t('errors.saveDomainFailed')}: ${msg}`);
      setTimeout(() => setMutationError(null), 5000);
    }
  }, [domains, transactions, saveData, t]);

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
                onClick={() => { setSettingsSection('preferences'); setSettingsDrawerOpen(true); }}
                aria-label={t('dashboard.settings')}
                title={t('dashboard.settings')}
                className="text-stone-500 hover:text-stone-800 p-2.5 rounded-xl hover:bg-stone-100 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
              >
                <Settings size={18} />
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
              <button onClick={() => { setSettingsSection('preferences'); setSettingsDrawerOpen(true); }} aria-label={t('dashboard.settings')} className="text-stone-600 p-2.5 rounded-xl hover:bg-stone-100 border border-stone-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2">
                <Settings size={18} />
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

        {/* Tabs — 3-tab structure: Portfolio (was overview/domains/alerts), Activity, Insights */}
        <div className="relative bg-white rounded-2xl border border-stone-200/80 shadow-sm mb-6 overflow-hidden">
          <nav className="flex gap-1 p-1.5 overflow-x-auto bg-stone-50/50 border-b border-stone-100" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('portfolio')}
              className={`rounded-lg px-3.5 py-2 text-sm font-medium whitespace-nowrap flex items-center gap-1.5 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-1 ${
                activeTab === 'portfolio' ? 'bg-stone-900 text-white shadow-sm' : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
              }`}
            >
              <Globe className="h-4 w-4" />
              {t('dashboard.portfolio')}
              {expiringDomains.length > 0 && (
                <span className={`ml-1 rounded-full px-2 py-0.5 text-xs ${
                  activeTab === 'portfolio' ? 'bg-red-400 text-white' : 'bg-red-500 text-white'
                }`}>{expiringDomains.length}</span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('activity')}
              className={`rounded-lg px-3.5 py-2 text-sm font-medium whitespace-nowrap flex items-center gap-1.5 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-1 ${
                activeTab === 'activity' ? 'bg-stone-900 text-white shadow-sm' : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
              }`}
            >
              <FileText className="h-4 w-4" />
              {t('dashboard.activity')}
            </button>
            <button
              onClick={() => setActiveTab('insights')}
              className={`rounded-lg px-3.5 py-2 text-sm font-medium whitespace-nowrap flex items-center gap-1.5 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-1 ${
                activeTab === 'insights' ? 'bg-stone-900 text-white shadow-sm' : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
              }`}
            >
              <PieChart className="h-4 w-4" />
              {t('dashboard.insights')}
            </button>
          </nav>
          {/* Right-edge fade to hint horizontal overflow on narrow screens */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute right-0 top-0 bottom-px w-10 bg-gradient-to-l from-stone-50 via-stone-50/70 to-transparent lg:hidden"
          />
        </div>

        {/* Tab Content */}
        {activeTab === 'portfolio' && (
          <div className="space-y-8">
            <PortfolioHealthCard
              totalDomains={stats.totalDomains}
              activeDomains={stats.activeDomains}
              soldDomains={stats.soldDomains}
              displayRevenue={windowedRevenue}
              allTimeRevenue={stats.totalRevenue}
              roi={stats.roi}
              monthlyRevenueSeries={monthlyRevenueSeries}
              nextExpiryDays={nextExpiryDays}
              formatCurrency={(n) => formatCurrencyEnhanced(n)}
              windowOptions={trendWindowOptions}
              selectedWindow={trendWindow}
              onWindowChange={(k) => setTrendWindow(k as '3M' | '6M' | '1Y' | 'All')}
              labels={{
                portfolioRevenue: t('dashboard.portfolioRevenue'),
                windowCaption: trendWindowCaption,
                allTimeAnchor: t('dashboard.allTimeAnchor'),
                domains: t('dashboard.totalDomains'),
                activeSold: (a, s) => t('dashboard.portfolioCardActiveSold')
                  .replace('{active}', String(a))
                  .replace('{sold}', String(s)),
                roi: t('dashboard.roi'),
                nextExpiry: t('dashboard.portfolioCardNextExpiry'),
                days: 'd',
                none: t('dashboard.portfolioCardNoExpiry'),
                expired: t('dashboard.portfolioCardExpired'),
                trendWindowAria: t('dashboard.trendWindow'),
              }}
            />

            <WeeklyBriefing
              title={t('dashboard.thisWeek')}
              subtitle={t('dashboard.thisWeekHint')}
              cards={[
                expiringThisWeek.length > 0
                  ? {
                      icon: <AlertTriangle className="h-4 w-4" />,
                      iconBg: 'bg-rose-50 text-rose-600',
                      title: t('dashboard.briefingExpiringTitle'),
                      primary: t('dashboard.briefingExpiringPrimary').replace('{count}', String(expiringThisWeek.length)),
                      secondary: expiringThisWeekCost > 0
                        ? t('dashboard.briefingExpiringSecondary').replace('{cost}', formatCurrencyEnhanced(expiringThisWeekCost))
                        : undefined,
                      action: {
                        label: t('common.renew'),
                        onClick: () => expiringThisWeek[0] && domainOps.handleRenewDomain(expiringThisWeek[0]),
                      },
                    }
                  : {
                      icon: <Calendar className="h-4 w-4" />,
                      iconBg: 'bg-stone-100 text-stone-500',
                      title: t('dashboard.briefingExpiringTitle'),
                      primary: t('dashboard.briefingExpiringNone'),
                      secondary: t('dashboard.briefingExpiringNoneHint'),
                      empty: true,
                    },
                recentTransactions[0]
                  ? (() => {
                      const tx = recentTransactions[0];
                      const dom = domains.find((d) => d.id === tx.domain_id);
                      const sign = tx.type === 'sell' ? '+' : '-';
                      const txAmount = tx.base_amount ?? tx.amount ?? 0;
                      return {
                        icon: tx.type === 'sell'
                          ? <TrendingUp className="h-4 w-4" />
                          : tx.type === 'renew'
                            ? <RefreshCw className="h-4 w-4" />
                            : <Plus className="h-4 w-4" />,
                        iconBg: tx.type === 'sell'
                          ? 'bg-emerald-50 text-emerald-600'
                          : tx.type === 'renew'
                            ? 'bg-amber-50 text-amber-600'
                            : 'bg-teal-50 text-teal-600',
                        title: t('dashboard.briefingActivityTitle'),
                        primary: t('dashboard.briefingActivityPrimary')
                          .replace('{type}', t(`transaction.${tx.type}`))
                          .replace('{amount}', sign + formatCurrencyEnhanced(txAmount))
                          .replace('{domain}', dom?.domain_name ?? t('common.unknownDomain')),
                        secondary: formatTransactionDate(tx.date),
                        action: {
                          label: t('dashboard.briefingViewActivity'),
                          onClick: () => setActiveTab('activity'),
                        },
                      };
                    })()
                  : {
                      icon: <FileText className="h-4 w-4" />,
                      iconBg: 'bg-stone-100 text-stone-500',
                      title: t('dashboard.briefingActivityTitle'),
                      primary: t('dashboard.briefingActivityNone'),
                      secondary: t('dashboard.briefingActivityNoneHint'),
                      empty: true,
                    },
                stuckDomains.length > 0
                  ? {
                      icon: <Award className="h-4 w-4" />,
                      iconBg: 'bg-amber-50 text-amber-600',
                      title: t('dashboard.briefingStuckTitle'),
                      primary: t('dashboard.briefingStuckPrimary').replace('{count}', String(stuckDomains.length)),
                      secondary: t('dashboard.briefingStuckSecondary'),
                      action: {
                        label: t('dashboard.briefingReview'),
                        onClick: () => {
                          document.getElementById('dashboard-domain-list-anchor')
                            ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        },
                      },
                    }
                  : {
                      icon: <Award className="h-4 w-4" />,
                      iconBg: 'bg-stone-100 text-stone-500',
                      title: t('dashboard.briefingStuckTitle'),
                      primary: t('dashboard.briefingStuckNone'),
                      empty: true,
                    },
              ] as BriefingCard[]}
            />

            {domains.length === 0 ? (
              <div className="bg-teal-50/80 border border-teal-200/80 rounded-2xl p-6 text-center">
                <p className="text-stone-700 mb-4">{t('domainList.getStarted')}</p>
                <button
                  onClick={domainOps.handleAddDomain}
                  className="rounded-xl bg-teal-600 text-white px-5 py-2.5 text-sm font-medium inline-flex items-center gap-2 hover:bg-teal-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
                >
                  <Plus className="h-4 w-4" />
                  {t('domainList.addFirstDomain')}
                </button>
              </div>
            ) : (
              <div id="dashboard-domain-list-anchor" className="scroll-mt-24">
                <DomainList
                  domains={domains}
                  transactions={transactions}
                  onEdit={domainOps.handleEditDomain}
                  onDelete={setPendingDeleteDomainId}
                  onView={handleViewDomain}
                  onAdd={domainOps.handleAddDomain}
                  onUpdateDomain={handleQuickUpdateDomain}
                />
              </div>
            )}

            {/* Background expiry monitor (sends notifications) */}
            <LazyWrapper>
              <LazyAutoDomainMonitor domains={domains} showNotifications={true} />
            </LazyWrapper>
          </div>
        )}

        {activeTab === 'activity' && (
          <TransactionList
            transactions={transactions}
            metricsTransactions={transactionsForMetrics}
            domains={domains}
            onEdit={transactionOps.handleEditTransaction}
            onDelete={setPendingDeleteTransactionId}
            onAdd={transactionOps.handleAddTransaction}
          />
        )}

        {activeTab === 'insights' && (
          <div className="space-y-6">
            {/* 续费分析 */}
            <div className="bg-white rounded-2xl border border-stone-200/80 p-6 shadow-sm">
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

            <LazyWrapper>
              <LazyInvestmentAnalytics
                domains={domains}
                transactions={transactionsForMetrics}
              />
            </LazyWrapper>

            <LazyWrapper>
              <LazyAdvancedRenewalAnalysis domains={domains} />
            </LazyWrapper>

            <LazyWrapper>
              <LazyExpiredDomainLossAnalysis domains={domains} transactions={transactions} />
            </LazyWrapper>

            <LazyWrapper>
              <LazyFinancialReport
                domains={domains}
                transactions={transactionsForMetrics}
              />
            </LazyWrapper>

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

      {/* Settings Drawer (replaces the old Settings tab) */}
      <SettingsDrawer
        isOpen={settingsDrawerOpen}
        onClose={() => setSettingsDrawerOpen(false)}
        section={settingsSection}
        onSectionChange={setSettingsSection}
        labels={{
          title: t('dashboard.settingsDrawerTitle'),
          preferences: t('dashboard.settings'),
          data: t('dashboard.dataAndBackup'),
          close: t('dashboard.settingsClose'),
        }}
        preferencesNode={
          <LazyWrapper>
            <LazyUserPreferencesPanel />
          </LazyWrapper>
        }
        dataNode={
          <LazyWrapper>
            <LazyDataImportExport
              onImport={async (data: unknown) => {
                try {
                  const importData = data as { domains?: Domain[]; transactions?: TransactionWithRequiredFields[] };
                  let typedDomains = domains;
                  let typedTransactions = transactions;
                  if (importData.domains) typedDomains = importData.domains.map(ensureDomainWithTags);
                  if (importData.transactions) typedTransactions = importData.transactions.map(ensureTransactionWithRequiredFields);
                  await saveData(typedDomains, typedTransactions);
                  auditLogger.log(user?.id || 'default', 'data_imported', 'dashboard', {
                    domainsCount: importData.domains?.length || 0,
                    transactionsCount: importData.transactions?.length || 0,
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
                  const data = { domains, transactions, exportDate: new Date().toISOString(), version: '1.0' };
                  if (format === 'json') {
                    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `domain-financial-backup-${new Date().toISOString().split('T')[0]}.json`;
                    a.click();
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
                  if (restoreData.domains) typedDomains = restoreData.domains.map(ensureDomainWithTags);
                  if (restoreData.transactions) typedTransactions = restoreData.transactions.map(ensureTransactionWithRequiredFields);
                  await saveData(typedDomains, typedTransactions);
                  auditLogger.log(user?.id || 'default', 'data_restored', 'dashboard', {
                    domainsCount: restoreData.domains?.length || 0,
                    transactionsCount: restoreData.transactions?.length || 0,
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
        }
      />

      {/* Domain Edit Drawer — mount only when open so React fully unmounts the portal on close */}
      {domainOps.showDomainForm && (
        <DomainForm
          key={domainOps.editingDomain?.id || 'edit-new'}
          domain={domainOps.editingDomain}
          isOpen={domainOps.showDomainForm}
          onClose={() => {
            console.log('[dashboard] DomainForm.onClose lambda fired; calling setShowDomainForm(false) + setEditingDomain(undefined)');
            domainOps.setShowDomainForm(false);
            domainOps.setEditingDomain(undefined);
            console.log('[dashboard] DomainForm.onClose lambda done');
          }}
          onSave={handleSaveDomain}
        />
      )}

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
        onOpenSettings={() => { setSettingsSection('preferences'); setSettingsDrawerOpen(true); }}
        expiringCount={expiringDomains.length}
      />
    </div>
  );
}
