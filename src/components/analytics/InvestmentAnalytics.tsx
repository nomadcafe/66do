'use client';

import React, { useState, useMemo } from 'react';
import { useComprehensiveFinancialAnalysis } from '../../hooks/useFinancialCalculations';
import { calculateInvestmentYears, expandSellToCashReceipts } from '../../lib/coreCalculations';
import { realizedPnLByMonth, totalRealizedPnL } from '../../lib/realizedPnL';
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
  Legend
} from 'recharts';
import {
  BarChart3,
  Globe,
  Info,
  Wallet,
  CalendarClock,
  Scale,
  Building2,
} from 'lucide-react';
import { expandRenewalEvents } from '../../lib/expandRenewalEvents';

interface InvestmentAnalyticsProps {
  domains: DomainWithTags[];
  transactions: TransactionWithRequiredFields[];
}

// max-drawdown / volatility 故意不在此列：在域名投资这种稀疏样本上会误导。
// totalProfit 改为 realizedPnL（与 Hero / IA 黄线 / FinancialAnalysisOptimized 同源），
// 旧 basic.totalProfit (= totalRevenue − totalInvestment) 把持有未卖的 cost 也算分母，
// 跟 Realized P&L 数字会不一致，会让用户在不同 surface 看到不同"赚多少"的数字。
interface PortfolioMetrics {
  realizedPnL: number;
  annualizedReturn: number;
  sharpeRatio: number;
  /** 已售域名数量——Sharpe Ratio 在样本 < SHARPE_MIN_SAMPLE 时统计意义不足，
   *  这时显示 "—" 而不是凭虚假精度的数字。 */
  soldCount: number;
}

// Sharpe Ratio 在已售域名 < 10 时基本是噪声（基于波动率，样本太少波动率
// 估计极不稳定）。同文件已经因为这个理由去掉了 max-drawdown / volatility，
// 但 Sharpe 一直保留，逻辑前后不一致。改为 sample 不够时显示 "—"。
const SHARPE_MIN_SAMPLE = 10;

interface TimeSeriesData {
  date: string;
  investment: number;        // 单月新增 cost basis（buy + 实际续费 archive/tx）
  renewalCost: number;       // investment 里归属于「实际续费」的部分（archive + tx，不含 projected）
  renewalCostProjected: number; // 假设域名继续保留时，本月预计的续费支出（不并入 investment）
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

  const investmentYears = useMemo(
    () => calculateInvestmentYears(domains),
    [domains]
  );

  // Sharpe / 年化收益是 lifetime portfolio 指标，永远基于全量数据，
  // 跟时间窗口选择器解耦——窗口选 6M 时这俩指标也展示 lifetime 数字。
  const financialAnalysis = useComprehensiveFinancialAnalysis(domains, transactions);

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

  // 已实现盈亏（按到账月）走共享 lib，与 dashboard hero 同源。全量数据。
  const monthlyRealizedPnL = useMemo(
    () => realizedPnLByMonth(domains, transactions),
    [transactions, domains]
  );

