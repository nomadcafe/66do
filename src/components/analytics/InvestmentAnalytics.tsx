'use client';

import React, { useState, useMemo } from 'react';
import { expandSellToCashReceipts } from '../../lib/coreCalculations';
import { sellGrossUSD, sellNetUSD } from '../../lib/sellProceeds';
import { realizedPnLByMonth } from '../../lib/realizedPnL';
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
  ReferenceLine,
} from 'recharts';
import {
  BarChart3,
  Globe,
  Info,
  Wallet,
  Building2,
  RefreshCw,
  ShoppingCart,
  Coins,
} from 'lucide-react';
import { computeMonthlyOutflow } from '../../lib/monthlyOutflow';
import { totalHoldingCostForDomain } from '../../lib/renewalCostBasis';
import { formatCurrency } from '../../lib/financialCalculations';
import { localMonthKey, parseLocalCalendarDate, parseLocalMonthKey } from '../../lib/localCalendarDate';

interface InvestmentAnalyticsProps {
  domains: DomainWithTags[];
  transactions: TransactionWithRequiredFields[];
  // 'analysis' = KPI tiles + perf chart + monthly cashflow（业绩视角，跟时间窗口
  // 联动），'distribution' = 三张持仓分布（Suffix / Investment / Registrar，
  // 跟时间窗口无关）。Insights 把这两类拆到 Performance vs Portfolio 子 tab
  // 后用同一个组件按 section 渲染对应块。
  section?: 'analysis' | 'distribution';
}

// 4 个 KPI tile，全部跟随时间窗口选择器。
//   - Realized P&L :chart 黄线在窗口的累计
//   - Investment   :chart indigo 区域窗口求和
//   - Renewal Cost :chart 紫线窗口求和（Investment 的子集）
//   - Total Sales  :按到账月展开 gross 后窗口求和
// Annualized Return 已撤除：域名销售样本稀疏 + cost basis 偶现极小（免费 / $1
// 抢注）让 (1+ROI)^(1/years) 的指数推算极易爆炸（实测见过 +4M%）。同样的
// 数学前提失效问题在 Sharpe Ratio 早就让其被砍掉。改用 Performance hero
// 的 lifetime Net Profit / Realized ROI 表达"长期收益"。
interface PortfolioMetrics {
  realizedPnL: number;
  investment: number;
  renewalCost: number;
  grossSales: number;
}

interface TimeSeriesData {
  date: string;
  investment: number;        // 单月新增 cost basis（buy + 实际续费 archive/tx）
  renewalCost: number;       // investment 里归属于「实际续费」的部分（archive + tx，不含 projected）
  revenue: number;           // 单月净入账（分期销售按到账月展开）—— 给 monthlyCashFlow 用，不画
  grossSales: number;        // 单月毛额入账（分期销售按到账月展开）—— Performance chart 绿色 area
  realizedPnL: number;       // 累计已实现盈亏：每笔出售 (sellNet − cost basis at sale)，按到账月分摊
  monthlyCashFlow: number;   // 给月度净现金流图用，本图不画
  purchase: number;          // investment 里归属于「购入」的部分 = investment − renewalCost
  otherOutflow: number;      // 其余运营支出（fee / transfer / marketing / advertising）
  // 以下三项是上面对应字段在窗口内的累计值，给 Portfolio Performance 用。
  // 那张图原先三条月度流量 + 一条累计存量共用一个 Y 轴：累计线只涨不跌、
  // 没有上限，轴的上限被它拉到几万之后，月度那三条被压在底部几个百分点里，
  // 数据越多越不可读。四条统一成累计就同量级、可比了；月度明细由下面那张
  // 净现金流图负责（它的 tooltip 还能拆出购入/续费/其他）。
  //
  // 口径是「窗口内累计」而不是「开天辟地以来累计」——realizedPnL 本来就是
  // 这么算的，上方 KPI 条也明确按可见区间求和，三者必须对得上。
  cumInvestment: number;
  cumRenewalCost: number;
  cumGrossSales: number;
}

