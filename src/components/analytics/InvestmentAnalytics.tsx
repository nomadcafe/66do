'use client';

import React, { useState, useMemo } from 'react';
import { expandSellToCashReceipts } from '../../lib/coreCalculations';
import { sellGrossUSD, sellNetUSD } from '../../lib/sellProceeds';
import { realizedPnLByMonth, annualizedRealizedReturn } from '../../lib/realizedPnL';
import { useI18nContext } from '../../contexts/I18nProvider';
import { DomainWithTags, TransactionWithRequiredFields } from '../../types/dashboard';
import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Area,
  AreaChart,
  BarChart,
  Bar,
} from 'recharts';
import {
  BarChart3,
  Globe,
  Info,
  Wallet,
  CalendarClock,
  Building2,
  RefreshCw,
  ShoppingCart,
  Coins,
} from 'lucide-react';
import { expandRenewalEvents } from '../../lib/expandRenewalEvents';

interface InvestmentAnalyticsProps {
  domains: DomainWithTags[];
  transactions: TransactionWithRequiredFields[];
}

// 5 个 KPI tile，全部跟随时间窗口选择器。
//   - Realized P&L      :chart 黄线在窗口的累计
//   - Annualized Return :realized 口径年化（窗口感知）
//   - Investment        :chart indigo 区域窗口求和
//   - Renewal Cost      :chart 紫线窗口求和（Investment 的子集）
//   - Total Sales       :按到账月展开 gross 后窗口求和。跟 chart 不直接对齐
//                        （chart 没有"毛额"系列），但用来跟 Performance hero
//                        的 lifetime Total Revenue 对照判断平台费比例。
// Net cash flow / Revenue 已撤除：前者口径介于 cash 与 P&L 之间不像主线指标；
// 后者 lifetime 已经在 Performance hero 上呈现，重复展示窗口净额价值不大。
interface PortfolioMetrics {
  realizedPnL: number;
  annualizedReturn: number | null;
  investment: number;
  renewalCost: number;
  grossSales: number;
}

interface TimeSeriesData {
  date: string;
  investment: number;        // 单月新增 cost basis（buy + 实际续费 archive/tx）
  renewalCost: number;       // investment 里归属于「实际续费」的部分（archive + tx，不含 projected）
  revenue: number;           // 单月净入账（分期销售按到账月展开）
  realizedPnL: number;       // 累计已实现盈亏：每笔出售 (sellNet − cost basis at sale)，按到账月分摊
  monthlyCashFlow: number;   // 给月度净现金流图用，本图不画
}

const InfoTooltip = ({ text }: { text: string }) => (
  <span className="group relative inline-flex">
    <Info className="h-3.5 w-3.5 text-stone-400 cursor-help hover:text-stone-600 transition-colors" />
    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-stone-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10 max-w-xs whitespace-normal text-center">
      {text}
      <span className="absolute top-full left-1/2 -translate-x-1/2 -mt-1">
        <span className="block w-2 h-2 bg-stone-900 rotate-45" />
      </span>
    </span>
  </span>
);

const CHART_PALETTE = [
  '#0d9488', // teal-600
  '#10b981', // emerald-500
  '#f59e0b', // amber-500
  '#6366f1', // indigo-500
  '#0891b2', // cyan-600
  '#84cc16', // lime-500
  '#a855f7', // purple-500
  '#f97316', // orange-500
];

