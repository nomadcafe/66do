'use client';

import { useMemo, memo, useCallback, useEffect } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { Search, Filter, Plus, Edit, Trash2, Calendar, FileText, LayoutList, GitBranch, ArrowUp, ArrowDown, TrendingUp, TrendingDown, Scale, Hash, Coins, Receipt, Award, DollarSign, PlusCircle } from 'lucide-react';
import { sellGrossUSD, sellNetUSD } from '../../lib/coreCalculations';
import { calculateDomainROI, formatPercentage } from '../../lib/enhancedFinancialMetrics';
import { useI18nContext } from '../../contexts/I18nProvider';
import { DomainWithTags, TransactionWithRequiredFields } from '../../types/dashboard';
import DomainTimelineView from './DomainTimelineView';
import { ListPagination } from '../ui/ListPagination';
import { useDebouncedUrlParam } from '../../hooks/useDebouncedUrlParam';

interface TransactionListProps {
  transactions: TransactionWithRequiredFields[];
  /**
   * Optional installment-adjusted view of transactions for KPI summing
   * (sells with partial / cancelled installments are scaled to actual cash received,
   * platform fees scaled proportionally). Same shape and ids as `transactions`;
   * if omitted, the KPI strip falls back to raw values.
   */
  metricsTransactions?: TransactionWithRequiredFields[];
  domains: DomainWithTags[];
  onEdit: (transaction: TransactionWithRequiredFields) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
  /** 在分期-active 的 sell 行上点击 "+ 收款" — 新增一笔 installment receipt。
   *  没传时按钮不渲染（向后兼容，比如某些裁剪页面）。 */
  onOpenReceipts?: (transaction: TransactionWithRequiredFields) => void;
  /** Transaction ids that have an installment receipt due this week. Drives
   *  the ?txdue=1 pseudo-filter used by the WeeklyBriefing "Installment due"
   *  card so clicking Review narrows the list to those rows instead of
   *  dumping the user into the full activity log. */
  receiptsDueIds?: Set<string>;
}

const TRANSACTIONS_PAGE_SIZE = 30;