/**
 * Portfolio Performance 四条序列的配色。
 *
 * 原来是 indigo #6366f1 / purple #a855f7 / emerald #10b981 / amber #f59e0b。
 * indigo 和 purple 这一对在 protan 模拟下色差 ΔE 只有 0.9，**正常色觉下也
 * 只有 11.3**（低于 15 的下限，即「满色觉的人也难以分辨」）—— 也就是说
 * 「投入」和「续费成本」这两条线，谁都看不出区别，只能靠续费那条是虚线。
 *
 * 换成这一组后，按折线图该用的 all-pairs 口径（线会交叉，不止相邻两两比）
 * 全部通过：最差一对正常色觉 ΔE 16.3、CVD 9.1。语义也尽量留住了——
 * 出售仍是绿系，已实现盈亏仍是黄系。
 */
const SERIES_INVESTMENT = '#2a78d6';
const SERIES_RENEWAL = '#4a3aa7';
const SERIES_SALES = '#1baf7a';
const SERIES_PNL = '#eda100';

/** 净现金流的正负配色。原来是 #10b981 / #fb7185 —— 在红绿色盲（deutan）下
 *  两者色差只有 ΔE 3.9，等于没区分；换成这一对后是 8.6，且都过 3:1 对比度。
 *  仍然是财务界通用的绿进红出，没有改变语义。 */
const CASHFLOW_IN = '#047857';
const CASHFLOW_OUT = '#dc2626';

/** 净现金流图的 tooltip：单看一根柱子只知道「这个月净流出 $1,200」，答不出
 *  「因为买了域名还是因为续费」。三类流出的数已经在 timeSeriesData 里了，摊开给用户看。
 *
 *  定义在模块作用域而不是组件体内：写在组件里每次 render 都是一个新的组件类型，
 *  Recharts 会把 tooltip 整个卸载重建，移动鼠标时会闪。 */
