'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useSupabaseAuth } from '../../src/contexts/SupabaseAuthContext';
import { useI18nContext } from '../../src/contexts/I18nProvider';
import { logger } from '../../src/lib/logger';
import { fireSensitiveOpNotification } from '../../src/lib/securityNotify';
import DomainList from '../../src/components/domain/DomainList';
import DomainForm from '../../src/components/domain/DomainForm';
import TransactionList from '../../src/components/transaction/TransactionList';
import TransactionForm from '../../src/components/transaction/TransactionForm';
import AddReceiptModal from '../../src/components/transaction/AddReceiptModal';
import MobileNavigation from '../../src/components/layout/MobileNavigation';
import ShareModal from '../../src/components/share/ShareModal';
import SaleSuccessModal from '../../src/components/share/SaleSuccessModal';
import RenewalModal from '../../src/components/domain/RenewalModal';
import PortfolioHealthCard from '../../src/components/dashboard/PortfolioHealthCard';
import WeeklyBriefing from '../../src/components/dashboard/WeeklyBriefing';
import SettingsDrawer from '../../src/components/dashboard/SettingsDrawer';
import RecentActivityPanel from '../../src/components/settings/RecentActivityPanel';
import DashboardHeader from '../../src/components/dashboard/DashboardHeader';
import DashboardLoadingSkeleton from '../../src/components/dashboard/DashboardLoadingSkeleton';
import DeleteConfirmDialog from '../../src/components/dashboard/DeleteConfirmDialog';
import DashboardTabsNav from '../../src/components/dashboard/DashboardTabsNav';
import InsightsTab from '../../src/components/dashboard/InsightsTab';
import IcalSubscriptionCard from '../../src/components/dashboard/IcalSubscriptionCard';
import { buildWeeklyBriefingCards } from '../../src/components/dashboard/buildWeeklyBriefingCards';
import { formatCurrency as formatCurrencyEnhanced } from '../../src/lib/financialCalculations';
// 懒加载组件
import {
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
import { getEffectiveExpiry } from '../../src/lib/effectiveExpiry';
import { expandRenewalEvents } from '../../src/lib/expandRenewalEvents';
import { totalRealizedPnL, realizedPnLByMonth, portfolioAtCost } from '../../src/lib/realizedPnL';
import { mergeCsvImportWithExisting } from '../../src/lib/csvFormats/mergeWithExisting';
import {
  Plus,
  AlertTriangle,
  X,
  Globe,
  Sparkles,
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
  const tabFromUrl: TabType = normalizeTab(tabParam);

  // activeTab 走 React state（点击秒响应），URL sync 在后台 fire-and-forget。
  // 之前 activeTab 直接派生自 searchParams，每次点 tab 都要等 router.replace
  // 触发的全页 re-render 完成才更新——切换感觉慢的根因。
  //
  // visited Set 记录已访问过的 tab：第一次切换时会挂载新 tab 内容（仍有挂载
  // 成本），后续切换走 hidden 属性 CSS 切换，瞬秒。这样 IA / FAO 这种重型
  // 计算只跑一次，timeframe 选择等组件状态也跨切换保留。
  const [activeTab, setActiveTabState] = useState<TabType>(tabFromUrl);
  const [visited, setVisited] = useState<Set<TabType>>(() => new Set([tabFromUrl]));

  // 浏览器前进/后退或外部链接 → URL 改了，把 state 同步过去。
  useEffect(() => {
    if (tabFromUrl !== activeTab) {
      setActiveTabState(tabFromUrl);
      setVisited((prev) => (prev.has(tabFromUrl) ? prev : new Set([...prev, tabFromUrl])));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabFromUrl]);

  // Settings drawer state (in-memory; section can be seeded from URL for backwards-compat)
  const [settingsDrawerOpen, setSettingsDrawerOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState<'preferences' | 'data' | 'security'>(
    searchParams.get('settings') === 'data'
      ? 'data'
      : searchParams.get('settings') === 'security'
        ? 'security'
        : 'preferences'
  );
  const setActiveTab = useCallback((next: TabType) => {
    // 同步更新 state（即时 UI 响应）+ visited（已挂载 tab 不再重挂）
    setActiveTabState(next);
    setVisited((prev) => (prev.has(next) ? prev : new Set([...prev, next])));
    // URL sync — fire-and-forget，浏览器 back/forward 通过上面的 effect 拉回 state
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
  const [addReceiptTarget, setAddReceiptTarget] = useState<TransactionWithRequiredFields | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  
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
            ((transaction.receipts?.length ?? 0) > 0 && transaction.installment_period != null));
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
        const paidPeriodsFromReceipts = transaction.receipts?.length ?? 0;
        const isInstallmentPartialOrCancelled =
          isInstallmentSell &&
          hasInstallmentData &&
          (transaction.installment_status === 'cancelled' ||
            (paidPeriodsFromReceipts < (transaction.installment_period ?? 1)));
        if (isBrandedInstallment) {
          const down = transaction.downpayment_amount ?? 0;
          const perPeriod = transaction.installment_amount ?? 0;
          const totalPeriods = transaction.installment_period ?? 0;
          // 对 status='completed' 的数据保险：哪怕 receipts 还没补齐到 ==
          // installment_period，也按全付计算，避免显示成部分付。
          const effectivePaidPeriods =
            transaction.installment_status === 'completed'
              ? totalPeriods
              : Math.min(totalPeriods, paidPeriodsFromReceipts);
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
          const receiptsTotal = (transaction.receipts ?? []).reduce(
            (s, r) => s + (Number(r.amount) || 0),
            0
          );
          const actualReceived = down + receiptsTotal;
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

  // 即将到期 + 刚过期（7 天内）：30 天内到期或已过期 7 天内，便于续费/标记已售。
  // 用 getEffectiveExpiry 兜底链：没填 expiry_date 也用 next_renewal_date 或者
  // purchase + (renewal_count+1)×cycle 推算，否则数据没填全的用户会被静默忽略。
  const EXPIRING_WINDOW_DAYS = 30;
  const RECENTLY_EXPIRED_DAYS = 7;
  const expiringDomains = useMemo(() => {
    const now = Date.now();
    return domains.flatMap(domain => {
      if (domain.status === 'sold') return [];
      const eff = getEffectiveExpiry(domain);
      if (!eff.date) return [];
      const daysUntilExpiry = Math.ceil((eff.date.getTime() - now) / (1000 * 60 * 60 * 24));
      if (daysUntilExpiry > EXPIRING_WINDOW_DAYS) return [];
      if (daysUntilExpiry < -RECENTLY_EXPIRED_DAYS) return [];
      const urgency = daysUntilExpiry < 0
        ? 'expired'
        : daysUntilExpiry <= 7
          ? 'critical'
          : daysUntilExpiry <= 14
            ? 'urgent'
            : 'normal';
      return [{ ...domain, daysUntilExpiry, urgency, expirySource: eff.source }];
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

  // Realized P&L 按月聚合的增量（用于 sparkline）。直接复用 lib，与 IA 黄线同源。
  const realizedPnLMap = useMemo(
    () => realizedPnLByMonth(domains, transactionsForMetrics),
    [domains, transactionsForMetrics]
  );

  // Sparkline 用 windowed monthly realized P&L（与 monthlyRevenue 同窗口对齐）。
  const realizedPnLSeries = useMemo(() => {
    const monthCount = monthlyRevenueSeries.length;
    if (monthCount === 0) return [] as number[];
    const buckets = new Array(monthCount).fill(0) as number[];
    const now = new Date();
    const startMonth = new Date(now.getFullYear(), now.getMonth() - (monthCount - 1), 1);
    for (const [monthKey, amount] of realizedPnLMap.entries()) {
      const [yearStr, monthStr] = monthKey.split('-');
      const year = Number(yearStr);
      const month = Number(monthStr);
      if (!Number.isFinite(year) || !Number.isFinite(month)) continue;
      const idx = (year - startMonth.getFullYear()) * 12 + ((month - 1) - startMonth.getMonth());
      if (idx >= 0 && idx < monthCount) buckets[idx] += amount;
    }
    return buckets;
  }, [realizedPnLMap, monthlyRevenueSeries.length]);

  // Hero 主指标 1：累计 Realized P&L（all-time）+ 当前窗口内的增量
  const allTimeRealizedPnL = useMemo(
    () => totalRealizedPnL(domains, transactionsForMetrics),
    [domains, transactionsForMetrics]
  );
  const windowedRealizedPnL = useMemo(() => {
    if (trendWindow === 'All') return allTimeRealizedPnL;
    return realizedPnLSeries.reduce((sum, v) => sum + v, 0);
  }, [trendWindow, allTimeRealizedPnL, realizedPnLSeries]);

  // Hero 主指标 2：Portfolio at Cost（当前持有库存按成本）
  const portfolioCost = useMemo(
    () => portfolioAtCost(domains, transactionsForMetrics),
    [domains, transactionsForMetrics]
  );

  // 持仓构成（active / for_sale / sold / expired），用于 hero donut
  const composition = useMemo(() => {
    let active = 0, forSale = 0, sold = 0, expired = 0;
    for (const d of domains) {
      if (d.status === 'active') active++;
      else if (d.status === 'for_sale') forSale++;
      else if (d.status === 'sold') sold++;
      else if (d.status === 'expired') expired++;
    }
    return { active, forSale, sold, expired };
  }, [domains]);

  // 本年续费支出 — 三个口径：
  //   cash:       本年实际发生的续费现金流（archive 摊在估算月 + tx 按日期；
  //               不含 projected——预测的还没真付）
  //   amortized:  把每笔续费按其覆盖年数摊开，currentYear 落在覆盖期内就得一份
  //   amortizedWithForecast: amortized + 预测的还没发生但本年内会发生的续费
  //
  // 全部跑过 expandRenewalEvents 而不是只读 transactions：旧版只看显式 renew
  // 交易，对那些 renewal_count 填了但没记 tx 的存量域名（导入老数据 / 一次性
  // 录入的常见情形）会把 archive 续费完全漏掉。
  const currentYear = new Date().getFullYear();
  const ytdRenewalSpend = useMemo(() => {
    const yearStart = new Date(currentYear, 0, 1).getTime();
    const yearEnd = new Date(currentYear + 1, 0, 1).getTime();
    const forecastUntil = new Date(currentYear, 11, 31, 23, 59, 59, 999);
    let cash = 0;
    let amortized = 0;
    for (const d of domains) {
      for (const ev of expandRenewalEvents(d, transactionsForMetrics, { forecastUntil })) {
        const evTime = ev.date.getTime();
        if (Number.isNaN(evTime)) continue;
        // Cash basis: real money in current year. Skip projected (didn't happen yet).
        if (ev.source !== 'projected' && evTime >= yearStart && evTime < yearEnd) {
          cash += ev.amount;
        }
        // Amortized: spread amount across coverage years (currentYear ∈ [evYear, evYear + years − 1]).
        // Includes projected so users see the full annual cost picture.
        const evYear = ev.date.getFullYear();
        const years = Math.max(1, ev.years);
        if (currentYear >= evYear && currentYear < evYear + years) {
          amortized += ev.amount / years;
        }
      }
    }
    return { cash, amortized };
  }, [domains, transactionsForMetrics, currentYear]);

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

        <DashboardTabsNav
          active={activeTab}
          onChange={setActiveTab}
          expiringCount={expiringDomains.length}
          labels={{
            portfolio: t('dashboard.portfolio'),
            activity: t('dashboard.activity'),
            insights: t('dashboard.insights'),
            expiringBadgeTitle: t('dashboard.portfolioBadgeTitle'),
          }}
        />

        {/* Tab Content — visited tabs stay mounted (hidden when inactive) so
            switching back is instant CSS toggle instead of full remount.
            First visit per tab still pays the mount cost. */}
        {visited.has('portfolio') && (
          <div className="space-y-8" hidden={activeTab !== 'portfolio'}>
            <PortfolioHealthCard
              totalDomains={stats.totalDomains}
              activeDomains={stats.activeDomains}
              soldDomains={stats.soldDomains}
              realizedPnLAllTime={allTimeRealizedPnL}
              realizedPnLInWindow={windowedRealizedPnL}
              realizedPnLSeries={realizedPnLSeries}
              realizedPnLLabels={monthlyRevenueLabels}
              completedSalesCount={transactionsForMetrics.filter((t) => t.type === 'sell').length}
              portfolioAtCost={portfolioCost}
              roi={stats.roi}
              composition={composition}
              ytdRenewalSpendAmortized={ytdRenewalSpend.amortized}
              ytdRenewalSpendCash={ytdRenewalSpend.cash}
              currentYear={currentYear}
              formatCurrency={(n) => formatCurrencyEnhanced(n)}
              windowOptions={trendWindowOptions}
              selectedWindow={trendWindow}
              onWindowChange={(k) => setTrendWindow(k as '3M' | '6M' | '1Y' | 'All')}
              labels={{
                realizedPnL: t('dashboard.heroRealizedPnL'),
                portfolioAtCost: t('dashboard.heroPortfolioAtCost'),
                fromSales: t('dashboard.heroFromSales'),
                fromOneSale: t('dashboard.heroFromOneSale'),
                noSales: t('dashboard.heroNoSales'),
                heldListed: (a, fs) => t('dashboard.heroHeldListed')
                  .replace('{active}', String(a))
                  .replace('{forSale}', String(fs)),
                lifecycle: (s, e) => t('dashboard.heroLifecycle')
                  .replace('{sold}', String(s))
                  .replace('{expired}', String(e)),
                allTime: (amount) => t('dashboard.heroAllTime').replace('{amount}', amount),
                windowDelta: (signedAmount) => {
                  const sign = signedAmount.startsWith('+') ? '+' : signedAmount.startsWith('−') ? '−' : '';
                  const amount = sign ? signedAmount.slice(1) : signedAmount;
                  return t('dashboard.heroWindowDelta')
                    .replace('{sign}', sign)
                    .replace('{amount}', amount);
                },
                windowCaption: trendWindowCaption,
                domains: t('dashboard.totalDomains'),
                activeSold: (a, s) => t('dashboard.portfolioCardActiveSold')
                  .replace('{active}', String(a))
                  .replace('{sold}', String(s)),
                roi: t('dashboard.roi'),
                ytdRenewalSpend: t('dashboard.portfolioCardYtdRenewalSpend'),
                ytdRenewalCashPaid: t('dashboard.portfolioCardYtdRenewalCashPaid'),
                trendWindowAria: t('dashboard.trendWindow'),
                allTimeFooter: t('dashboard.portfolioCardFooterCaption'),
              }}
            />

            <WeeklyBriefing
              title={t('dashboard.thisWeek')}
              subtitle={t('dashboard.thisWeekHint')}
              cards={buildWeeklyBriefingCards({
                expiringThisWeek,
                expiringThisWeekCost,
                recentTransactions,
                stuckDomains,
                domains,
                t,
                formatCurrency: formatCurrencyEnhanced,
                formatTransactionDate,
                onRenew: domainOps.handleRenewDomain,
                onViewActivity: () => setActiveTab('activity'),
                domainListAnchorId: 'dashboard-domain-list-anchor',
              })}
            />

            {domains.length === 0 ? (
              <div className="relative overflow-hidden rounded-3xl border border-stone-200/60 bg-gradient-to-br from-teal-50/60 via-white to-amber-50/40 shadow-sm">
                <div className="pointer-events-none absolute -top-20 -right-20 h-56 w-56 rounded-full bg-gradient-to-br from-teal-200/40 to-transparent blur-3xl" />
                <div className="pointer-events-none absolute -bottom-24 -left-24 h-48 w-48 rounded-full bg-gradient-to-tr from-amber-100/30 to-transparent blur-3xl" />
                <div className="relative px-6 py-12 sm:px-10 sm:py-16 text-center">
                  <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-600 text-white shadow-md shadow-teal-600/30">
                    <Globe className="h-8 w-8" />
                  </div>
                  <h2 className="mt-6 text-2xl sm:text-3xl font-bold tracking-tight text-stone-900">
                    {t('domainList.noDomainsYet')}
                  </h2>
                  <p className="mt-2 text-base text-stone-600 max-w-md mx-auto">
                    {t('domainList.getStarted')}
                  </p>
                  <button
                    onClick={domainOps.handleAddDomain}
                    className="mt-8 inline-flex items-center gap-2 rounded-xl bg-teal-600 px-6 py-3 text-sm font-semibold text-white shadow-md shadow-teal-600/30 transition hover:bg-teal-700 hover:shadow-lg hover:shadow-teal-600/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
                  >
                    <Sparkles className="h-4 w-4" />
                    {t('domainList.addFirstDomain')}
                  </button>
                </div>
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

        {visited.has('activity') && (
          <div hidden={activeTab !== 'activity'}>
            <TransactionList
              transactions={transactions}
              metricsTransactions={transactionsForMetrics}
              domains={domains}
              onEdit={transactionOps.handleEditTransaction}
              onDelete={setPendingDeleteTransactionId}
              onAdd={transactionOps.handleAddTransaction}
              onAddReceipt={setAddReceiptTarget}
            />
          </div>
        )}

        {visited.has('insights') && (
          <div hidden={activeTab !== 'insights'}>
            <InsightsTab
              domains={domains}
              transactionsForMetrics={transactionsForMetrics}
              t={t}
              formatCurrency={formatCurrencyEnhanced}
            />
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
        onCancel={() => setPendingDeleteTransactionId(null)}
        onConfirm={async () => {
          const id = pendingDeleteTransactionId;
          if (!id) return;
          await transactionOps.handleDeleteTransaction(id);
          setPendingDeleteTransactionId(null);
        }}
      />

      <AddReceiptModal
        isOpen={!!addReceiptTarget}
        onClose={() => setAddReceiptTarget(null)}
        transaction={addReceiptTarget}
        domainName={
          addReceiptTarget
            ? domains.find((d) => d.id === addReceiptTarget.domain_id)?.domain_name
            : undefined
        }
        userId={user?.id ?? ''}
        onAdded={async () => {
          await refreshData();
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
          security: t('dashboard.security'),
          close: t('dashboard.settingsClose'),
        }}
        preferencesNode={
          <div className="space-y-5">
            <IcalSubscriptionCard />
            <LazyWrapper>
              <LazyUserPreferencesPanel />
            </LazyWrapper>
          </div>
        }
        dataNode={
          <LazyWrapper>
            <LazyDataImportExport
              existingDomainNames={domains.map((d) => d.domain_name)}
              onImport={async (data: unknown) => {
                try {
                  const importData = data as {
                    domains?: Array<Partial<Domain> & { domain_name: string }>;
                    transactions?: TransactionWithRequiredFields[];
                  };
                  let typedDomains = domains;
                  let typedTransactions = transactions;
                  if (importData.domains && importData.domains.length > 0) {
                    // 两条路径：
                    //   1) JSON 备份：每行带 id（自家导出格式），直接 ensureDomainWithTags
                    //      然后整体替换——saveData 会按 id 增量 diff，行为跟以前一致。
                    //   2) CSV 智能导入：每行不带 id（来自 MappedDomain），按 name
                    //      合并到现有 domains 上，user 已填字段保留、空字段被 CSV 填补，
                    //      新名字生成新 id。
                    const hasAnyId = importData.domains.some(
                      (d) => typeof (d as { id?: string }).id === 'string' && (d as { id?: string }).id
                    );
                    if (hasAnyId) {
                      typedDomains = (importData.domains as Domain[]).map(ensureDomainWithTags);
                    } else {
                      const merged = mergeCsvImportWithExisting(domains, importData.domains);
                      typedDomains = merged.mergedDomains;
                    }
                  }
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
                  // Fire-and-forget audit record: data export is treated
                  // as a sensitive operation, so it shows up in the
                  // Settings → Security panel — that way an attacker
                  // exfiltrating data leaves a trail the legitimate user
                  // can spot when they check.
                  fireSensitiveOpNotification(session, 'data_export');
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
        securityNode={
          <RecentActivityPanel accessToken={session?.access_token ?? null} />
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