  // KPI strip 的 Realized P&L：当前窗口内月份的累计——跟图表黄线最右端对齐。
  // ALL 时是 lifetime；6M 时是过去 6 个月内已实现的盈亏（一笔老域名上月卖出
  // 的利润会进 6M 窗口；这是用户期望的语义）。
  const portfolioMetrics: PortfolioMetrics = useMemo(() => {
    const soldCount = domains.filter((d) => d.status === 'sold').length;
    let realizedPnL = 0;
    if (monthsWindow === null) {
      for (const v of monthlyRealizedPnL.values()) realizedPnL += v;
    } else {
      const now = new Date();
      const startMonth = new Date(now.getFullYear(), now.getMonth() - (monthsWindow - 1), 1);
      for (const [key, v] of monthlyRealizedPnL) {
        const [yearStr, monthStr] = key.split('-');
        const year = Number(yearStr);
        const month = Number(monthStr);
        if (!Number.isFinite(year) || !Number.isFinite(month)) continue;
        const d = new Date(year, month - 1, 1);
        if (d >= startMonth && d <= now) realizedPnL += v;
      }
    }
    return {
      realizedPnL,
      annualizedReturn: financialAnalysis.advanced.annualizedReturn,
      sharpeRatio: financialAnalysis.advanced.sharpeRatio,
      soldCount,
    };
  }, [domains, financialAnalysis, monthlyRealizedPnL, monthsWindow]);

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
    // 续费走 expandRenewalEvents：archive renewal_count × renewal_cost 的总额按
    // `purchase + i × cycle` 估算到每一年，避免老 holdingCostAsOf 在 baseline 那
    // 一天砸一笔历史续费 lump 让图上看起来"突然支出 $30 后再无支出"。
    // Investment = 当月购买事件 + 当月续费事件，两者来自相同的事件流，
    // 所以 Investment 总能 ≥ Renewal cost，永远不会出现"续费 > 投资"的怪图。
    // Renewal events split by source: archive/tx events count as "actual" cost
    // basis impact, projected events only feed the dotted forecast line on the
    // chart. Projected forecastUntil = today so we never project visible months
    // beyond what the chart covers anyway.
    // 用全量 domains/transactions 算事件流，避免漏掉窗口外创建但事件落在
    // 窗口内的域名（老域名上月续费等）。事件流出来后按月聚合到 Map，下面
    // 主循环只取窗口内月份显示。
    const renewalActualByMonth = new Map<string, number>();
    const renewalProjectedByMonth = new Map<string, number>();
    for (const d of domains) {
      for (const ev of expandRenewalEvents(d, transactions, { forecastUntil: now })) {
        if (ev.date > now) continue;
        const key = ev.date.toISOString().slice(0, 7);
        const target = ev.source === 'projected' ? renewalProjectedByMonth : renewalActualByMonth;
        target.set(key, (target.get(key) ?? 0) + ev.amount);
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
      const renewalCostProjected = renewalProjectedByMonth.get(monthKey) ?? 0;
      // Investment counts only realised events; projected feeds the dotted
      // forecast line on the chart, never the Investment area.
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
        renewalCostProjected,
        revenue,
        realizedPnL: cumulativeRealizedPnL,
        monthlyCashFlow
      });
    }

    return data;
  }, [domains, transactions, monthsWindow, monthlyNetInflowByMonth, monthlyRealizedPnL]);

  // 辅助函数已移至共享计算库

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

    const pnlPositive = portfolioMetrics.realizedPnL > 0;
    const pnlNegative = portfolioMetrics.realizedPnL < 0;
    const pnlPrefix = pnlPositive ? '+' : pnlNegative ? '−' : '';
    const pnlIconBg = pnlPositive
      ? 'bg-emerald-50 text-emerald-700'
      : pnlNegative
        ? 'bg-rose-50 text-rose-700'
        : 'bg-stone-100 text-stone-700';
    const pnlValueColor = pnlPositive
      ? 'text-emerald-700'
      : pnlNegative
        ? 'text-rose-700'
        : 'text-stone-900';

    const sharpeMeaningful = portfolioMetrics.soldCount >= SHARPE_MIN_SAMPLE;
    const sharpeColor =
      portfolioMetrics.sharpeRatio >= 1
        ? 'text-emerald-700'
        : portfolioMetrics.sharpeRatio >= 0.5
          ? 'text-amber-600'
          : 'text-rose-700';

    return (
      <div className="relative overflow-hidden rounded-3xl border border-stone-200/60 bg-gradient-to-br from-stone-50 via-white to-teal-50/30 shadow-sm">
        <div className="pointer-events-none absolute -top-16 -right-16 h-44 w-44 rounded-full bg-gradient-to-br from-teal-100/30 to-transparent blur-3xl" />
        <div className="relative grid grid-cols-1 gap-5 p-5 sm:p-6 md:grid-cols-3 md:gap-6">
          <div className="flex items-start gap-3">
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${pnlIconBg}`}>
              <Wallet className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-500">
                  {t('analytics.realizedPnL')}
                </p>
                <InfoTooltip text={t('analytics.netProfitCalculation')} />
              </div>
              <p className={`mt-1 text-xl font-bold tracking-tight tabular-nums ${pnlValueColor}`}>
                {pnlPrefix}${Math.abs(portfolioMetrics.realizedPnL).toLocaleString()}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
              <CalendarClock className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-500">
                  {t('analytics.annualizedReturn')}
                </p>
                <InfoTooltip text={investmentYears < 1 ? t('analytics.annualizedReturnShortTerm') : t('analytics.annualizedReturnDesc')} />
              </div>
              {investmentYears >= 1 ? (
                <p className="mt-1 text-xl font-bold tracking-tight tabular-nums text-stone-900">
                  {portfolioMetrics.annualizedReturn.toFixed(1)}%
                </p>
              ) : (
                <p className="mt-1 text-xl font-bold tracking-tight text-stone-300">—</p>
              )}
            </div>
          </div>

          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-stone-100 text-stone-700">
              <Scale className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-500">
                  {t('analytics.sharpeRatio')}
                </p>
                <InfoTooltip text={t('analytics.sharpeRatioDesc')} />
              </div>
              {sharpeMeaningful ? (
                <p className={`mt-1 text-xl font-bold tracking-tight tabular-nums ${sharpeColor}`}>
                  {portfolioMetrics.sharpeRatio.toFixed(2)}
                </p>
              ) : (
                <p className="mt-1 text-xl font-bold tracking-tight text-stone-300">—</p>
              )}
            </div>
          </div>
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

    return (
      <div className="bg-white rounded-2xl border border-stone-200/80 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-stone-900">{t('analytics.portfolioPerformance')}</h3>
          <div className="flex items-center gap-4 text-xs text-stone-600">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-indigo-500 rounded"></div>
              <span>{t('analytics.investment')}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-1 bg-purple-500 rounded"></div>
              <span>{t('analytics.renewalCost')}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-1 bg-purple-300 rounded"></div>
              <span>{t('analytics.renewalCostProjected')}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-emerald-500 rounded"></div>
              <span>{t('analytics.revenue')}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-amber-500 rounded"></div>
              <span>{t('analytics.realizedPnL')}</span>
            </div>
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
            />
            <Line
              type="monotone"
              dataKey="renewalCostProjected"
              stroke="#c4b5fd"
              strokeWidth={2}
              strokeDasharray="2 4"
              dot={false}
              name={t('analytics.renewalCostProjected')}
              activeDot={{ r: 5, fill: '#c4b5fd' }}
            />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="#10b981"
              fill="url(#colorRevenue)"
              strokeWidth={2}
              name={t('analytics.revenue')}
              activeDot={{ r: 6, fill: '#10b981' }}
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
            />
            <Legend
              wrapperStyle={{ paddingTop: '20px' }}
              iconType="circle"
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