// 共享行细节块：移动卡片和桌面表格 cell 之前各写过一遍"金额 + ROI + 平台
// 费净额 + 分期"逻辑，是漂移源（颜色/字号在两边经常对不齐）。提取后两侧
// 走 variant：card（金额 + ROI 同行 inline，font 更大）、table（全部竖排）。
//
// metricsTransaction：分期 sell 按已收折算后的同 id 副本；用于让行展示的
// gross / net 与 Period KPI、Insights、Timeline 同口径，避免一行 +$50,000、
// 上方 KPI +$10,000 这种跨视图打架。
function TxMetaBlock({
  transaction,
  metricsTransaction,
  domain,
  formatCurrency,
  t,
  variant,
}: {
  transaction: TransactionWithRequiredFields;
  metricsTransaction?: TransactionWithRequiredFields;
  domain: DomainWithTags | undefined;
  formatCurrency: (amount: number, currency: string) => string;
  t: (key: string) => string;
  variant: 'card' | 'table';
}) {
  const isSell = transaction.type === 'sell';
  const sign = isSell ? '+' : '-';
  const listedGross = sellGrossUSD(transaction);
  const adjustedGross = metricsTransaction ? sellGrossUSD(metricsTransaction) : listedGross;
  // 仅 sell 有 metrics-adjustment 余地；非 sell 时 metrics === transaction，showSplit 为 false。
  const showSplit = isSell && Math.abs(adjustedGross - listedGross) > 0.005;
  const displayGross = showSplit ? adjustedGross : listedGross;
  // 净额走 metrics（如有），保证"主行 + 副行 + 净额"三个数都同口径。
  const netSource = metricsTransaction ?? transaction;
  const amountColor = isSell ? 'text-emerald-700' : 'text-stone-900';
  const hasPlatformFee = isSell && netSource.platform_fee != null && netSource.platform_fee > 0;
  const isInstallment = isSell && transaction.payment_plan === 'installment';
  const sellRoi = isSell && domain ? calculateDomainROI(domain, [transaction]) : null;
  const isCard = variant === 'card';

  const amountEl = (
    <span className={`tabular-nums ${isCard ? 'text-base font-bold' : 'text-sm font-semibold'} ${amountColor}`}>
      {sign}{formatCurrency(displayGross, transaction.currency)}
    </span>
  );

  const listedHintEl = showSplit && (
    <span className="text-xs text-stone-500 tabular-nums">
      {t('timeline.sellListedHint').replace('{amount}', formatCurrency(listedGross, transaction.currency))}
    </span>
  );

  const roiEl = sellRoi !== null && (
    <span className={`text-xs font-medium tabular-nums ${sellRoi.roi >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
      ROI {sellRoi.roi >= 0 ? '+' : ''}{formatPercentage(sellRoi.roi)}
    </span>
  );

  const feeEl = hasPlatformFee && (
    <span className="text-xs text-stone-500 tabular-nums">
      {t('transaction.netIncome')}: {formatCurrency(sellNetUSD(netSource), transaction.currency)}
    </span>
  );

  const installmentEl = isInstallment && (
    <span className="text-xs text-stone-500">
      {transaction.installment_status === 'cancelled'
        ? `${t('transaction.installment')} · ${t('transaction.cancelled')}`
        : `${t('transaction.installment')} ${transaction.receipts?.length ?? 0}/${transaction.installment_period ?? 0}`}
    </span>
  );

  if (isCard) {
    return (
      <>
        <div className="flex items-baseline flex-wrap gap-x-2 gap-y-1">
          {amountEl}
          {roiEl}
        </div>
        {listedHintEl && <div className="mt-0.5">{listedHintEl}</div>}
        {feeEl && <div className="mt-0.5">{feeEl}</div>}
        {installmentEl && <div className="mt-0.5">{installmentEl}</div>}
      </>
    );
  }

  return (
    <div className="flex flex-col gap-0.5">
      {amountEl}
      {listedHintEl}
      {feeEl}
      {installmentEl}
      {roiEl}
    </div>
  );
}

const TransactionList = memo(function TransactionList({
  transactions,
  metricsTransactions,
  domains,
  onEdit,
  onDelete,
  onAdd,
  onOpenReceipts,
  receiptsDueIds
}: TransactionListProps) {
  const { t, locale } = useI18nContext();
  const localeTag = locale === 'zh' ? 'zh-CN' : 'en-US';
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // search/type/sort/page/view derived from URL (namespaced as tx* to avoid colliding with other components)
  type SortField = 'date' | 'amount' | 'type';
  type SortDir = 'asc' | 'desc';
  const urlSearchTerm = searchParams.get('txq') ?? '';
  const typeFilter = searchParams.get('txtype') ?? 'all';
  // Receipts-due pseudo filter — driven from the WeeklyBriefing "Installment
  // due" card. Without it, clicking Review used to scroll to the domain list
  // (wrong destination) and never narrowed to the actual installments.
  const receiptsDueFilter = searchParams.get('txdue') === '1';
  const sortField: SortField = ((): SortField => {
    const raw = searchParams.get('txsort');
    return raw === 'amount' || raw === 'type' ? raw : 'date';
  })();
  const sortDir: SortDir = searchParams.get('txdir') === 'asc' ? 'asc' : 'desc';
  const pageRaw = Math.max(1, Number(searchParams.get('txpage')) || 1);
  // viewMode 持久化到 URL：偏好 timeline 的用户刷新/分享链接也能保住选择。
  const viewMode: 'list' | 'timeline' = searchParams.get('txview') === 'timeline' ? 'timeline' : 'list';
  // timeline 选中域名同样持久化到 URL，并把状态放在父组件这里集中管理。
  const selectedDomainId = searchParams.get('txdomain') ?? '';

  const updateParams = useCallback((updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v === null || v === '' || v === undefined) params.delete(k);
      else params.set(k, v);
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [searchParams, pathname, router]);

  // Input state is local + debounced to URL. See DomainList for details --
  // binding value= directly to a URL param drops keystrokes on fast typing.
  const writeSearchParam = useCallback(
    (v: string | null) => updateParams({ txq: v, txpage: null }),
    [updateParams]
  );
  const [searchTerm, setSearchTerm] = useDebouncedUrlParam(urlSearchTerm, writeSearchParam);

  const setTypeFilter = (s: string) => updateParams({ txtype: s === 'all' ? null : s, txpage: null });
  const setPage = (n: number) => updateParams({ txpage: n <= 1 ? null : String(n) });
  const clearReceiptsDueFilter = () => updateParams({ txdue: null, txpage: null });
  const setViewMode = (mode: 'list' | 'timeline') => updateParams({ txview: mode === 'list' ? null : 'timeline' });
  const setSelectedDomainId = (id: string) => updateParams({ txdomain: id || null });

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      const nextDir: SortDir = sortDir === 'asc' ? 'desc' : 'asc';
      // 'date desc' is the implicit default — omit when matching to keep URL clean
      const dirParam = field === 'date' && nextDir === 'desc' ? null : nextDir;
      updateParams({ txdir: dirParam, txpage: null });
    } else {
      const defaultDir: SortDir = field === 'date' ? 'desc' : 'asc';
      updateParams({
        txsort: field === 'date' ? null : field,
        txdir: field === 'date' && defaultDir === 'desc' ? null : defaultDir,
        txpage: null,
      });
    }
  };

  // 按"金钱方向"3 段着色：入账绿、主支出中性 stone、杂项支出 amber。
  // 旧实现给 7 个 type 各分一种孤立色（红/绿/蓝/黄/灰/紫/粉），其中 buy
  // 用红色像"危险"，但买入只是常规支出，配色没有信息量反而误导。
  const getTypeColor = (type: string) => {
    switch (type) {
      case 'sell':
        return 'bg-emerald-100 text-emerald-700';
      case 'buy':
      case 'renew':
        return 'bg-stone-100 text-stone-700';
      case 'transfer':
      case 'fee':
      case 'marketing':
      case 'advertising':
        return 'bg-amber-50 text-amber-700';
      default:
        return 'bg-stone-100 text-stone-700';
    }
  };

  // Chip palette for the type filter strip — same 3-band 金钱方向 logic as
  // getTypeColor, but with active=solid / idle=tinted variants. Inflow types
  // (sell) get emerald; main outflow (buy/renew) stays neutral stone so common
  // operations don't visually scream; ancillary outflows (fee/transfer/etc)
  // get amber attention. "All" is stone-900 to match the DomainList All chip.
  const typeChipPalette: Record<string, { active: string; idle: string }> = {
    all: {
      active: 'bg-stone-900 text-white border-stone-900',
      idle: 'bg-white text-stone-700 border-stone-200 hover:border-stone-300',
    },
    sell: {
      active: 'bg-emerald-600 text-white border-emerald-600',
      idle: 'bg-emerald-50 text-emerald-700 border-emerald-100 hover:border-emerald-200',
    },
    buy: {
      active: 'bg-stone-700 text-white border-stone-700',
      idle: 'bg-stone-50 text-stone-700 border-stone-200 hover:border-stone-300',
    },
    renew: {
      active: 'bg-stone-700 text-white border-stone-700',
      idle: 'bg-stone-50 text-stone-700 border-stone-200 hover:border-stone-300',
    },
    transfer: {
      active: 'bg-amber-500 text-white border-amber-500',
      idle: 'bg-amber-50 text-amber-700 border-amber-100 hover:border-amber-200',
    },
    fee: {
      active: 'bg-amber-500 text-white border-amber-500',
      idle: 'bg-amber-50 text-amber-700 border-amber-100 hover:border-amber-200',
    },
    marketing: {
      active: 'bg-amber-500 text-white border-amber-500',
      idle: 'bg-amber-50 text-amber-700 border-amber-100 hover:border-amber-200',
    },
    advertising: {
      active: 'bg-amber-500 text-white border-amber-500',
      idle: 'bg-amber-50 text-amber-700 border-amber-100 hover:border-amber-200',
    },
  };

  const getTypeLabel = useCallback((type: string) => {
    switch (type) {
      case 'buy': return t('transaction.buy');
      case 'sell': return t('transaction.sell');
      case 'renew': return t('transaction.renew');
      case 'transfer': return t('transaction.transfer');
      case 'fee': return t('transaction.fee');
      case 'marketing': return t('transaction.marketing');
      case 'advertising': return t('transaction.advertising');
      default: return type;
    }
  }, [t]);

  const formatCurrency = useCallback((amount: number, currency: string) => {
    return new Intl.NumberFormat(localeTag, {
      style: 'currency',
      currency: currency
    }).format(amount);
  }, [localeTag]);

  const formatDate = useCallback((dateString: string) => {
    return new Date(dateString).toLocaleDateString(localeTag);
  }, [localeTag]);

  // domainById：行渲染需要拿完整 domain 对象算 ROI（旧逻辑每行 .find 是
  // O(n×m)）。原 domainMap 只存 id→name，独立留一份完整对象的 Map，
  // getDomainName 改走它，避免维护两份索引。
  const domainById = useMemo(() => {
    const map = new Map<string, DomainWithTags>();
    domains.forEach((d) => map.set(d.id, d));
    return map;
  }, [domains]);

  const getDomainName = useCallback((domainId: string) => {
    return domainById.get(domainId)?.domain_name || t('transactionList.unknownDomain');
  }, [domainById, t]);

  // Same guard as DomainList: ignore the URL flag when the parent didn't
  // hand us an id set, so the list doesn't silently collapse to empty.
  const receiptsDueFilterActive = receiptsDueFilter && !!receiptsDueIds;

  const filteredTransactions = useMemo(() => {
    const q = searchTerm.toLowerCase();
    const filtered = transactions.filter(transaction => {
      // 搜索覆盖：域名 + notes + type 标签（i18n 后）+ category。原来只匹配
      // 前两项，搜 "sell" / "投资" 这类常见词全是空结果，用户得手动按 type
      // 筛再来回切。category 同理——保存进 DB 但搜索完全不见。
      const matchesSearch =
        !q ||
        getDomainName(transaction.domain_id).toLowerCase().includes(q) ||
        (transaction.notes || '').toLowerCase().includes(q) ||
        (transaction.category || '').toLowerCase().includes(q) ||
        getTypeLabel(transaction.type).toLowerCase().includes(q);

      const matchesType = typeFilter === 'all' || transaction.type === typeFilter;
      const matchesReceiptsDue = !receiptsDueFilterActive || receiptsDueIds!.has(transaction.id);

      return matchesSearch && matchesType && matchesReceiptsDue;
    });
    const sorted = filtered.slice().sort((a, b) => {
      let cmp = 0;
      if (sortField === 'date') {
        cmp = (a.date || '').localeCompare(b.date || '');
      } else if (sortField === 'amount') {
        cmp = sellGrossUSD(a) - sellGrossUSD(b);
      } else {
        cmp = a.type.localeCompare(b.type);
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [transactions, getDomainName, getTypeLabel, searchTerm, typeFilter, sortField, sortDir, receiptsDueFilterActive, receiptsDueIds]);

  // Period KPIs reflecting the *visible* (filtered) set, computed from installment-adjusted
  // amounts (when parent supplies metricsTransactions). Inflow uses sellNetUSD — actual cash
  // collected after platform fees and after scaling for partial / cancelled installments —
  // mirroring the Insights "Total Revenue" definition. "Net" here is window cash flow,
  // not the all-time Net Profit (that would require holding-cost calculations across history).
  const metricsById = useMemo(() => {
    const map = new Map<string, TransactionWithRequiredFields>();
    const source = metricsTransactions ?? transactions;
    for (const tx of source) map.set(tx.id, tx);
    return map;
  }, [metricsTransactions, transactions]);

  const periodMetrics = useMemo(() => {
    let inflow = 0;
    let outflow = 0;
    for (const tx of filteredTransactions) {
      const adj = metricsById.get(tx.id) ?? tx;
      if (tx.type === 'sell') {
        const v = sellNetUSD(adj);
        if (Number.isFinite(v)) inflow += v;
      } else {
        const v = Number(adj.amount ?? 0);
        if (Number.isFinite(v)) outflow += v;
      }
    }
    return { inflow, outflow, net: inflow - outflow, count: filteredTransactions.length };
  }, [filteredTransactions, metricsById]);

  // Type-aware KPI tiles. Single-type filter ≠ all 时 inflow/outflow/net 三
  // 个里有两个必然冗余（sell 时 outflow=0、net=inflow；buy/renew 等只时反
  // 过来）。所以根据 typeFilter 切换 KPI 含义：sell 看销售三件套（Gross /
  // Net / Fees），其他单一支出看支出统计（Total / Avg / Largest）。ALL 走
  // 历史 4 KPI（Inflow/Outflow/Net/Count）保持原有"全局现金流"语义。
  type KpiTile = {
    key: string;
    label: string;
    value: string;
    iconBg: string;
    valueColor: string;
    icon: React.ReactNode;
  };
  const sellKpis = useMemo(() => {
    let gross = 0;
    let net = 0;
    for (const tx of filteredTransactions) {
      const adj = metricsById.get(tx.id) ?? tx;
      const g = sellGrossUSD(adj);
      const n = sellNetUSD(adj);
      if (Number.isFinite(g)) gross += g;
      if (Number.isFinite(n)) net += n;
    }
    return { gross, net, fees: Math.max(0, gross - net) };
  }, [filteredTransactions, metricsById]);
  const outflowKpis = useMemo(() => {
    let total = 0;
    let largest = 0;
    for (const tx of filteredTransactions) {
      const adj = metricsById.get(tx.id) ?? tx;
      const v = Number(adj.amount ?? 0);
      if (!Number.isFinite(v)) continue;
      total += v;
      if (v > largest) largest = v;
    }
    const count = filteredTransactions.length;
    return { total, largest, avg: count > 0 ? total / count : 0 };
  }, [filteredTransactions, metricsById]);

  const kpiTiles: KpiTile[] = useMemo(() => {
    const fmt = (n: number) => formatCurrency(n, 'USD');
    const countTile: KpiTile = {
      key: 'count',
      label: t('transactionList.kpiCount'),
      value: String(periodMetrics.count),
      iconBg: 'bg-stone-100 text-stone-700',
      valueColor: 'text-stone-900',
      icon: <Hash className="h-5 w-5" />,
    };

    if (typeFilter === 'sell') {
      return [
        {
          key: 'totalSales',
          label: t('transactionList.kpiTotalSales'),
          value: fmt(sellKpis.gross),
          iconBg: 'bg-emerald-50 text-emerald-700',
          valueColor: 'text-emerald-700',
          icon: <Coins className="h-5 w-5" />,
        },
        {
          key: 'netRevenue',
          label: t('transactionList.kpiNetRevenue'),
          value: fmt(sellKpis.net),
          iconBg: 'bg-emerald-50 text-emerald-700',
          valueColor: 'text-emerald-700',
          icon: <TrendingUp className="h-5 w-5" />,
        },
        {
          key: 'platformFees',
          label: t('transactionList.kpiPlatformFees'),
          value: fmt(sellKpis.fees),
          iconBg: 'bg-stone-100 text-stone-700',
          valueColor: 'text-stone-900',
          icon: <Receipt className="h-5 w-5" />,
        },
        countTile,
      ];
    }

    // 单一支出类型 filter（buy/renew/fee/transfer/marketing/advertising）：
    // 把 4 KPI 改成支出语境（总支出 / 平均 / 最大单笔 / 笔数）。
    if (typeFilter !== 'all') {
      return [
        {
          key: 'totalSpent',
          label: t('transactionList.kpiTotalSpent'),
          value: fmt(outflowKpis.total),
          iconBg: 'bg-rose-50 text-rose-700',
          valueColor: 'text-rose-700',
          icon: <TrendingDown className="h-5 w-5" />,
        },
        {
          key: 'avgPerTx',
          label: t('transactionList.kpiAvgPerTx'),
          value: fmt(outflowKpis.avg),
          iconBg: 'bg-stone-100 text-stone-700',
          valueColor: 'text-stone-900',
          icon: <DollarSign className="h-5 w-5" />,
        },
        {
          key: 'largest',
          label: t('transactionList.kpiLargest'),
          value: fmt(outflowKpis.largest),
          iconBg: 'bg-stone-100 text-stone-700',
          valueColor: 'text-stone-900',
          icon: <Award className="h-5 w-5" />,
        },
        countTile,
      ];
    }

    // ALL：保留历史 4 KPI 的"全局现金流"语义。
    const netSign = periodMetrics.net > 0 ? '+' : periodMetrics.net < 0 ? '−' : '';
    const netColor =
      periodMetrics.net > 0
        ? 'text-emerald-700'
        : periodMetrics.net < 0
          ? 'text-rose-700'
          : 'text-stone-700';
    const netIconBg =
      periodMetrics.net > 0
        ? 'bg-emerald-50 text-emerald-700'
        : periodMetrics.net < 0
          ? 'bg-rose-50 text-rose-700'
          : 'bg-stone-100 text-stone-700';
    return [
      {
        key: 'inflow',
        label: t('transactionList.kpiInflow'),
        value: `${periodMetrics.inflow > 0 ? '+' : ''}${fmt(periodMetrics.inflow)}`,
        iconBg: 'bg-emerald-50 text-emerald-700',
        valueColor: 'text-emerald-700',
        icon: <TrendingUp className="h-5 w-5" />,
      },
      {
        key: 'outflow',
        label: t('transactionList.kpiOutflow'),
        value: `${periodMetrics.outflow > 0 ? '−' : ''}${fmt(periodMetrics.outflow)}`,
        iconBg: 'bg-rose-50 text-rose-700',
        valueColor: 'text-rose-700',
        icon: <TrendingDown className="h-5 w-5" />,
      },
      {
        key: 'net',
        label: t('transactionList.kpiNet'),
        value: `${netSign}${fmt(Math.abs(periodMetrics.net))}`,
        iconBg: netIconBg,
        valueColor: netColor,
        icon: <Scale className="h-5 w-5" />,
      },
      countTile,
    ];
  }, [typeFilter, periodMetrics, sellKpis, outflowKpis, t, formatCurrency]);

  const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / TRANSACTIONS_PAGE_SIZE));
  const page = Math.min(pageRaw, totalPages);

  // If the URL points beyond available pages (e.g. a stale shared link), normalize the URL once.
  useEffect(() => {
    if (pageRaw > totalPages) updateParams({ txpage: null });
  }, [pageRaw, totalPages, updateParams]);

  const paginatedTransactions = useMemo(() => {
    const start = (page - 1) * TRANSACTIONS_PAGE_SIZE;
    return filteredTransactions.slice(start, start + TRANSACTIONS_PAGE_SIZE);
  }, [filteredTransactions, page]);

  const paginationRangeSummary =
    filteredTransactions.length > TRANSACTIONS_PAGE_SIZE
      ? t('common.paginationRange')
          .replace('{start}', String((page - 1) * TRANSACTIONS_PAGE_SIZE + 1))
          .replace(
            '{end}',
            String(Math.min(page * TRANSACTIONS_PAGE_SIZE, filteredTransactions.length))
          )
          .replace('{total}', String(filteredTransactions.length))
      : undefined;

  const typeOptions = [
    { value: 'all', labelKey: 'transactionList.allTypes' as const },
    { value: 'buy', labelKey: 'transaction.buy' as const },
    { value: 'sell', labelKey: 'transaction.sell' as const },
    { value: 'renew', labelKey: 'transaction.renew' as const },
    { value: 'transfer', labelKey: 'transaction.transfer' as const },
    { value: 'fee', labelKey: 'transaction.fee' as const },
    { value: 'marketing', labelKey: 'transaction.marketing' as const },
    { value: 'advertising', labelKey: 'transaction.advertising' as const }
  ];

  // 每种 type 的计数 — 用于 chip 上显示 (n)，只在 count > 0 时渲染对应 chip，
  // 避免给只录了 buy/sell/renew 的用户显示一长串 0 的 transfer/marketing。
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = { all: transactions.length };
    for (const tx of transactions) {
      counts[tx.type] = (counts[tx.type] ?? 0) + 1;
    }
    return counts;
  }, [transactions]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h2 className="text-xl font-semibold text-stone-900">{t('transactionList.title')}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl border border-stone-200 bg-stone-50/80 p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition ${
                viewMode === 'list'
                  ? 'bg-white text-stone-900 shadow-sm'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <LayoutList className="h-4 w-4" />
              {t('transactionList.viewList')}
            </button>
            <button
              type="button"
              onClick={() => setViewMode('timeline')}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition ${
                viewMode === 'timeline'
                  ? 'bg-white text-stone-900 shadow-sm'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <GitBranch className="h-4 w-4" />
              {t('transactionList.viewTimeline')}
            </button>
          </div>
          <button
            onClick={onAdd}
            className="inline-flex items-center px-4 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-medium hover:bg-teal-700 transition"
          >
            <Plus className="h-4 w-4 mr-2" />
            {t('transactionList.addTransaction')}
          </button>
        </div>
      </div>

      {/* Receipts-due pseudo-filter banner — only when the WeeklyBriefing
          "Installment due" card drove the user here. Explains why the list
          is short and offers a one-tap escape. Emerald to match the card. */}
      {receiptsDueFilterActive && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50/70 px-3.5 py-2 text-sm text-emerald-900">
          <span>{t('transactionList.receiptsDueFilterBanner')}</span>
          <button
            type="button"
            onClick={clearReceiptsDueFilter}
            className="rounded-md px-2 py-1 text-xs font-medium text-emerald-900 underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            {t('transactionList.clearFilters')}
          </button>
        </div>
      )}

      {/* Type chip strip — primary type filter, replaces the old dropdown.
          Only rendered when there's at least one transaction; hidden in
          timeline mode (which has its own filtering semantics). Each chip
          shows a count and only renders when count > 0 (so users with only
          buy/sell/renew don't see empty transfer/marketing chips). */}
      {viewMode === 'list' && transactions.length > 0 && (
        <div
          role="tablist"
          aria-label={t('transactionList.allTypes')}
          className="flex flex-wrap items-center gap-2"
        >
          {typeOptions.map((option) => {
            const isActive = typeFilter === option.value;
            const palette = typeChipPalette[option.value] ?? typeChipPalette.all;
            const count = typeCounts[option.value] ?? 0;
            // Always show All; for specific types only render if there's data
            if (option.value !== 'all' && count === 0) return null;
            return (
              <button
                key={option.value}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setTypeFilter(option.value)}
                className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-1 ${
                  isActive ? palette.active : palette.idle
                }`}
              >
                <span>{t(option.labelKey)}</span>
                <span
                  className={`tabular-nums text-xs ${
                    isActive ? 'opacity-90' : 'opacity-70'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
            {/* timeline 模式下搜索语义改变（只匹配域名名称，用来过滤左侧
                选择列表），placeholder 也跟着切换，避免之前要靠下方一行
                hint 文字才能让用户察觉。 */}
            <input
              type="search"
              aria-label={viewMode === 'timeline' ? t('transactionList.searchPlaceholderTimeline') : t('transactionList.searchPlaceholder')}
              placeholder={viewMode === 'timeline' ? t('transactionList.searchPlaceholderTimeline') : t('transactionList.searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            />
          </div>
        </div>
        {viewMode === 'list' && (
          <div className="flex flex-wrap items-center gap-3">
            <Filter className="h-4 w-4 text-stone-400 lg:hidden" />
            {/* Sort dropdown — mobile only (desktop uses clickable column headers) */}
            <select
              value={`${sortField}-${sortDir}`}
              onChange={(e) => {
                const [field, dir] = e.target.value.split('-') as [SortField, SortDir];
                updateParams({
                  txsort: field === 'date' ? null : field,
                  txdir: (field === 'date' && dir === 'desc') ? null : dir,
                  txpage: null,
                });
              }}
              aria-label={t('transactionList.sortBy')}
              className="lg:hidden px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="date-desc">{t('transactionList.sortByDate')} · {t('transactionList.sortDesc')}</option>
              <option value="date-asc">{t('transactionList.sortByDate')} · {t('transactionList.sortAsc')}</option>
              <option value="amount-desc">{t('transactionList.sortByAmount')} · {t('transactionList.sortDesc')}</option>
              <option value="amount-asc">{t('transactionList.sortByAmount')} · {t('transactionList.sortAsc')}</option>
              <option value="type-asc">{t('transactionList.sortByType')} · {t('transactionList.sortAsc')}</option>
              <option value="type-desc">{t('transactionList.sortByType')} · {t('transactionList.sortDesc')}</option>
            </select>
          </div>
        )}
      </div>

      {viewMode === 'list' && filteredTransactions.length > 0 && (
        <div className="relative overflow-hidden rounded-3xl border border-stone-200/60 bg-gradient-to-br from-stone-50 via-white to-emerald-50/30 shadow-sm">
          <div className="pointer-events-none absolute -top-16 -right-16 h-44 w-44 rounded-full bg-gradient-to-br from-emerald-100/30 to-transparent blur-3xl" />
          <div className="relative grid grid-cols-2 gap-4 p-5 sm:p-6 lg:grid-cols-4 lg:gap-6">
            {kpiTiles.map((tile) => (
              <div key={tile.key} className="flex items-start gap-3">
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tile.iconBg}`}
                >
                  {tile.icon}
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-500">
                    {tile.label}
                  </p>
                  <p className={`mt-1 text-xl font-bold tracking-tight tabular-nums ${tile.valueColor}`}>
                    {tile.value}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {viewMode === 'list' && (
        <p className="text-sm text-stone-500">
          {t('transactionList.showingCount').replace('{filtered}', String(filteredTransactions.length)).replace('{total}', String(transactions.length))}
        </p>
      )}

      {viewMode === 'timeline' ? (
        <DomainTimelineView
          domains={domains}
          transactions={transactions}
          metricsTransactions={metricsTransactions}
          onEditTransaction={onEdit}
          domainSearch={searchTerm}
          selectedDomainId={selectedDomainId}
          onSelectDomain={setSelectedDomainId}
        />
      ) : filteredTransactions.length === 0 ? (
        <div className="text-center py-14 bg-white rounded-2xl border border-stone-200/80 shadow-sm">
          <FileText className="h-10 w-10 mx-auto text-stone-300 mb-4" />
          <h3 className="text-base font-semibold text-stone-900 mb-2">
            {searchTerm || typeFilter !== 'all' || receiptsDueFilterActive ? t('transactionList.noTransactionsFound') : t('transactionList.noTransactionsYet')}
          </h3>
          <p className="text-sm text-stone-500 mb-5 max-w-sm mx-auto">
            {searchTerm || typeFilter !== 'all' || receiptsDueFilterActive ? t('transactionList.adjustSearch') : t('transactionList.getStarted')}
          </p>
          {!searchTerm && typeFilter === 'all' && !receiptsDueFilterActive ? (
            <button
              onClick={onAdd}
              className="inline-flex items-center px-4 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-medium hover:bg-teal-700 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
            >
              <Plus className="h-4 w-4 mr-2" />
              {t('transactionList.addFirstTransaction')}
            </button>
          ) : (
            <button
              onClick={() => {
                // Same batching rule as DomainList — setTypeFilter and
                // clearReceiptsDueFilter both do updateParams off the same
                // searchParams snapshot, so calling them in sequence loses
                // the first write. Collapse to one updateParams.
                setSearchTerm('');
                updateParams({
                  txq: null,
                  txtype: null,
                  txdue: null,
                  txpage: null,
                });
              }}
              className="inline-flex items-center px-4 py-2.5 border border-stone-300 bg-white text-stone-700 rounded-xl text-sm font-medium hover:bg-stone-100 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
            >
              {t('transactionList.clearFilters')}
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {/* Mobile: stacked cards (table is unreadable below lg).
              Sell rows get a left emerald accent strip; outflow rows stay neutral. */}
          <div className="lg:hidden space-y-2">
            {paginatedTransactions.map((transaction) => (
              <article
                key={transaction.id}
                className={`bg-white rounded-2xl border border-stone-200/80 shadow-sm p-4 ${
                  transaction.type === 'sell' ? 'border-l-4 border-l-emerald-500' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-stone-900 break-words">
                      {getDomainName(transaction.domain_id)}
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-stone-500">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full font-medium ${getTypeColor(transaction.type)}`}>
                        {getTypeLabel(transaction.type)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(transaction.date)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    {onOpenReceipts &&
                      transaction.type === 'sell' &&
                      transaction.payment_plan === 'installment' &&
                      transaction.installment_status !== 'cancelled' &&
                      transaction.installment_status !== 'completed' && (
                        <button
                          onClick={() => onOpenReceipts(transaction)}
                          aria-label={`${t('transaction.addReceipt')} ${getDomainName(transaction.domain_id)}`}
                          className="p-2 text-stone-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                        >
                          <PlusCircle className="h-4 w-4" />
                        </button>
                      )}
                    <button
                      onClick={() => onEdit(transaction)}
                      aria-label={`${t('common.edit')} ${getDomainName(transaction.domain_id)}`}
                      className="p-2 text-stone-500 hover:text-teal-600 hover:bg-teal-50 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => onDelete(transaction.id)}
                      aria-label={`${t('common.delete')} ${getDomainName(transaction.domain_id)}`}
                      className="p-2 text-stone-500 hover:text-rose-600 hover:bg-rose-50 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="mt-3">
                  <TxMetaBlock
                    transaction={transaction}
                    metricsTransaction={metricsById.get(transaction.id)}
                    domain={domainById.get(transaction.domain_id)}
                    formatCurrency={formatCurrency}
                    t={t}
                    variant="card"
                  />
                </div>
                {transaction.notes && (
                  <div className="mt-2 text-xs text-stone-600 break-words">{transaction.notes}</div>
                )}
              </article>
            ))}
          </div>
          {/* Desktop: full table */}
          <div className="hidden lg:block bg-white rounded-2xl border border-stone-200/80 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-stone-200">
                <thead className="bg-stone-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">
                      {t('transactionList.domain')}
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider"
                      aria-sort={sortField === 'type' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    >
                      <button
                        type="button"
                        onClick={() => toggleSort('type')}
                        aria-label={`${t('transactionList.sortBy')} ${t('transactionList.type')}`}
                        className="inline-flex items-center gap-1 uppercase tracking-wider hover:text-stone-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-1 rounded"
                      >
                        {t('transactionList.type')}
                        {sortField === 'type' && (sortDir === 'asc' ? <ArrowUp className="h-3 w-3 text-teal-600" /> : <ArrowDown className="h-3 w-3 text-teal-600" />)}
                      </button>
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider"
                      aria-sort={sortField === 'amount' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    >
                      <button
                        type="button"
                        onClick={() => toggleSort('amount')}
                        aria-label={`${t('transactionList.sortBy')} ${t('transactionList.amount')}`}
                        className="inline-flex items-center gap-1 uppercase tracking-wider hover:text-stone-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-1 rounded"
                      >
                        {t('transactionList.amount')}
                        {sortField === 'amount' && (sortDir === 'asc' ? <ArrowUp className="h-3 w-3 text-teal-600" /> : <ArrowDown className="h-3 w-3 text-teal-600" />)}
                      </button>
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider"
                      aria-sort={sortField === 'date' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    >
                      <button
                        type="button"
                        onClick={() => toggleSort('date')}
                        aria-label={`${t('transactionList.sortBy')} ${t('transactionList.date')}`}
                        className="inline-flex items-center gap-1 uppercase tracking-wider hover:text-stone-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-1 rounded"
                      >
                        {t('transactionList.date')}
                        {sortField === 'date' && (sortDir === 'asc' ? <ArrowUp className="h-3 w-3 text-teal-600" /> : <ArrowDown className="h-3 w-3 text-teal-600" />)}
                      </button>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">
                      {t('transactionList.notes')}
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-stone-500 uppercase tracking-wider">
                      {t('transactionList.actions')}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-stone-200">
                  {paginatedTransactions.map((transaction) => (
                  <tr
                    key={transaction.id}
                    className={`hover:bg-stone-50/80 ${
                      transaction.type === 'sell' ? 'bg-emerald-50/30' : ''
                    }`}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-stone-900">
                        {getDomainName(transaction.domain_id)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTypeColor(transaction.type)}`}>
                        {getTypeLabel(transaction.type)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <TxMetaBlock
                        transaction={transaction}
                        metricsTransaction={metricsById.get(transaction.id)}
                        domain={domainById.get(transaction.domain_id)}
                        formatCurrency={formatCurrency}
                        t={t}
                        variant="table"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Calendar className="h-4 w-4 text-stone-400 mr-1" />
                        <span className="text-sm text-stone-900">
                          {formatDate(transaction.date)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-stone-700 max-w-xs truncate">
                        {transaction.notes || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-0.5">
                        {onOpenReceipts &&
                          transaction.type === 'sell' &&
                          transaction.payment_plan === 'installment' &&
                          transaction.installment_status !== 'cancelled' &&
                          transaction.installment_status !== 'completed' && (
                            <button
                              onClick={() => onOpenReceipts(transaction)}
                              aria-label={`${t('transaction.addReceipt')} ${getDomainName(transaction.domain_id)}`}
                              className="p-2 text-stone-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                            >
                              <PlusCircle className="h-4 w-4" />
                            </button>
                          )}
                        <button
                          onClick={() => onEdit(transaction)}
                          aria-label={`${t('common.edit')} ${getDomainName(transaction.domain_id)}`}
                          className="p-2 text-stone-500 hover:text-teal-600 hover:bg-teal-50 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => onDelete(transaction.id)}
                          aria-label={`${t('common.delete')} ${getDomainName(transaction.domain_id)}`}
                          className="p-2 text-stone-500 hover:text-rose-600 hover:bg-rose-50 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <ListPagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={setPage}
            rangeSummary={paginationRangeSummary}
          />
        </div>
      )}
    </div>
  );
});

export default TransactionList;