export default function InvestmentAnalytics({ domains, transactions }: InvestmentAnalyticsProps) {
  const { t, locale } = useI18nContext();
  const [selectedTimeframe, setSelectedTimeframe] = useState<'6M' | '1Y' | '2Y' | '3Y' | 'ALL'>('ALL');

  // 图表 4 条数据系列的显隐开关——legend 上点击切换，hide=true 时 Recharts
  // 不渲染该 series。默认全亮；用户主动隐藏后保留在本 component 生命周期内。
  type ChartSeriesKey = 'investment' | 'renewalCost' | 'revenue' | 'realizedPnL';
  const [hiddenSeries, setHiddenSeries] = useState<Set<ChartSeriesKey>>(() => new Set());
  const toggleSeries = (key: ChartSeriesKey) => {
    setHiddenSeries((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // N 个月窗口（含当前月）。只影响图表的显示范围；事件流计算永远走全量
  // 数据，否则会丢失窗口外的成本基准 / 续费历史 / 跨窗口分期到账。
  const monthsWindow = useMemo(() => {
    switch (selectedTimeframe) {
      case '6M': return 6;
      case '1Y': return 12;
      case '2Y': return 24;
      case '3Y': return 36;
      default: return null; // ALL
    }
  }, [selectedTimeframe]);

  // 关键：所有事件流口径计算都用全量 domains / transactions。
  // 之前用 filteredData 按 domain.purchase_date / tx.date 过滤是错的——
  //   1. 老域名上月卖出：filteredDomains 把 domain 过滤掉了 → 那笔利润全丢
  //   2. cost basis 计算需要域名完整购买/续费历史：filteredTransactions 把
  //      老的 buy/renew tx 过滤掉，cost basis 算成 0 → 利润被严重高估
  //   3. 老域名上月续费：filteredDomains 把 domain 过滤掉 → renewal 事件丢
  //   4. 分期销售 sell.date 在窗口外但已付期到账月在窗口内：filteredData
  //      把 sell tx 过滤掉 → 这些月的 revenue 丢
  //
  // 正确做法：所有 by-month 事件流用全量数据计算，得到完整的 Map<月份, 数值>
  // 再在图表循环里按 monthsToShow 取窗口内的月份显示。

  // 月度入账：分期销售用 expandSellToCashReceipts 按已付期展开到对应月份。
  const monthlyNetInflowByMonth = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of transactions) {
      if (t.type !== 'sell') continue;
      for (const r of expandSellToCashReceipts(t)) {
        map.set(r.monthKey, (map.get(r.monthKey) ?? 0) + r.netAmount);
      }
    }
    return map;
  }, [transactions]);

  // 月度毛额入账：每条 receipt 的 netAmount 按 grossOnTx/netOnTx 比例反推
  // 回毛额。expandSellToCashReceipts 内部以 net 为单位（已扣分摊后的平台费），
  // 这里需要的是「合同毛额按到账月分摊」，所以乘上比例。netOnTx <= 0 的边界
  // case 跳过（理论不会发生—— sellNetUSD 为 0 时 sellGrossUSD 也接近 0，整笔
  // 没有现金流，对总和影响为 0）。
  const monthlyGrossInflowByMonth = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of transactions) {
      if (t.type !== 'sell') continue;
      const netOnTx = sellNetUSD(t);
      const grossOnTx = sellGrossUSD(t);
      if (netOnTx <= 0 || grossOnTx <= 0) continue;
      const grossPerNet = grossOnTx / netOnTx;
      for (const r of expandSellToCashReceipts(t)) {
        map.set(r.monthKey, (map.get(r.monthKey) ?? 0) + r.netAmount * grossPerNet);
      }
    }
    return map;
  }, [transactions]);

  // 已实现盈亏（按到账月）走共享 lib，与 dashboard hero 同源。全量数据。
  const monthlyRealizedPnL = useMemo(
    () => realizedPnLByMonth(domains, transactions),
    [transactions, domains]
  );

  const timeSeriesData: TimeSeriesData[] = useMemo(() => {
    const data: TimeSeriesData[] = [];
    const now = new Date();
    let monthsToShow: number;
    let startDate: Date;

    if (monthsWindow !== null) {
      monthsToShow = monthsWindow;
      startDate = new Date(now.getFullYear(), now.getMonth() - (monthsWindow - 1), 1);
    } else {
      // ALL: 找到最早的数据日期并展开（全量数据）
      monthsToShow = 12;
      const allDates = [
        ...domains.map(d => new Date(d.purchase_date || '')),
        ...transactions.map(t => new Date(t.date))
      ].filter(d => !isNaN(d.getTime()));
      const earliestDate = allDates.length > 0
        ? new Date(Math.min(...allDates.map(d => d.getTime())))
        : new Date(now.getFullYear() - 1, now.getMonth(), 1);
      startDate = new Date(earliestDate.getFullYear(), earliestDate.getMonth(), 1);
      const monthsDiff = (now.getFullYear() - earliestDate.getFullYear()) * 12 + (now.getMonth() - earliestDate.getMonth());
      if (monthsDiff > 12) {
        monthsToShow = monthsDiff + 1;
      }
    }

    // 事件口径：把每笔购买 / 每次续费当成一个 (date, amount) 事件，按月聚合。
    // 续费走 expandRenewalEvents 取 archive + transaction 两类（不含 projected）：
    // chart 只展示历史（≤ now）的实际续费支出。Projected 事件原本是给"未来
    // 续费预测"的，但 chart 只画 ≤ now 的月份，未来 projected 永远画不出来；
    // 而对 stale 域名（status=active 但 expiry 已过）会产生过去时点的 projected
    // 事件——语义上是"漏录的续费记录"，作为一条独立紫色虚线展示反而误导。
    // DomainCard 的 stale 警告 + Renewal Outlook 的"实际"列已经覆盖这个信号。
    // 用全量 domains/transactions 算事件流，避免漏掉窗口外创建但事件落在
    // 窗口内的域名（老域名上月续费等）。事件流出来后按月聚合到 Map，下面
    // 主循环只取窗口内月份显示。
    const renewalActualByMonth = new Map<string, number>();
    for (const d of domains) {
      for (const ev of expandRenewalEvents(d, transactions)) {
        if (ev.date > now) continue;
        const key = ev.date.toISOString().slice(0, 7);
        renewalActualByMonth.set(key, (renewalActualByMonth.get(key) ?? 0) + ev.amount);
      }
    }
    const purchaseEventsByMonth = new Map<string, number>();
    for (const d of domains) {
      if (!d.purchase_date) continue;
      const pd = new Date(d.purchase_date);
      if (Number.isNaN(pd.getTime()) || pd > now) continue;
      const key = pd.toISOString().slice(0, 7);
      const cost = Number(d.purchase_cost) || 0;
      purchaseEventsByMonth.set(key, (purchaseEventsByMonth.get(key) ?? 0) + cost);
    }

    let cumulativeRealizedPnL = 0;
    for (let i = 0; i < monthsToShow; i++) {
      const date = new Date(startDate);
      date.setMonth(date.getMonth() + i);
      const monthKey = date.toISOString().slice(0, 7);

      if (date > now) break;

      const purchaseThisMonth = purchaseEventsByMonth.get(monthKey) ?? 0;
      const renewalCost = renewalActualByMonth.get(monthKey) ?? 0;
      const investment = purchaseThisMonth + renewalCost;

      // 入账：从 monthlyNetInflowByMonth 直接取（已按到账月聚合）。
      const revenue = monthlyNetInflowByMonth.get(monthKey) ?? 0;

      // 月度净现金流 = 本月实收 - 本月花出（买入/续费/平台费）。
      // 流出按 t.date 月份归类：buy/renew/fee 都是一次性付款，不存在分期到账问题。
      const costThisMonth = transactions
        .filter((t) => {
          if (t.type !== 'buy' && t.type !== 'renew' && t.type !== 'fee') return false;
          return new Date(t.date).toISOString().slice(0, 7) === monthKey;
        })
        .reduce((sum, t) => sum + t.amount, 0);
      const monthlyCashFlow = revenue - costThisMonth;

      // 累计已实现盈亏：每笔出售的 (sellNet − cost basis at sale) 按到账月分摊后
      // 累加。持有未卖的域名既不进分子也不进分母，所以这条线只在卖出时才动。
      cumulativeRealizedPnL += monthlyRealizedPnL.get(monthKey) ?? 0;

      data.push({
        date: monthKey,
        investment,
        renewalCost,
        revenue,
        realizedPnL: cumulativeRealizedPnL,
        monthlyCashFlow
      });
    }

    return data;
  }, [domains, transactions, monthsWindow, monthlyNetInflowByMonth, monthlyRealizedPnL]);

  // KPI 5 项全部跟随时间窗口。Investment / Renewal Cost 直接对 timeSeriesData
  // 求和（保证 KPI 数值 = 用户在 chart 可见区间上看到的总和）。Realized P&L
  // 单独算累计（按到账月落入窗口的部分相加，跟图表黄线最右端对齐）；
  // Annualized Return 走 annualizedRealizedReturn 的 windowed 口径。
  // Total Sales 用 monthlyGrossInflowByMonth 按窗口月份累加（毛额，跟 chart
  // emerald net 不直接对齐，提供「合同 vs 净到账」的对比维度）。
  const portfolioMetrics: PortfolioMetrics = useMemo(() => {
    const now = new Date();
    const startMonth =
      monthsWindow !== null
        ? new Date(now.getFullYear(), now.getMonth() - (monthsWindow - 1), 1)
        : null;
    const inWindow = (key: string): boolean => {
      if (startMonth === null) return true;
      const [yearStr, monthStr] = key.split('-');
      const year = Number(yearStr);
      const month = Number(monthStr);
      if (!Number.isFinite(year) || !Number.isFinite(month)) return false;
      const d = new Date(year, month - 1, 1);
      return d >= startMonth && d <= now;
    };

    let realizedPnL = 0;
    for (const [key, v] of monthlyRealizedPnL) {
      if (inWindow(key)) realizedPnL += v;
    }

    let grossSales = 0;
    for (const [key, v] of monthlyGrossInflowByMonth) {
      if (inWindow(key)) grossSales += v;
    }

    let investment = 0;
    let renewalCost = 0;
    for (const row of timeSeriesData) {
      investment += row.investment;
      renewalCost += row.renewalCost;
    }

    return {
      realizedPnL,
      annualizedReturn: annualizedRealizedReturn(domains, transactions, monthsWindow),
      investment,
      renewalCost,
      grossSales,
    };
  }, [domains, transactions, monthlyRealizedPnL, monthlyGrossInflowByMonth, monthsWindow, timeSeriesData]);

  const renderPortfolioMetrics = () => {
    if (domains.length === 0 && transactions.length === 0) {
      return (
        <div className="bg-white rounded-2xl border border-stone-200/80 p-6 shadow-sm">
          <div className="flex flex-col items-center justify-center py-12 text-stone-500">
            <BarChart3 className="h-16 w-16 text-stone-300 mb-4" />
            <p className="text-lg font-medium text-stone-600 mb-2">{t('analytics.noDataAvailable')}</p>
            <p className="text-sm text-stone-400">{t('analytics.noDataMessage')}</p>
          </div>
        </div>
      );
    }

    // 统一数字渲染：带正负号 / 带颜色（盈利绿、亏损玫红、零灰）。
    const formatSigned = (n: number) =>
      `${n > 0 ? '+' : n < 0 ? '−' : ''}$${Math.abs(n).toLocaleString()}`;
    const signValueColor = (n: number) =>
      n > 0 ? 'text-emerald-700' : n < 0 ? 'text-rose-700' : 'text-stone-900';
    const signIconBg = (n: number) =>
      n > 0
        ? 'bg-emerald-50 text-emerald-700'
        : n < 0
          ? 'bg-rose-50 text-rose-700'
          : 'bg-stone-100 text-stone-700';

    const annualized = portfolioMetrics.annualizedReturn;

    type Tile = {
      key: string;
      label: string;
      tooltip?: string;
      icon: React.ReactNode;
      iconBg: string;
      value: React.ReactNode;
    };

    // 顺序：outcomes（PnL / 年化）→ inputs（Investment / Renewal Cost）→ output
    // （Total Sales 毛额）。颜色：investment=indigo / renewalCost=purple 跟 chart
    // legend 对应；Total Sales 用 emerald 表示收入（虽然没在 chart 上直接画，
    // 但跟用户的"销售额=正面"心智模型一致）。
    const tiles: Tile[] = [
      {
        key: 'realizedPnL',
        label: t('analytics.realizedPnL'),
        tooltip: t('analytics.netProfitCalculation'),
        icon: <Wallet className="h-5 w-5" />,
        iconBg: signIconBg(portfolioMetrics.realizedPnL),
        value: (
          <span className={`tabular-nums ${signValueColor(portfolioMetrics.realizedPnL)}`}>
            {formatSigned(portfolioMetrics.realizedPnL)}
          </span>
        ),
      },
      {
        key: 'annualizedReturn',
        label: t('analytics.annualizedReturn'),
        tooltip: t('analytics.annualizedReturnDesc'),
        icon: <CalendarClock className="h-5 w-5" />,
        iconBg: 'bg-amber-50 text-amber-700',
        value: annualized === null ? (
          <span className="text-stone-300">—</span>
        ) : (
          <span className={`tabular-nums ${annualized >= 0 ? 'text-stone-900' : 'text-rose-700'}`}>
            {annualized >= 0 ? '+' : ''}{annualized.toFixed(1)}%
          </span>
        ),
      },
      {
        key: 'investment',
        label: t('analytics.investment'),
        icon: <ShoppingCart className="h-5 w-5" />,
        iconBg: 'bg-indigo-50 text-indigo-700',
        value: (
          <span className="tabular-nums text-stone-900">
            ${portfolioMetrics.investment.toLocaleString()}
          </span>
        ),
      },
      {
        key: 'renewalCost',
        label: t('analytics.renewalCost'),
        icon: <RefreshCw className="h-5 w-5" />,
        iconBg: 'bg-purple-50 text-purple-700',
        value: (
          <span className="tabular-nums text-stone-900">
            ${portfolioMetrics.renewalCost.toLocaleString()}
          </span>
        ),
      },
      {
        key: 'grossSales',
        label: t('financial.totalSales'),
        tooltip: t('financial.totalSalesDesc'),
        icon: <Coins className="h-5 w-5" />,
        iconBg: 'bg-emerald-50 text-emerald-700',
        value: (
          <span className="tabular-nums text-emerald-700">
            ${portfolioMetrics.grossSales.toLocaleString()}
          </span>
        ),
      },
    ];

    return (
      <div className="relative overflow-hidden rounded-3xl border border-stone-200/60 bg-gradient-to-br from-stone-50 via-white to-teal-50/30 shadow-sm">
        <div className="pointer-events-none absolute -top-16 -right-16 h-44 w-44 rounded-full bg-gradient-to-br from-teal-100/30 to-transparent blur-3xl" />
        <div className="relative grid grid-cols-2 gap-5 p-5 sm:p-6 md:grid-cols-3 md:gap-6 lg:grid-cols-5">
          {tiles.map((tile) => (
            <div key={tile.key} className="flex items-start gap-3">
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tile.iconBg}`}>
                {tile.icon}
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-1">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-500">
                    {tile.label}
                  </p>
                  {tile.tooltip ? <InfoTooltip text={tile.tooltip} /> : null}
                </div>
                <p className="mt-1 text-xl font-bold tracking-tight">{tile.value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderPerformanceChart = () => {
    if (timeSeriesData.length === 0) {
      return (
        <div className="bg-white rounded-2xl border border-stone-200/80 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-stone-900 mb-4">{t('analytics.portfolioPerformance')}</h3>
          <div className="flex flex-col items-center justify-center py-12 text-stone-500">
            <BarChart3 className="h-12 w-12 text-stone-300 mb-4" />
            <p className="text-stone-600">{t('analytics.noChartData')}</p>
            <p className="text-sm text-stone-400 mt-2">{t('analytics.noChartDataMessage')}</p>
          </div>
        </div>
      );
    }

    // Legend 的 4 条数据系列定义。每项是一个可点击 chip——点击切换隐藏。
    // 隐藏时整个 chip 变浅 + 文字穿过，再点恢复。Recharts 自带的底部 Legend
    // 已删除（之前两个 legend 视觉冗余）。
    const seriesItems: Array<{
      key: ChartSeriesKey;
      label: string;
      swatch: 'block' | 'dash';
      color: string;
    }> = [
      { key: 'investment',  label: t('analytics.investment'),  swatch: 'block', color: 'bg-indigo-500' },
      { key: 'renewalCost', label: t('analytics.renewalCost'), swatch: 'dash',  color: 'bg-purple-500' },
      { key: 'revenue',     label: t('analytics.revenue'),     swatch: 'block', color: 'bg-emerald-500' },
      { key: 'realizedPnL', label: t('analytics.realizedPnL'), swatch: 'block', color: 'bg-amber-500' },
    ];

    return (
      <div className="bg-white rounded-2xl border border-stone-200/80 p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
          <h3 className="text-lg font-semibold text-stone-900">{t('analytics.portfolioPerformance')}</h3>
          <div className="flex flex-wrap items-center gap-2 text-xs text-stone-600">
            {seriesItems.map((s) => {
              const hidden = hiddenSeries.has(s.key);
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => toggleSeries(s.key)}
                  aria-pressed={!hidden}
                  className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-1 ${
                    hidden
                      ? 'border-stone-200 bg-stone-50 text-stone-400 line-through'
                      : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300'
                  }`}
                >
                  <span
                    className={`${
                      s.swatch === 'block' ? 'h-3 w-3' : 'h-1 w-3'
                    } rounded ${s.color} ${hidden ? 'opacity-40' : ''}`}
                  />
                  <span>{s.label}</span>
                </button>
              );
            })}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={400}>
          <AreaChart
            data={timeSeriesData}
            margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="colorInvestment" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorPortfolio" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12, fill: '#78716c' }}
              tickFormatter={(value) => {
                const date = new Date(value);
                return `${date.getMonth() + 1}/${date.getFullYear()}`;
              }}
              stroke="#a8a29e"
            />
            <YAxis
              tick={{ fontSize: 12, fill: '#78716c' }}
              tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
              stroke="#a8a29e"
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                border: '1px solid #e7e5e4',
                borderRadius: '8px',
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
              }}
              cursor={{ stroke: '#6366f1', strokeWidth: 2 }}
              formatter={(value, name) => [
                `$${Number(value).toLocaleString()}`,
                name,
              ]}
              labelFormatter={(value) => {
                const date = new Date(value);
                return date.toLocaleDateString(locale === 'zh' ? 'zh-CN' : 'en-US', { year: 'numeric', month: 'long' });
              }}
            />
            <Area
              type="monotone"
              dataKey="investment"
              stroke="#6366f1"
              fill="url(#colorInvestment)"
              strokeWidth={2}
              name={t('analytics.investment')}
              activeDot={{ r: 6, fill: '#6366f1' }}
              hide={hiddenSeries.has('investment')}
            />
            <Line
              type="monotone"
              dataKey="renewalCost"
              stroke="#a855f7"
              strokeWidth={2}
              strokeDasharray="4 3"
              dot={false}
              name={t('analytics.renewalCost')}
              activeDot={{ r: 5, fill: '#a855f7' }}
              hide={hiddenSeries.has('renewalCost')}
            />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="#10b981"
              fill="url(#colorRevenue)"
              strokeWidth={2}
              name={t('analytics.revenue')}
              activeDot={{ r: 6, fill: '#10b981' }}
              hide={hiddenSeries.has('revenue')}
            />
            <Line
              type="monotone"
              dataKey="realizedPnL"
              stroke="#f59e0b"
              fill="url(#colorPortfolio)"
              strokeWidth={3}
              name={t('analytics.realizedPnL')}
              dot={{ r: 4, fill: '#f59e0b' }}
              activeDot={{ r: 8, fill: '#f59e0b' }}
              hide={hiddenSeries.has('realizedPnL')}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    );
  };

  // 计算域名后缀分布
  const domainSuffixAnalysis = useMemo(() => {
    // 提取域名后缀
    const extractSuffix = (domainName: string): string => {
      const parts = domainName.split('.');
      return parts.length > 1 ? parts[parts.length - 1] : 'unknown';
    };

    // 持有域名后缀分布——portfolio 当前组成，跟时间窗口无关，用全量 domains。
    const heldDomains = domains.filter(d => d.status === 'active' || d.status === 'for_sale');
    const heldSuffixCount: { [key: string]: number } = {};
    heldDomains.forEach(domain => {
      const suffix = extractSuffix(domain.domain_name);
      heldSuffixCount[suffix] = (heldSuffixCount[suffix] || 0) + 1;
    });

    const heldSuffixData = Object.entries(heldSuffixCount)
      .map(([suffix, count]) => ({
        name: `.${suffix}`,
        value: count,
        percentage: heldDomains.length > 0 ? (count / heldDomains.length) * 100 : 0
      }))
      .sort((a, b) => b.value - a.value);

    return {
      heldSuffixData,
      totalHeld: heldDomains.length
    };
  }, [domains]);

  // 按当前持有域名统计注册商分布（active + for_sale）。同样用全量 domains。
  const registrarAnalysis = useMemo(() => {
    const heldDomains = domains.filter(
      (d) => d.status === 'active' || d.status === 'for_sale'
    );
    const registrarCount: { [key: string]: number } = {};
    heldDomains.forEach((domain) => {
      const registrar = (domain.registrar || '').trim() || t('analytics.unknownRegistrar');
      registrarCount[registrar] = (registrarCount[registrar] || 0) + 1;
    });

    const data = Object.entries(registrarCount)
      .map(([name, value]) => ({
        name,
        value,
        percentage: heldDomains.length > 0 ? (value / heldDomains.length) * 100 : 0,
      }))
      .sort((a, b) => b.value - a.value);

    return { data, totalHeld: heldDomains.length };
  }, [domains, t]);

  const renderMonthlyCashFlow = () => (
    <div className="bg-white rounded-2xl border border-stone-200/80 p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-stone-900 mb-4">{t('analytics.monthlyCashFlowTrend')}</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={timeSeriesData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis tickFormatter={(value) => `$${Number(value).toLocaleString()}`} />
          <Tooltip
            formatter={(value) => [
              `$${Number(value).toLocaleString()}`,
              t('analytics.monthlyCashFlow'),
            ]}
          />
          <Bar
            dataKey="monthlyCashFlow"
            name={t('analytics.monthlyCashFlow')}
          >
            {timeSeriesData.map((entry, index) => (
              <Cell
                key={`cashflow-${index}`}
                fill={entry.monthlyCashFlow >= 0 ? '#10b981' : '#fb7185'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );

  const renderDistribution = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-stone-200/80 p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-stone-900 mb-4">{t('analytics.heldDomainSuffix')}</h3>
        {domainSuffixAnalysis.heldSuffixData.length > 0 ? (
          <div className="space-y-4">
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={domainSuffixAnalysis.heldSuffixData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {domainSuffixAnalysis.heldSuffixData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={CHART_PALETTE[index % CHART_PALETTE.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value, name) => [`${value}${t('analytics.countUnit')}`, name]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2">
              <h4 className="font-medium text-stone-700">{t('analytics.detailedStats')}</h4>
              {domainSuffixAnalysis.heldSuffixData.slice(0, 5).map((suffix, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-stone-50 rounded">
                  <span className="text-sm font-medium">{suffix.name}</span>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-stone-600">{suffix.value}{t('analytics.countUnit')}</span>
                    <span className="text-xs text-stone-500">({suffix.percentage.toFixed(1)}%)</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-stone-500">
            <Globe className="h-12 w-12 mx-auto mb-4 text-stone-300" />
            <p>{t('analytics.noHeldDomains')}</p>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-stone-200/80 p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-stone-900 mb-4">{t('analytics.investmentDistribution')}</h3>
        {(() => {
          // Status palette aligned with Hero composition donut + DomainCard/Table:
          // active=teal-600 / for_sale=amber-500 / sold=emerald-500 / expired=rose-400.
          // 全量 domains—portfolio 状态分布跟时间窗口无关。
          const statusData = [
            { name: t('analytics.activeDomains'), value: domains.filter(d => d.status === 'active').length, color: '#0d9488' },
            { name: t('analytics.forSaleDomains'), value: domains.filter(d => d.status === 'for_sale').length, color: '#f59e0b' },
            { name: t('analytics.soldDomains'), value: domains.filter(d => d.status === 'sold').length, color: '#10b981' },
            { name: t('analytics.expiredDomains'), value: domains.filter(d => d.status === 'expired').length, color: '#fb7185' },
          ].filter(entry => entry.value > 0);
          if (statusData.length === 0) {
            return (
              <div className="flex flex-col items-center justify-center py-12 text-stone-500">
                <Globe className="h-12 w-12 text-stone-300 mb-3" />
                <p className="text-sm">{t('analytics.noDataAvailable')}</p>
              </div>
            );
          }
          return (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(Number(percent) * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          );
        })()}
      </div>

      <div className="bg-white rounded-2xl border border-stone-200/80 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-stone-900">{t('analytics.registrarDistribution')}</h3>
          <span className="text-xs text-stone-500">
            {t('analytics.domainsCount')}: {registrarAnalysis.totalHeld}
          </span>
        </div>
        {registrarAnalysis.data.length > 0 ? (
          <div className="space-y-2">
            {registrarAnalysis.data.slice(0, 12).map((item, index) => (
              <div key={`${item.name}-${index}`} className="flex items-center justify-between p-3 bg-stone-50 rounded-xl">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-stone-900 truncate">{item.name}</p>
                  <div className="mt-1 h-2 bg-stone-200 rounded-full overflow-hidden">
                    <div className="h-full bg-teal-500 rounded-full" style={{ width: `${item.percentage}%` }} />
                  </div>
                </div>
                <div className="ml-3 text-right shrink-0">
                  <p className="text-sm font-semibold text-stone-800">{item.value}{t('analytics.countUnit')}</p>
                  <p className="text-xs text-stone-500">{item.percentage.toFixed(1)}%</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-stone-500">
            <Building2 className="h-12 w-12 mx-auto mb-4 text-stone-300" />
            <p>{t('analytics.noRegistrarData')}</p>
          </div>
        )}
      </div>
    </div>
  );

  const getTimeframeText = () => t(`analytics.timeframe.${selectedTimeframe}`);

  return (
    <div className="space-y-6">
      {/* 标题 + 时间范围选择器 */}
      <div className="bg-white rounded-2xl border border-stone-200/80 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-stone-900">{t('analytics.title')}</h3>
            <p className="text-sm text-stone-500 mt-1">
              {t('analytics.dataRange')}: <span className="font-medium text-stone-700">{getTimeframeText()}</span>
            </p>
          </div>
          <select
            value={selectedTimeframe}
            onChange={(e) => setSelectedTimeframe(e.target.value as '6M' | '1Y' | '2Y' | '3Y' | 'ALL')}
            className="px-3 py-2 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-400"
          >
            <option value="6M">{t('analytics.timeframe.6M')}</option>
            <option value="1Y">{t('analytics.timeframe.1Y')}</option>
            <option value="2Y">{t('analytics.timeframe.2Y')}</option>
            <option value="3Y">{t('analytics.timeframe.3Y')}</option>
            <option value="ALL">{t('analytics.timeframe.ALL')}</option>
          </select>
        </div>
      </div>

      {renderPortfolioMetrics()}
      {renderPerformanceChart()}
      {renderMonthlyCashFlow()}
      {renderDistribution()}
    </div>
  );
}
