'use client';

import React, { useState, useMemo } from 'react';
import { useComprehensiveFinancialAnalysis } from '../../hooks/useFinancialCalculations';
import { calculateInvestmentYears, expandSellToCashReceipts } from '../../lib/coreCalculations';
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
interface PortfolioMetrics {
  totalProfit: number;
  annualizedReturn: number;
  sharpeRatio: number;
}

interface TimeSeriesData {
  date: string;
  investment: number;        // 单月新增 cost basis（buy + 实际续费 archive/tx）
  renewalCost: number;       // investment 里归属于「实际续费」的部分（archive + tx，不含 projected）
  renewalCostProjected: number; // 假设域名继续保留时，本月预计的续费支出（不并入 investment）
  revenue: number;           // 单月净入账（分期销售按到账月展开）
  cumulativeNetProfit: number; // 累计净利润 = Σ(revenue − investment)；纯交易数字、无估值
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

  // N 个月窗口（含当前月）。filter 与 timeSeriesData 共用此值，确保两边窗口对齐。
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

  // 月度入账：分期销售用 expandSellToCashReceipts 按已付期展开到对应月份，
  // 避免把多期分期一起记到销售当月让中间月柱子全 0。
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
    const renewalActualByMonth = new Map<string, number>();
    const renewalProjectedByMonth = new Map<string, number>();
    for (const d of filteredData.domains) {
      for (const ev of expandRenewalEvents(d, filteredData.transactions, { forecastUntil: now })) {
        if (ev.date > now) continue;
        const key = ev.date.toISOString().slice(0, 7);
        const target = ev.source === 'projected' ? renewalProjectedByMonth : renewalActualByMonth;
        target.set(key, (target.get(key) ?? 0) + ev.amount);
      }
    }
    const purchaseEventsByMonth = new Map<string, number>();
    for (const d of filteredData.domains) {
      if (!d.purchase_date) continue;
      const pd = new Date(d.purchase_date);
      if (Number.isNaN(pd.getTime()) || pd > now) continue;
      const key = pd.toISOString().slice(0, 7);
      const cost = Number(d.purchase_cost) || 0;
      purchaseEventsByMonth.set(key, (purchaseEventsByMonth.get(key) ?? 0) + cost);
    }

    let cumulativeRevenue = 0;
    let cumulativeInvestment = 0;
    for (let i = 0; i < monthsToShow; i++) {
      const date = new Date(startDate);
      date.setMonth(date.getMonth() + i);
      const monthKey = date.toISOString().slice(0, 7);

      if (date > now) break;

      const purchaseThisMonth = purchaseEventsByMonth.get(monthKey) ?? 0;
      const renewalCost = renewalActualByMonth.get(monthKey) ?? 0;
      const renewalCostProjected = renewalProjectedByMonth.get(monthKey) ?? 0;
      // Investment counts only realised events; projected stays as a separate
      // forecast line so cumulativeNetProfit doesn't go more negative just
      // because a renewal is anticipated.
      const investment = purchaseThisMonth + renewalCost;

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
      cumulativeInvestment += investment;
      // 累计净利润 = 累计实收 − 累计 cost basis（buy + renew）。
      // 与 Portfolio Value 不同，这里完全基于真实交易，不引入 estimated_value 这类估值。
      const cumulativeNetProfit = cumulativeRevenue - cumulativeInvestment;

      data.push({
        date: monthKey,
        investment,
        renewalCost,
        renewalCostProjected,
        revenue,
        cumulativeNetProfit,
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
              <span>{t('analytics.cumulativeNetProfit')}</span>
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
              dataKey="cumulativeNetProfit"
              stroke="#f59e0b"
              fill="url(#colorPortfolio)"
              strokeWidth={3}
              name={t('analytics.cumulativeNetProfit')}
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

      {renderPortfolioMetrics()}
      {renderPerformanceChart()}
      {renderMonthlyCashFlow()}
      {renderDistribution()}
    </div>
  );
}
