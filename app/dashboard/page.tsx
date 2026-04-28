'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
import DashboardHeader from '../../src/components/dashboard/DashboardHeader';
import DashboardLoadingSkeleton from '../../src/components/dashboard/DashboardLoadingSkeleton';
import DeleteConfirmDialog from '../../src/components/dashboard/DeleteConfirmDialog';
import { calculateAnnualRenewalCost, formatRenewalCycleDistributionLabel } from '../../src/lib/renewalCalculations';
import { formatCurrency as formatCurrencyEnhanced } from '../../src/lib/financialCalculations';
// 懒加载组件
import {
  LazyFinancialAnalysis,
  LazyInvestmentAnalytics,
  LazyAdvancedRenewalAnalysis,
  LazyExpiredDomainLossAnalysis,
  LazyDataImportExport,
  LazyUserPreferencesPanel,
  LazyWrapper,
  useSmartPreload
} from '../../src/components/LazyComponents';
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
import { calculateBasicFinancialMetrics, sellNetUSD, expandSellToCashReceipts } from '../../src/lib/coreCalculations';
import { calculatePaidAmountFromInstallment } from '../../src/lib/platformFeeCalculator';
import { totalHoldingCostForDomain } from '../../src/lib/renewalCostBasis';
import {
  Globe,
  Plus,
  TrendingUp,
  FileText,
  AlertTriangle,
  Calendar,
  Award,
  PieChart,
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
      .filter(transaction => transaction.amount != null)
      .map(transaction => {
        const fullAmount = transaction.amount ?? 0;
        const initialFee = Number(transaction.platform_fee) || 0;
        let amountUSD = fullAmount;
        let platformFee: number | undefined = transaction.platform_fee ?? undefined;
        // net_amount fallback 必须减掉平台费 —— 旧 fallback 直接用 fullAmount，
        // 当 DB 里 net_amount 为 null（旧数据 / 导入数据 / 没经过当前表单
        // handleSubmit 回写的记录）时，sellNetUSD 看到非 null 的 gross 就直接
        // 返回，整个出售对所有 KPI / Monthly Cash Flow 都按毛额计算，平台费
        // 静默丢失。fallback 用 gross - fee 才是 net 的本意。
        let netAmount: number | undefined = transaction.net_amount ?? (fullAmount - initialFee);
        // 仅真实「分期」出售才按已收款比例折算；lump_sum 时表单仍带 installment_amount=0 等字段，若误判会导致销售额/收入在指标里恒为 0
        const isInstallmentSell =
          transaction.type === 'sell' && transaction.payment_plan === 'installment';
        const hasInstallmentData =
          isInstallmentSell &&
          (transaction.installment_amount != null ||
            transaction.downpayment_amount != null ||
            (transaction.paid_periods != null && transaction.installment_period != null));
        // 带"平台规则"的分期类型：费率由平台决定（Spaceship 5% / Atom 阶梯
        // surcharge / Afternic 阶梯佣金 / Escrow 加项费），表单的"平台费用计算"
        // 黄框只是展示，不会自动写入 transaction.platform_fee。所以 stored 值
        // 通常是 0 或老数据残留。直接调 platformFeeCalculator 实时算，覆盖
        // stored 值，所有指标都拿到正确净额。
        // 'standard' 与未知类型仍走老的"按已收比例缩 stored fee"路径，让用户
        // 对 standard 类型的 platform_fee 字段保持手动控制权。
        const brandedInstallmentTypes = new Set([
          'spaceship_installment',
          'atom_installment',
          'afternic_installment',
          'escrow_installment',
        ]);
        const isBrandedInstallment =
          isInstallmentSell &&
          hasInstallmentData &&
          typeof transaction.platform_fee_type === 'string' &&
          brandedInstallmentTypes.has(transaction.platform_fee_type);
        const isInstallmentPartialOrCancelled =
          isInstallmentSell &&
          hasInstallmentData &&
          (transaction.installment_status === 'cancelled' ||
            ((transaction.paid_periods ?? 0) < (transaction.installment_period ?? 1)));
        if (isBrandedInstallment) {
          const down = transaction.downpayment_amount ?? 0;
          const perPeriod = transaction.installment_amount ?? 0;
          const totalPeriods = transaction.installment_period ?? 0;
          // 对 status='completed' 的数据保险：哪怕 paid_periods 没被同步到 ==
          // installment_period，也按全付计算，避免显示成部分付。
          const effectivePaidPeriods =
            transaction.installment_status === 'completed'
              ? totalPeriods
              : Math.min(totalPeriods, transaction.paid_periods ?? 0);
          const customRate =
            transaction.platform_fee_percentage != null && transaction.platform_fee_percentage > 0
              ? transaction.platform_fee_percentage / 100
              : undefined;
          const result = calculatePaidAmountFromInstallment(
            perPeriod,
            effectivePaidPeriods,
            totalPeriods,
            transaction.platform_fee_type as string,
            customRate,
            transaction.escrow_transaction_fee ?? undefined,
            undefined,
            transaction.user_input_fee_rate ?? undefined,
            transaction.user_input_surcharge_rate ?? undefined,
            {
              downpaymentAmount: down,
              finalPaymentAmount: transaction.final_payment_amount ?? 0,
              afternicNsPointed: transaction.afternic_ns_pointed ?? undefined,
              afternicPremiumAddon: transaction.afternic_premium_addon ?? undefined,
              grossAmount: transaction.amount,
              atomCommissionTier: transaction.atom_commission_tier ?? undefined,
              atomNoCoin: transaction.atom_no_coin ?? undefined,
              atomCustomCommissionRate: transaction.atom_custom_commission_rate ?? undefined,
              escrowLeaseType: transaction.escrow_lease_type ?? undefined,
            }
          );
          amountUSD = result.customerTotalAmount;
          platformFee = result.platformFee;
          netAmount = result.sellerNetAmount;
        } else if (isInstallmentPartialOrCancelled) {
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

  // Restored from the pre-breakage working version: a ref holds the latest close
  // function, and a document-level capture listener routes clicks on any
  // [data-close-domain-form] element to that close. This was proven to work
  // and was inadvertently removed during debugging.
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
  // 注意：calculateAnnualRenewalCost 内部在缺 expiry_date 时会跳过该域名
  // （见 src/lib/renewalCalculations.ts L49-50），所以上层 filter 也要
  // 同步过滤，否则会出现"filter 通过但计算时被默默丢弃"的数据不一致。
  const renewalAnalysis = useMemo(() => {
    const validDomains = domains
      .filter(domain =>
        domain.status === 'active' &&
        domain.renewal_cost !== null &&
        domain.purchase_date !== null &&
        domain.expiry_date !== null
      )
      .map(domain => ({
        id: domain.id,
        domain_name: domain.domain_name,
        renewal_cost: domain.renewal_cost!,
        renewal_cycle: domain.renewal_cycle,
        renewal_count: domain.renewal_count,
        purchase_date: domain.purchase_date!,
        expiry_date: domain.expiry_date!,
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

  // Sparkline 同时返回 labels（"YYYY-MM 简写"）让 PortfolioHealthCard 在 hover
  // 时能展示对应月份；旧实现只返回 number[]，hover tooltip 没法说出"哪个月"。
  const monthlyRevenue = useMemo(() => {
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
    // 走 expandSellToCashReceipts：分期销售按已付期数摊到对应到账月，每条
    // 事件用 sellNetUSD 口径（已扣平台费，与 IA Monthly Cash Flow 一致）。
    // 旧实现按 tx.date 把整笔 sell 加到销售月，且用毛额，让分期收入"全部 spike
    // 在销售月 + 中间月份全 0 + 数额含平台费"三连错。
    for (const tx of transactionsForMetrics) {
      if (tx.type !== 'sell') continue;
      for (const receipt of expandSellToCashReceipts(tx)) {
        const [yearStr, monthStr] = receipt.monthKey.split('-');
        const year = Number(yearStr);
        const month = Number(monthStr); // 1-based
        if (!Number.isFinite(year) || !Number.isFinite(month)) continue;
        const monthsDiff = (year - startMonth.getFullYear()) * 12 + ((month - 1) - startMonth.getMonth());
        if (monthsDiff >= 0 && monthsDiff < monthCount) {
          buckets[monthsDiff] += receipt.netAmount;
        }
      }
    }
    const monthFormatter = new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en-US', {
      year: 'numeric',
      month: 'short',
    });
    const labels = buckets.map((_, i) => {
      const d = new Date(startMonth);
      d.setMonth(d.getMonth() + i);
      return monthFormatter.format(d);
    });
    return { series: buckets, labels };
  }, [transactionsForMetrics, trendWindow, locale]);

  const monthlyRevenueSeries = monthlyRevenue.series;
  const monthlyRevenueLabels = monthlyRevenue.labels;

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
  // 同时返回域名名 / 到期日 / 剩余天数，让 PortfolioHealthCard 的"Next Expiry"
  // 不再只是一个孤零零的天数（用户根本不知道是哪个域名）。
  const nextExpiry = useMemo(() => {
    const candidates = domains
      .filter((d) => d.status !== 'sold' && d.expiry_date)
      .map((d) => ({
        domainName: d.domain_name,
        expiryDate: d.expiry_date!,
        days: Math.ceil((new Date(d.expiry_date!).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
      }))
      .sort((a, b) => a.days - b.days);
    return candidates.length > 0 ? candidates[0] : null;
  }, [domains]);
  const nextExpiryDays = nextExpiry?.days ?? null;
  const nextExpiryDomain = nextExpiry?.domainName ?? null;
  const nextExpiryDateLabel = nextExpiry
    ? new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en-US', { month: 'short', day: 'numeric' }).format(
        new Date(nextExpiry.expiryDate)
      )
    : null;

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
    return <DashboardLoadingSkeleton />;
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
      <DashboardHeader
        labels={{
          chinese: t('settings.chinese'),
          english: t('settings.english'),
          selectLanguage: t('settings.selectLanguage'),
          addInvestment: t('dashboard.addInvestment'),
          addTransaction: t('transaction.add'),
          shareResults: t('dashboard.shareResults'),
          settings: t('dashboard.settings'),
          signOut: t('dashboard.signOut'),
          more: t('common.more'),
        }}
        email={user?.email}
        locale={locale}
        onSetLocale={setLocale}
        onAddDomain={domainOps.handleAddDomain}
        onAddTransaction={transactionOps.handleAddTransaction}
        onShare={() => setShowShareModal(true)}
        onOpenSettings={() => { setSettingsSection('preferences'); setSettingsDrawerOpen(true); }}
        onSignOut={async () => { await signOut(); router.push('/'); }}
      />

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
              monthlyRevenueLabels={monthlyRevenueLabels}
              nextExpiryDays={nextExpiryDays}
              nextExpiryDomain={nextExpiryDomain}
              nextExpiryDateLabel={nextExpiryDateLabel}
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
                allTimeFooter: t('dashboard.portfolioCardAllTimeFooter'),
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
                      const txAmount = tx.amount ?? 0;
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
            {/* 顺序按"概览 → 细节 → 主题分组"排列：
                1) Financial Analysis：综合摘要（4 KPI + Snapshot + 推荐），用户进
                   Insights 第一眼看整体健康。
                2) Investment Analytics：放大镜，看图表/分布/趋势。
                3) Renewal Overview（light）+ 4) Advanced Renewal Analysis（deep）：
                   续费两块相邻，让用户一眼从 light counts 钻到 annual forecast。
                5) Expired Domain Loss Analysis：失败案例放最末。
                旧顺序把 light renewal 放最顶 + 把两个 renewal 块用 IA 隔开，违反
                "概览→细节"和"主题相邻"两条原则，故调整。 */}
            <LazyWrapper>
              <LazyFinancialAnalysis
                domains={domains}
                transactions={transactionsForMetrics}
              />
            </LazyWrapper>

            <LazyWrapper>
              <LazyInvestmentAnalytics
                domains={domains}
                transactions={transactionsForMetrics}
              />
            </LazyWrapper>

            {/* 续费分析 —— 即时轻 KPI：本块专注静态计数（需/不需续费）+
                按周期分布。"今年预估成本"/"平均每域名成本"已拿掉，
                前者与下方 Advanced Renewal Analysis 的线性回归预估值
                口径不同会冲突，后者的 label 和实际公式（分母只算需续费域名）
                不吻合，容易误导。 */}
            <div className="bg-white rounded-2xl border border-stone-200/80 p-6 shadow-sm">
              <h3 className="text-base font-semibold text-stone-900 mb-4">{t('renewal.analysis')}</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl bg-stone-50 p-4 border border-stone-100">
                  <p className="text-xs font-medium text-stone-500">{t('renewal.needRenewal')}</p>
                  <p className="text-xl font-bold text-teal-700 mt-1">{renewalAnalysis.domainsNeedingRenewal.length}</p>
                </div>
                <div className="rounded-xl bg-stone-50 p-4 border border-stone-100">
                  <p className="text-xs font-medium text-stone-500">{t('renewal.noRenewal')}</p>
                  <p className="text-xl font-bold text-stone-900 mt-1">{renewalAnalysis.domainsNotNeedingRenewal.length}</p>
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
              <LazyAdvancedRenewalAnalysis domains={domains} transactions={transactionsForMetrics} />
            </LazyWrapper>

            <LazyWrapper>
              {/* 对齐项目数据源约定（见第 172 行注释）：所有指标/图表都用 transactionsForMetrics */}
              <LazyExpiredDomainLossAnalysis domains={domains} transactions={transactionsForMetrics} />
            </LazyWrapper>
          </div>
        )}


        </div>

      <DeleteConfirmDialog
        open={!!pendingDeleteDomainId}
        title={t('common.confirmDelete')}
        description={(
          <>
            {t('common.confirmDeleteDomain')}{' '}
            <span className="font-medium text-stone-900">
              {domains.find(d => d.id === pendingDeleteDomainId)?.domain_name ?? ''}
            </span>？
          </>
        )}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        titleId="confirm-delete-title"
        descriptionId="confirm-delete-desc"
        cancelRef={deleteCancelRef}
        confirmRef={deleteConfirmRef}
        onCancel={() => setPendingDeleteDomainId(null)}
        onConfirm={async () => {
          const id = pendingDeleteDomainId;
          if (!id) return;
          await domainOps.handleDeleteDomain(id);
          setPendingDeleteDomainId(null);
        }}
      />

      <DeleteConfirmDialog
        open={!!pendingDeleteTransactionId}
        title={t('common.confirmDelete')}
        description={t('common.confirmDeleteTransaction')}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        titleId="confirm-delete-tx-title"
        descriptionId="confirm-delete-tx-desc"
        cancelRef={txDeleteCancelRef}
        confirmRef={txDeleteConfirmRef}
        onCancel={() => setPendingDeleteTransactionId(null)}
        onConfirm={async () => {
          const id = pendingDeleteTransactionId;
          if (!id) return;
          await transactionOps.handleDeleteTransaction(id);
          setPendingDeleteTransactionId(null);
        }}
      />


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
                  logger.log(t('common.dataImportedSuccessfully'));
                } catch (error) {
                  logger.error('Import failed:', error);
                  setError(t('common.dataImportFailed'));
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
                  logger.log(t('common.dataExportedSuccessfully'));
                } catch (error) {
                  logger.error('Export failed:', error);
                  setError(t('common.dataExportFailed'));
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
                  logger.log(t('common.dataRestoredSuccessfully'));
                } catch (error) {
                  logger.error('Restore failed:', error);
                  setError(t('common.dataRestoreFailed'));
                }
              }}
            />
          </LazyWrapper>
        }
      />

      {/* Domain Edit Drawer — no key prop (avoids spurious remounts); DomainForm's useEffect
          already resets formData when domainId changes */}
      <DomainForm
        domain={domainOps.editingDomain}
        isOpen={domainOps.showDomainForm}
        onClose={() => {
          domainOps.setShowDomainForm(false);
          domainOps.setEditingDomain(undefined);
        }}
        onSave={handleSaveDomain}
        closeRef={domainFormCloseRef}
        existingDomains={domains}
      />

      {/* Smart Domain Form Modal */}
      <SmartDomainForm
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
        existingTransactions={transactions}
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