export function CashFlowTooltip({
  active,
  payload,
  t,
  monthLabel,
}: {
  active?: boolean;
  payload?: Array<{ payload: TimeSeriesData }>;
  t: (key: string) => string;
  monthLabel: (key: string) => string;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const rows = [
    { label: t('analytics.cashFlowInflow'), value: d.revenue },
    { label: t('analytics.cashFlowPurchase'), value: -d.purchase },
    { label: t('analytics.renewalCost'), value: -d.renewalCost },
    { label: t('analytics.cashFlowOtherOutflow'), value: -d.otherOutflow },
  ].filter((r) => r.value !== 0);

  return (
    <div className="rounded-lg border border-stone-200 bg-white/95 px-3 py-2 shadow-lg">
      <p className="text-xs font-medium text-stone-900">{monthLabel(d.date)}</p>
      {rows.length === 0 ? (
        <p className="mt-1.5 text-xs text-stone-500">{t('analytics.cashFlowNoMovement')}</p>
      ) : (
        <>
          <dl className="mt-1.5 space-y-0.5">
            {rows.map((r) => (
              <div key={r.label} className="flex items-baseline justify-between gap-6 text-xs">
                <dt className="text-stone-500">{r.label}</dt>
                <dd className="tabular-nums text-stone-700">
                  {r.value > 0 ? '+' : '−'}
                  {formatCurrency(Math.abs(r.value), 'USD')}
                </dd>
              </div>
            ))}
          </dl>
          <div className="mt-1.5 flex items-baseline justify-between gap-6 border-t border-stone-200 pt-1.5 text-xs">
            <dt className="font-medium text-stone-900">{t('analytics.monthlyCashFlow')}</dt>
            <dd
              className={`tabular-nums font-semibold ${
                d.monthlyCashFlow >= 0 ? 'text-emerald-700' : 'text-red-600'
              }`}
            >
              {d.monthlyCashFlow >= 0 ? '+' : '−'}
              {formatCurrency(Math.abs(d.monthlyCashFlow), 'USD')}
            </dd>
          </div>
        </>
      )}
    </div>
  );
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

export default function InvestmentAnalytics({
  domains,
  transactions,
  section = 'analysis',
}: InvestmentAnalyticsProps) {
  const { t, locale } = useI18nContext();
  const [selectedTimeframe, setSelectedTimeframe] = useState<'6M' | '1Y' | '2Y' | '3Y' | 'ALL'>('ALL');

  // 图表 4 条数据系列的显隐开关——legend 上点击切换，hide=true 时 Recharts
  // 不渲染该 series。默认全亮；用户主动隐藏后保留在本 component 生命周期内。
  // grossSales 而不是 revenue（净入账）：跟上面 KPI tile 的 Total Sales 同源，
  // 避免 chart 绿线和上面绿色 KPI 数字差一截（差值 = 平台费）让用户困惑。
  type ChartSeriesKey = 'investment' | 'renewalCost' | 'grossSales' | 'realizedPnL';
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
        ...domains.map(d => parseLocalCalendarDate(d.purchase_date)),
        ...transactions.map(t => parseLocalCalendarDate(t.date))
      ].filter((d): d is Date => d !== null);
      const earliestDate = allDates.length > 0
        ? new Date(Math.min(...allDates.map(d => d.getTime())))
        : new Date(now.getFullYear() - 1, now.getMonth(), 1);
      startDate = new Date(earliestDate.getFullYear(), earliestDate.getMonth(), 1);
      const monthsDiff = (now.getFullYear() - earliestDate.getFullYear()) * 12 + (now.getMonth() - earliestDate.getMonth());
      if (monthsDiff > 12) {
        monthsToShow = monthsDiff + 1;
      }
    }

    // 三类流出（购入 / 续费 / 其余运营支出）全部走 computeMonthlyOutflow，口径
    // 在那里统一定义，并与年度现金流表（calculateYearlyRenewalVsProfit）对拍，
    // 保证同一屏上的年表、投资线、现金流图不会再各说各话。
    //
    // 传全量 domains/transactions（而不是按窗口过滤过的）：老域名上月续费、
    // 窗口外创建但事件落在窗口内的域名都得算进来。传 now 作上限——chart 只画
    // ≤ now 的月份，未来时点的事件永远画不出来；对 stale 域名（status=active
    // 但 expiry 已过）产生的过去时点 projected 事件，语义上是"漏录的续费"，
    // 画成一条紫线反而误导，所以 computeMonthlyOutflow 本来就不收 projected。
    // DomainCard 的 stale 警告 + Renewal Outlook 的"实际"列已经覆盖那个信号。
    const { purchaseByMonth, renewalByMonth, otherByMonth } = computeMonthlyOutflow(
      domains,
      transactions,
      now
    );

    let cumulativeRealizedPnL = 0;
    let cumInvestment = 0;
    let cumRenewalCost = 0;
    let cumGrossSales = 0;
    for (let i = 0; i < monthsToShow; i++) {
      const date = new Date(startDate);
      date.setMonth(date.getMonth() + i);
      // 桶的 key 必须和 startDate（new Date(y, m, 1)，本地）同为本地口径。
      // 用 toISOString() 读会在正偏移时区把每个桶推回上个月，整个窗口跟着
      // 平移一格（当月画不出来，多画一个更早的月）。
      const monthKey = localMonthKey(date);

      if (date > now) break;

      const purchaseThisMonth = purchaseByMonth.get(monthKey) ?? 0;
      const renewalCost = renewalByMonth.get(monthKey) ?? 0;
      const investment = purchaseThisMonth + renewalCost;

      // 入账：从 monthlyNetInflowByMonth 直接取（已按到账月聚合）。
      const revenue = monthlyNetInflowByMonth.get(monthKey) ?? 0;
      const grossSales = monthlyGrossInflowByMonth.get(monthKey) ?? 0;

      // 月度净现金流 = 本月实收 − 本月花出。流出与上面那条投资线同源：
      // 购入（canonical 口径）+ 续费（事件流，含档案续费）+ 其余运营支出。
      // 之前这里按 CASH_OUTFLOW_TYPES 直接扫交易，于是只认 renew 交易、
      // 漏掉档案续费，也不认 purchase_cost 兜底——上下两张图对同一批数据
      // 给出不同的支出。流出按 t.date 月份归类：都是一次性付款，不存在
      // 分期到账问题。
      const otherOutflow = otherByMonth.get(monthKey) ?? 0;
      const costThisMonth = investment + otherOutflow;
      const monthlyCashFlow = revenue - costThisMonth;

      // 累计已实现盈亏：每笔出售的 (sellNet − cost basis at sale) 按到账月分摊后
      // 累加。持有未卖的域名既不进分子也不进分母，所以这条线只在卖出时才动。
      cumulativeRealizedPnL += monthlyRealizedPnL.get(monthKey) ?? 0;
      cumInvestment += investment;
      cumRenewalCost += renewalCost;
      cumGrossSales += grossSales;

      data.push({
        date: monthKey,
        investment,
        renewalCost,
        revenue,
        grossSales,
        realizedPnL: cumulativeRealizedPnL,
        monthlyCashFlow,
        // 净现金流图的 tooltip 要能回答「这个月为什么是负的」，三类流出
        // 本来就算出来了，以前只是没往下传。
        purchase: purchaseThisMonth,
        otherOutflow,
        cumInvestment,
        cumRenewalCost,
        cumGrossSales
      });
    }

    return data;
  }, [domains, transactions, monthsWindow, monthlyNetInflowByMonth, monthlyGrossInflowByMonth, monthlyRealizedPnL]);

  // KPI 4 项全部跟随时间窗口。Investment / Renewal Cost 直接对 timeSeriesData
  // 求和（保证 KPI 数值 = 用户在 chart 可见区间上看到的总和）。Realized P&L
  // 单独算累计（按到账月落入窗口的部分相加，跟图表黄线最右端对齐）；
  // Total Sales 用 monthlyGrossInflowByMonth 按窗口月份累加，跟 chart 的
  // emerald grossSales area 同源，KPI 数字 = chart 该序列在窗口的求和。
  const portfolioMetrics: PortfolioMetrics = useMemo(() => {
    const now = new Date();
    const startMonth =
      monthsWindow !== null
        ? new Date(now.getFullYear(), now.getMonth() - (monthsWindow - 1), 1)
        : null;
    // ALL 档也必须卡 <= now：图表主循环遇到 date > now 就 break，KPI 若把未来
    // 月份的到账算进去，两个数字就对不上（"图上看不到的钱进了上面的合计"）。
    const inWindow = (key: string): boolean => {
      const d = parseLocalMonthKey(key);
      if (!d) return false;
      if (d > now) return false;
      return startMonth === null || d >= startMonth;
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
      investment,
      renewalCost,
      grossSales,
    };
  }, [monthlyRealizedPnL, monthlyGrossInflowByMonth, monthsWindow, timeSeriesData]);

  // 轴刻度用紧凑格式；两张图共用，避免一张写 $12k、另一张写 $12,345.679。
  // 具体数值（KPI / tooltip / 表格）一律走 formatCurrency。
  const compactUSD = (value: number): string => {
    const n = Number(value) || 0;
    const abs = Math.abs(n);
    if (abs >= 1000) return `${n < 0 ? '−' : ''}$${Math.round(abs / 1000)}k`;
    return `${n < 0 ? '−' : ''}$${Math.round(abs)}`;
  };

  // 'YYYY-MM' → 显示用的月份标签。必须走 parseLocalMonthKey：key 是按本地
  // 取值器生成的，直接 new Date('2026-09') 会被当成 UTC 午夜，在负偏移时区
  // （整个美洲）落回 8 月 31 日，图表每个点的月份标签整体早一格。
  const monthTickLabel = (key: string): string => {
    const d = parseLocalMonthKey(key);
    if (!d) return key;
    return `${d.getMonth() + 1}/${d.getFullYear()}`;
  };
  const monthFullLabel = (key: string): string => {
    const d = parseLocalMonthKey(key);
    if (!d) return key;
    return d.toLocaleDateString(locale === 'zh' ? 'zh-CN' : 'en-US', {
      year: 'numeric',
      month: 'long',
    });
  };

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
      `${n > 0 ? '+' : n < 0 ? '−' : ''}${formatCurrency(Math.abs(n), 'USD')}`;
    const signValueColor = (n: number) =>
      n > 0 ? 'text-emerald-700' : n < 0 ? 'text-rose-700' : 'text-stone-900';
    const signIconBg = (n: number) =>
      n > 0
        ? 'bg-emerald-50 text-emerald-700'
        : n < 0
          ? 'bg-rose-50 text-rose-700'
          : 'bg-stone-100 text-stone-700';

    type Tile = {
      key: string;
      label: string;
      tooltip?: string;
      icon: React.ReactNode;
      iconBg: string;
      value: React.ReactNode;
    };

    // 顺序：outcome（Realized P&L）→ inputs（Investment / Renewal Cost）→
    // output（Total Sales 毛额）。颜色：investment=indigo / renewalCost=purple
    // 跟 chart legend 对应；Total Sales 用 emerald 表示收入。
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
        key: 'investment',
        label: t('analytics.investment'),
        // 这个值 = 购入 + 续费，把右边那块 Renewal Cost 整个包在里面。两块并排
        // 很容易被读成并列项然后相加，所以必须说明白。
        tooltip: t('analytics.investmentIncludesRenewals'),
        icon: <ShoppingCart className="h-5 w-5" />,
        iconBg: 'bg-indigo-50 text-indigo-700',
        value: (
          <span className="tabular-nums text-stone-900">
            {formatCurrency(portfolioMetrics.investment, 'USD')}
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
            {formatCurrency(portfolioMetrics.renewalCost, 'USD')}
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
            {formatCurrency(portfolioMetrics.grossSales, 'USD')}
          </span>
        ),
      },
    ];

    return (
      <div className="relative overflow-hidden rounded-3xl border border-stone-200/60 bg-gradient-to-br from-stone-50 via-white to-teal-50/30 shadow-sm">
        <div className="pointer-events-none absolute -top-16 -right-16 h-44 w-44 rounded-full bg-gradient-to-br from-teal-100/30 to-transparent blur-3xl" />
        <div className="relative grid grid-cols-2 gap-5 p-5 sm:p-6 md:grid-cols-4 md:gap-6">
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
      { key: 'investment',  label: t('analytics.cumulativeInvestment'),  swatch: 'block', color: SERIES_INVESTMENT },
      { key: 'renewalCost', label: t('analytics.cumulativeRenewalCost'), swatch: 'dash',  color: SERIES_RENEWAL },
      { key: 'grossSales',  label: t('analytics.cumulativeSales'),       swatch: 'block', color: SERIES_SALES },
      { key: 'realizedPnL', label: t('analytics.realizedPnL'),           swatch: 'block', color: SERIES_PNL },
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
                    } rounded ${hidden ? 'opacity-40' : ''}`}
                    style={{ backgroundColor: s.color }}
                  />
                  <span>{s.label}</span>
                </button>
              );
            })}
          </div>
        </div>
        <p className="text-sm text-stone-500 leading-relaxed mb-4">
          {t('analytics.portfolioPerformanceDesc')}
        </p>
        <ResponsiveContainer width="100%" height={400}>
          <AreaChart
            data={timeSeriesData}
            margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="colorInvestment" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="{SERIES_INVESTMENT}" stopOpacity={0.8}/>
                <stop offset="95%" stopColor={SERIES_INVESTMENT} stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={SERIES_SALES} stopOpacity={0.8}/>
                <stop offset="95%" stopColor={SERIES_SALES} stopOpacity={0}/>
              </linearGradient>
            </defs>
            {/* 实线：虚线网格会被读成「预测」或「阈值」，这里只是刻度线 */}
            <CartesianGrid stroke="#e7e5e4" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12, fill: '#78716c' }}
              tickFormatter={monthTickLabel}
              stroke="#a8a29e"
            />
            <YAxis
              tick={{ fontSize: 12, fill: '#78716c' }}
              tickFormatter={compactUSD}
              stroke="#a8a29e"
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                border: '1px solid #e7e5e4',
                borderRadius: '8px',
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
              }}
              cursor={{ stroke: '#a8a29e', strokeWidth: 1 }}
              formatter={(value, name) => [formatCurrency(Number(value), 'USD'), name]}
              labelFormatter={(value) => monthFullLabel(String(value))}
            />
            <Area
              type="monotone"
              dataKey="cumInvestment"
              stroke={SERIES_INVESTMENT}
              fill="url(#colorInvestment)"
              strokeWidth={2}
              name={t('analytics.cumulativeInvestment')}
              activeDot={{ r: 6, fill: SERIES_INVESTMENT }}
              hide={hiddenSeries.has('investment')}
            />
            <Line
              type="monotone"
              dataKey="cumRenewalCost"
              stroke={SERIES_RENEWAL}
              strokeWidth={2}
              strokeDasharray="4 3"
              dot={false}
              name={t('analytics.cumulativeRenewalCost')}
              activeDot={{ r: 5, fill: SERIES_RENEWAL }}
              hide={hiddenSeries.has('renewalCost')}
            />
            <Area
              type="monotone"
              dataKey="cumGrossSales"
              stroke={SERIES_SALES}
              fill="url(#colorRevenue)"
              strokeWidth={2}
              name={t('analytics.cumulativeSales')}
              activeDot={{ r: 6, fill: SERIES_SALES }}
              hide={hiddenSeries.has('grossSales')}
            />
            <Line
              type="monotone"
              dataKey="realizedPnL"
              stroke={SERIES_PNL}
              strokeWidth={3}
              name={t('analytics.realizedPnL')}
              // 每个点都画圆点，在 ALL 窗口（三十几个月）下是一条串珠而不是线。
              // 点少时保留，方便对齐月份。
              dot={timeSeriesData.length <= 12 ? { r: 4, fill: SERIES_PNL } : false}
              activeDot={{ r: 8, fill: SERIES_PNL }}
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
    // 没有点的域名没有后缀可言。以前返回硬编码的 'unknown'，再被下面拼成
    // '.unknown' 渲染出去——英文字面量混进中文界面，还带个莫名其妙的前导点。
    // 旁边的注册商分布用的是 t('analytics.unknownRegistrar')，两处对齐。
    // 用一个不可能与真实 TLD 相撞的哨兵，渲染时才翻译
    const NO_SUFFIX = '\u0000no-suffix';
    const extractSuffix = (domainName: string): string => {
      const parts = String(domainName || '').split('.');
      const last = parts.length > 1 ? parts[parts.length - 1] : '';
      return last || NO_SUFFIX;
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
        name: suffix === NO_SUFFIX ? t('analytics.unknownSuffix') : `.${suffix}`,
        value: count,
        percentage: heldDomains.length > 0 ? (count / heldDomains.length) * 100 : 0
      }))
      .sort((a, b) => b.value - a.value);

    return {
      heldSuffixData,
      totalHeld: heldDomains.length
    };
  }, [domains, t]);

  /**
   * 按状态分的**资金**分布。
   *
   * 这块原本画的是 domains.filter(status).length —— 挂着「投资分布」的标题，
   * 内容却是头数，而且和 Hero 上那个 composition 甜甜圈是同一张图（那边的
   * 注释写着「previously this only showed up deep inside InvestmentAnalytics」,
   * 提上去之后这一份忘了删）。Portfolio 这个 sub-tab 另外两张饼也都是数头，
   * 三张个数饼里有一张挂着钱的名字。
   *
   * 现在真的按钱分：每个域名的持有成本（购入 + 续费 + 转移，走
   * totalHoldingCostForDomain 的 canonical 口径）归到它当前的状态桶。
   * active/for_sale = 还压着的资金，sold = 已收回的成本，expired = 沉没成本。
   */
  const capitalByStatus = useMemo(() => {
    const buckets: Record<string, number> = {
      active: 0,
      for_sale: 0,
      sold: 0,
      expired: 0,
    };
    for (const d of domains) {
      if (!(d.status in buckets)) continue;
      buckets[d.status] += totalHoldingCostForDomain(d, transactions);
    }
    const meta: Array<{ status: string; labelKey: string; color: string }> = [
      { status: 'active', labelKey: 'analytics.activeDomains', color: '#0d9488' },
      { status: 'for_sale', labelKey: 'analytics.forSaleDomains', color: '#f59e0b' },
      { status: 'sold', labelKey: 'analytics.soldDomains', color: '#10b981' },
      { status: 'expired', labelKey: 'analytics.expiredDomains', color: '#fb7185' },
    ];
    const data = meta
      .map((m) => ({ name: t(m.labelKey), value: buckets[m.status], color: m.color }))
      .filter((entry) => entry.value > 0);
    return { data, total: data.reduce((sum, e) => sum + e.value, 0) };
  }, [domains, transactions, t]);

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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-1">
        <h3 className="text-lg font-semibold text-stone-900">
          {t('analytics.monthlyCashFlowTrend')}
        </h3>
        {/* 方向不能只靠颜色：红绿在红绿色盲眼里几乎同色，所以图例把
            「净流入 / 净流出」写成字，柱子相对零线的上下位置是第二重编码。 */}
        <div className="flex flex-wrap items-center gap-2 text-xs text-stone-600">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: CASHFLOW_IN }} />
            {t('analytics.cashFlowNetInflow')}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: CASHFLOW_OUT }} />
            {t('analytics.cashFlowNetOutflow')}
          </span>
        </div>
      </div>
      <p className="text-sm text-stone-500 leading-relaxed mb-4">
        {t('analytics.monthlyCashFlowDesc')}
      </p>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={timeSeriesData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          {/* 实线细网格：虚线网格会被读成「预测」或「阈值」，这里只是刻度。
              竖线去掉——时间序列柱状图不需要按月切竖格。 */}
          <CartesianGrid stroke="#e7e5e4" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 12, fill: '#78716c' }}
            tickFormatter={monthTickLabel}
            stroke="#a8a29e"
            minTickGap={24}
          />
          <YAxis
            tick={{ fontSize: 12, fill: '#78716c' }}
            tickFormatter={compactUSD}
            stroke="#a8a29e"
          />
          <Tooltip
            content={<CashFlowTooltip t={t} monthLabel={monthFullLabel} />}
            cursor={{ fill: 'rgba(120,113,108,0.06)' }}
          />
          {/* 零线：正负柱状图没有它就看不出符号在哪翻转，而这恰恰是全图的重点 */}
          <ReferenceLine y={0} stroke="#78716c" strokeWidth={1} />
          <Bar dataKey="monthlyCashFlow" name={t('analytics.monthlyCashFlow')} radius={[2, 2, 0, 0]}>
            {timeSeriesData.map((entry, index) => (
              <Cell
                key={`cashflow-${index}`}
                fill={entry.monthlyCashFlow >= 0 ? CASHFLOW_IN : CASHFLOW_OUT}
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
        <h3 className="text-lg font-semibold text-stone-900">{t('analytics.investmentDistribution')}</h3>
        <p className="mt-1 mb-4 text-sm text-stone-500">
          {t('analytics.investmentDistributionDesc')}
        </p>
        {capitalByStatus.data.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-stone-500">
            <Globe className="h-12 w-12 text-stone-300 mb-3" />
            <p className="text-sm">{t('analytics.noDataAvailable')}</p>
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={capitalByStatus.data}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(Number(percent) * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {capitalByStatus.data.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatCurrency(Number(value), 'USD')} />
              </PieChart>
            </ResponsiveContainer>
            <ul className="mt-2 space-y-1.5">
              {capitalByStatus.data.map((entry) => (
                <li key={entry.name} className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: entry.color }}
                      aria-hidden
                    />
                    <span className="truncate text-stone-700">{entry.name}</span>
                  </span>
                  <span className="shrink-0 tabular-nums font-medium text-stone-900">
                    {formatCurrency(entry.value, 'USD')}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
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

  // section='distribution' → 仅渲染 3 张持仓分布。这些图跟 selectedTimeframe
  // 无关（用全量 domains 计算），所以省掉标题 / 时间窗口 selector / KPI tiles /
  // 业绩 chart / 月度现金流 这些"业绩视角"模块。
  if (section === 'distribution') {
    return renderDistribution();
  }

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
    </div>
  );
}
