'use client';

import React, { useState, useMemo } from 'react';
import { useComprehensiveFinancialAnalysis } from '../../hooks/useFinancialCalculations';
import { calculateInvestmentYears, expandSellToCashReceipts } from '../../lib/coreCalculations';
import { useI18nContext } from '../../contexts/I18nProvider';
import { DomainWithTags, TransactionWithRequiredFields } from '../../types/dashboard';
import {
  LineChart,
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
import { holdingCostAsOf } from '../../lib/renewalCostBasis';

// interface Domain {
//   id: string;
//   domain_name: string;
//   registrar: string;
//   purchase_date: string;
//   purchase_cost: number;
//   renewal_cost: number;
//   renewal_cycle: number;
//   renewal_count: number;
//   expiry_date?: string;
//   status: 'active' | 'for_sale' | 'sold' | 'expired';
//   estimated_value: number;
//   sale_date?: string;
//   sale_price?: number;
//   platform_fee?: number;
//   tags: string[];
// }

// interface Transaction {
//   id: string;
//   domain_id: string;
//   type: 'buy' | 'sell' | 'renew' | 'transfer' | 'fee' | 'marketing' | 'advertising';
//   amount: number;
//   currency: string;
//   date: string;
//   notes: string;
//   platform?: string;
//   platform_fee?: number;
//   platform_fee_percentage?: number;
//   net_amount?: number;
//   category?: string;
//   tax_deductible?: boolean;
//   receipt_url?: string;
// }

interface InvestmentAnalyticsProps {
  domains: DomainWithTags[];
  transactions: TransactionWithRequiredFields[];
}

// 仅保留 IA 还展示的三个深度指标：Investment / Revenue / ROI / Win Rate
// 在 FAO 已经显示，best/worst/holdingPeriod 也在 FAO Snapshot 里，
// max-drawdown/volatility 早被弃用（在稀疏数据上误导）。
interface PortfolioMetrics {
  totalProfit: number;
  annualizedReturn: number;
  sharpeRatio: number;
}

interface TimeSeriesData {
  date: string;
  investment: number;
  revenue: number;
  portfolioValue: number;
  monthlyCashFlow: number;
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

  // 根据选择的时间范围筛选数据
  // N 个月窗口（含当前月）。先前 filter 用 month-6/year-1-same-month 的
  // 写法：6M 变成 7 个月、1Y/2Y/3Y 都多 1 个月，而图表用 month-5+6 iter
  // 的写法确实 6 个月，但 1Y/2Y/3Y 又差 1 —— 结果 KPI 用的筛选窗、图
  // 表展示窗永远不匹配，1Y 模式下用户甚至看不到当前月的柱子/面积。
  // 统一成 "month - (N-1)"，filter 和 timeSeriesData 共用。
  const monthsWindow = useMemo(() => {
    switch (selectedTimeframe) {
      case '6M': return 6;
      case '1Y': return 12;
      case '2Y': return 24;
      case '3Y': return 36;
      default: return null; // ALL
    }
  }, [selectedTimeframe]);

  const filteredData = useMemo(() => {
    if (monthsWindow === null) return { domains, transactions };

    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth() - (monthsWindow - 1), 1);

    const filteredDomains = domains.filter(domain => {
      const domainDate = new Date(domain.purchase_date || '');
      return domainDate >= startDate && domainDate <= now;
    });

    const filteredTransactions = transactions.filter(transaction => {
      const transactionDate = new Date(transaction.date);
      return transactionDate >= startDate && transactionDate <= now;
    });

    return { domains: filteredDomains, transactions: filteredTransactions };
  }, [domains, transactions, monthsWindow]);

  const investmentYears = useMemo(
    () => calculateInvestmentYears(filteredData.domains),
    [filteredData.domains]
  );

  // 使用筛选后的数据计算
  const financialAnalysis = useComprehensiveFinancialAnalysis(filteredData.domains, filteredData.transactions);
  
  const portfolioMetrics: PortfolioMetrics = useMemo(() => ({
    totalProfit: financialAnalysis.basic.totalProfit,
    annualizedReturn: financialAnalysis.advanced.annualizedReturn,
    sharpeRatio: financialAnalysis.advanced.sharpeRatio,
  }), [financialAnalysis]);

  // 计算时间序列数据（基于筛选后的数据和时间范围）。窗口口径与
  // filteredData 保持一致：`monthsWindow` 非 null 时直接使用；ALL 则
  // 根据最早数据日期展开。
  //
  // 月度入账走 expandSellToCashReceipts：分期销售按 t.date + i 个月展开
  // 已付期，避免把 36 个月分期里已付的 3 期都堆在销售当月（旧实现按
  // t.date 月份归类整笔 sell 的 net，柱状图会一蹦到位 + 中间月份全 0，
  // 累计 Revenue 线终值正确但途中失真）。
  const monthlyNetInflowByMonth = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of filteredData.transactions) {
      if (t.type !== 'sell') continue;
      for (const r of expandSellToCashReceipts(t)) {
        map.set(r.monthKey, (map.get(r.monthKey) ?? 0) + r.netAmount);
      }
    }
    return map;
  }, [filteredData.transactions]);

  const timeSeriesData: TimeSeriesData[] = useMemo(() => {
    const data: TimeSeriesData[] = [];
    const now = new Date();
    let monthsToShow: number;
    let startDate: Date;

    if (monthsWindow !== null) {
      monthsToShow = monthsWindow;
      startDate = new Date(now.getFullYear(), now.getMonth() - (monthsWindow - 1), 1);
    } else {
      // ALL: 找到最早的数据日期并展开
      monthsToShow = 12;
      const allDates = [
        ...filteredData.domains.map(d => new Date(d.purchase_date || '')),
        ...filteredData.transactions.map(t => new Date(t.date))
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

    let cumulativeRevenue = 0;
    for (let i = 0; i < monthsToShow; i++) {
      const date = new Date(startDate);
      date.setMonth(date.getMonth() + i);
      const monthKey = date.toISOString().slice(0, 7);

      if (date > now) break;

      // 月末时点（月最后一刻），用于 "截至该月" 的累计计算
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);

      // 用 holdingCostAsOf 按月结存算：已发生的购买/续费才计入，避免
      // 把之后才发生的续费算进历史月份。
      const investment = filteredData.domains.reduce(
        (sum, domain) => sum + holdingCostAsOf(domain, filteredData.transactions, monthEnd),
        0
      );

      // 入账：从 monthlyNetInflowByMonth 直接取（已按到账月聚合）。
      const revenue = monthlyNetInflowByMonth.get(monthKey) ?? 0;

      // 月度净现金流 = 本月实收 - 本月花出（买入/续费/平台费）。
      // 流出按 t.date 月份归类：buy/renew/fee 都是一次性付款，不存在分期到账问题。
      const costThisMonth = filteredData.transactions
        .filter((t) => {
          if (t.type !== 'buy' && t.type !== 'renew' && t.type !== 'fee') return false;
          return new Date(t.date).toISOString().slice(0, 7) === monthKey;
        })
        .reduce((sum, t) => sum + t.amount, 0);
      const monthlyCashFlow = revenue - costThisMonth;

      cumulativeRevenue += revenue;

      // Portfolio value = 已实收 + 持仓 fair value（按月 mark-to-market）。
      // 持仓判定：截至 monthEnd 已购入、未售出、未过期。
      // Fair value：优先 estimated_value；缺失时回退到截至 monthEnd 的 cost basis
      // （永远算得出的保守口径）。已售域名的现金已计入 cumulativeRevenue；
      // 已过期域名按 0（损失沉没，不再贡献价值）。
      const heldValue = filteredData.domains.reduce((sum, d) => {
        if (!d.purchase_date) return sum;
        if (new Date(d.purchase_date) > monthEnd) return sum;
        if (d.status === 'sold' && d.sale_date && new Date(d.sale_date) <= monthEnd) return sum;
        if (d.status === 'expired' && d.expiry_date && new Date(d.expiry_date) <= monthEnd) return sum;

        const fairValue =
          d.estimated_value != null && d.estimated_value > 0
            ? d.estimated_value
            : holdingCostAsOf(d, filteredData.transactions, monthEnd);
        return sum + fairValue;
      }, 0);

      const portfolioValue = cumulativeRevenue + heldValue;

      data.push({
        date: monthKey,
        investment,
        revenue,
        portfolioValue,
        monthlyCashFlow
      });
    }

    return data;
  }, [filteredData, monthsWindow, monthlyNetInflowByMonth]);

  // 辅助函数已移至共享计算库

  const renderPortfolioMetrics = () => {
    if (filteredData.domains.length === 0 && filteredData.transactions.length === 0) {
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

    // Total Investment / Total Revenue / Total Return 三张卡已删：FAO 顶部
    // 4-KPI 已经显示这三个字段（Investment/Revenue/ROI），同屏重复展示让用户
    // 误以为是不同口径。IA 现在只保留 FAO 没有的三个深度指标：Net Profit、
    // Annualized Return、Sharpe Ratio，与 FAO 的 4-KPI 形成"摘要 → 细节"的
    // 互补，而不是平行复读。
    const profitColor = portfolioMetrics.totalProfit >= 0 ? 'text-emerald-700' : 'text-red-600';
    const sharpeColor =
      portfolioMetrics.sharpeRatio >= 1 ? 'text-emerald-700' :
      portfolioMetrics.sharpeRatio >= 0.5 ? 'text-amber-600' : 'text-red-600';

    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-stone-50 rounded-xl p-4 border border-stone-100">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-medium text-stone-600">{t('analytics.netProfit')}</p>
                <InfoTooltip text={t('analytics.netProfitCalculation')} />
              </div>
              <p className={`text-2xl font-bold mt-1 ${profitColor}`}>${portfolioMetrics.totalProfit.toLocaleString()}</p>
              <p className={`text-xs mt-1 ${portfolioMetrics.totalProfit >= 0 ? 'text-emerald-700/70' : 'text-red-500'}`}>
                {portfolioMetrics.totalProfit >= 0 ? t('analytics.performanceRating.profitable') : t('analytics.performanceRating.loss')}
              </p>
            </div>
            <Wallet className="h-8 w-8 text-stone-600 shrink-0" />
          </div>
        </div>

        <div className="bg-stone-50 rounded-xl p-4 border border-stone-100">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-medium text-stone-600">{t('analytics.annualizedReturn')}</p>
                <InfoTooltip text={investmentYears < 1 ? t('analytics.annualizedReturnShortTerm') : t('analytics.annualizedReturnDesc')} />
              </div>
              {investmentYears >= 1 ? (
                <p className="text-2xl font-bold text-stone-900 mt-1">{portfolioMetrics.annualizedReturn.toFixed(1)}%</p>
              ) : (
                <p className="text-sm text-stone-500 mt-2">{t('analytics.annualizedReturnShortTerm')}</p>
              )}
            </div>
            <CalendarClock className="h-8 w-8 text-stone-600 shrink-0" />
          </div>
        </div>

        <div className="bg-stone-50 rounded-xl p-4 border border-stone-100">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-medium text-stone-600">{t('analytics.sharpeRatio')}</p>
                <InfoTooltip text={t('analytics.sharpeRatioDesc')} />
              </div>
              <p className={`text-2xl font-bold mt-1 ${sharpeColor}`}>{portfolioMetrics.sharpeRatio.toFixed(2)}</p>
            </div>
            <Scale className="h-8 w-8 text-stone-600 shrink-0" />
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
              <div className="w-3 h-3 bg-emerald-500 rounded"></div>
              <span>{t('analytics.revenue')}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-amber-500 rounded"></div>
              <span>{t('analytics.portfolioValue')}</span>
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
                name === 'investment' ? t('analytics.investment') :
                name === 'revenue' ? t('analytics.revenue') : t('analytics.portfolioValue')
              ]}
              labelFormatter={(value) => {
                const date = new Date(value);
                return date.toLocaleDateString(locale === 'zh' ? 'zh-CN' : 'en-US', { year: 'numeric', month: 'long' });
              }}
            />
            <Area
              type="monotone"
              dataKey="investment"
              stackId="1"
              stroke="#6366f1"
              fill="url(#colorInvestment)"
              strokeWidth={2}
              name={t('analytics.investment')}
              activeDot={{ r: 6, fill: '#6366f1' }}
            />
            <Area
              type="monotone"
              dataKey="revenue"
              stackId="2"
              stroke="#10b981"
              fill="url(#colorRevenue)"
              strokeWidth={2}
              name={t('analytics.revenue')}
              activeDot={{ r: 6, fill: '#10b981' }}
            />
            <Line
              type="monotone"
              dataKey="portfolioValue"
              stroke="#f59e0b"
              fill="url(#colorPortfolio)"
              strokeWidth={3}
              name={t('analytics.portfolioValue')}
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

    // 持有域名后缀分布（基于筛选后的数据）
    const heldDomains = filteredData.domains.filter(d => d.status === 'active' || d.status === 'for_sale');
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
  }, [filteredData.domains]);

  // 按当前持有域名统计注册商分布（active + for_sale）
  const registrarAnalysis = useMemo(() => {
    const heldDomains = filteredData.domains.filter(
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
  }, [filteredData.domains, t]);

  // 月度净现金流：原本在 Trends 子 tab 里，但属于"时间 × 金额"的月度
  // delta 视角，与 Portfolio 的累计 AreaChart 互补，因此并到主流程紧跟在
  // Performance Chart 之后展示。
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
                fill={entry.monthlyCashFlow >= 0 ? '#10b981' : '#ef4444'}
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
          const statusData = [
            { name: t('analytics.activeDomains'), value: filteredData.domains.filter(d => d.status === 'active').length, color: '#10b981' },
            { name: t('analytics.forSaleDomains'), value: filteredData.domains.filter(d => d.status === 'for_sale').length, color: '#f59e0b' },
            { name: t('analytics.soldDomains'), value: filteredData.domains.filter(d => d.status === 'sold').length, color: '#0d9488' },
            { name: t('analytics.expiredDomains'), value: filteredData.domains.filter(d => d.status === 'expired').length, color: '#ef4444' },
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

  // 时间范围显示文本。旧代码每个 case 都带 `|| '最近6个月'` 之类的中文
  // 兜底，但 analytics.timeframe.* 的 i18n key 都存在，fallback 永远不会
  // 触发，只是把中文硬字串留在了英文代码里。
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
              {selectedTimeframe !== 'ALL' && (
                <span className="ml-2 text-xs text-stone-400">
                  ({filteredData.domains.length} {t('analytics.domainsCount')}, {filteredData.transactions.length} {t('analytics.transactionsCount')})
                </span>
              )}
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

      {/* 单页流：原 Portfolio / Trends 子 tab 已合并 ——
          - Insights tab 内再嵌一层子 tab 是双重导航，反直觉。
          - 去重后 IA 内容已经很瘦（3 KPI + 1 累计图 + 1 月度图 + 3 个分布
            视图），垂直堆叠完全可读。
          - "Trends" 名实不符问题（搬走 Yearly Renewal 表后只剩分布）随子
            tab 一起消失。
          先删的有：
          - Key Insights（Total Return / Sharpe / Win Rate 全部在 FAO）
          - Best/Worst（与 FAO Portfolio Snapshot 的同名行重复）
          - Key Metrics 4 格（cecee72：Max Drawdown / Volatility 在稀疏数据
            上误导，其余 KPI 已被 FAO 覆盖）。 */}
      {renderPortfolioMetrics()}
      {renderPerformanceChart()}
      {renderMonthlyCashFlow()}
      {renderDistribution()}
    </div>
  );
}
