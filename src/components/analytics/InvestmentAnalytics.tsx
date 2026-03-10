'use client';

import React, { useState, useMemo } from 'react';
import { useComprehensiveFinancialAnalysis } from '../../hooks/useFinancialCalculations';
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
  Legend
} from 'recharts';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Target, 
  AlertTriangle,
  BarChart3,
  Activity,
  Zap,
  Globe,
  Info
} from 'lucide-react';

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
//   exchange_rate?: number;
//   base_amount?: number;
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

interface PortfolioMetrics {
  totalInvestment: number;
  totalRevenue: number;
  totalProfit: number;
  totalReturn: number;
  annualizedReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  volatility: number;
  winRate: number;
  avgHoldingPeriod: number;
  bestPerformingDomain: string;
  worstPerformingDomain: string;
}

interface TimeSeriesData {
  date: string;
  investment: number;
  revenue: number;
  profit: number;
  portfolioValue: number;
  monthlyReturn: number;
}

interface RiskAnalysis {
  riskLevel: 'Low' | 'Medium' | 'High';
  diversificationScore: number;
  concentrationRisk: number;
  liquidityRisk: number;
  recommendations: string[];
}

export default function InvestmentAnalytics({ domains, transactions }: InvestmentAnalyticsProps) {
  const { t, locale } = useI18nContext();
  const [selectedTimeframe, setSelectedTimeframe] = useState<'3M' | '6M' | '1Y' | 'ALL'>('ALL');
  const [selectedMetric, setSelectedMetric] = useState<'portfolio' | 'performance' | 'risk' | 'trends'>('portfolio');

  // 根据选择的时间范围筛选数据
  const filteredData = useMemo(() => {
    const now = new Date();
    let startDate: Date;

    switch (selectedTimeframe) {
      case '3M':
        startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
        break;
      case '6M':
        startDate = new Date(now.getFullYear(), now.getMonth() - 6, 1);
        break;
      case '1Y':
        startDate = new Date(now.getFullYear() - 1, now.getMonth(), 1);
        break;
      case 'ALL':
      default:
        return { domains, transactions };
    }

    const filteredDomains = domains.filter(domain => {
      const domainDate = new Date(domain.purchase_date || '');
      return domainDate >= startDate && domainDate <= now;
    });

    const filteredTransactions = transactions.filter(transaction => {
      const transactionDate = new Date(transaction.date);
      return transactionDate >= startDate && transactionDate <= now;
    });

    return { domains: filteredDomains, transactions: filteredTransactions };
  }, [domains, transactions, selectedTimeframe]);

  // 使用筛选后的数据计算
  const financialAnalysis = useComprehensiveFinancialAnalysis(filteredData.domains, filteredData.transactions);
  
  const portfolioMetrics: PortfolioMetrics = useMemo(() => ({
    totalInvestment: financialAnalysis.basic.totalInvestment,
    totalRevenue: financialAnalysis.basic.totalRevenue,
    totalProfit: financialAnalysis.basic.totalProfit,
    totalReturn: financialAnalysis.basic.roi,
    annualizedReturn: financialAnalysis.advanced.annualizedReturn,
    sharpeRatio: financialAnalysis.advanced.sharpeRatio,
    maxDrawdown: financialAnalysis.advanced.maxDrawdown,
    volatility: financialAnalysis.advanced.volatility,
    winRate: financialAnalysis.advanced.winRate,
    avgHoldingPeriod: financialAnalysis.advanced.avgHoldingPeriod,
    bestPerformingDomain: financialAnalysis.advanced.bestPerformingDomain,
    worstPerformingDomain: financialAnalysis.advanced.worstPerformingDomain
  }), [financialAnalysis]);

  // 计算时间序列数据（基于筛选后的数据和时间范围）
  const timeSeriesData: TimeSeriesData[] = useMemo(() => {
    const data: TimeSeriesData[] = [];
    const now = new Date();
    let monthsToShow: number;
    let startDate: Date;

    switch (selectedTimeframe) {
      case '3M':
        monthsToShow = 3;
        startDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
        break;
      case '6M':
        monthsToShow = 6;
        startDate = new Date(now.getFullYear(), now.getMonth() - 5, 1);
        break;
      case '1Y':
        monthsToShow = 12;
        startDate = new Date(now.getFullYear() - 1, now.getMonth(), 1);
        break;
      case 'ALL':
      default:
        monthsToShow = 12;
        // 找到最早的数据日期
        const allDates = [
          ...filteredData.domains.map(d => new Date(d.purchase_date || '')),
          ...filteredData.transactions.map(t => new Date(t.date))
        ].filter(d => !isNaN(d.getTime()));
        const earliestDate = allDates.length > 0 
          ? new Date(Math.min(...allDates.map(d => d.getTime())))
          : new Date(now.getFullYear() - 1, now.getMonth(), 1);
        startDate = new Date(earliestDate.getFullYear(), earliestDate.getMonth(), 1);
        // 如果数据跨度超过12个月，显示所有月份
        const monthsDiff = (now.getFullYear() - earliestDate.getFullYear()) * 12 + (now.getMonth() - earliestDate.getMonth());
        if (monthsDiff > 12) {
          monthsToShow = monthsDiff + 1;
        }
        break;
    }

    for (let i = 0; i < monthsToShow; i++) {
      const date = new Date(startDate);
      date.setMonth(date.getMonth() + i);
      const monthKey = date.toISOString().slice(0, 7);

      // 只计算到当前月份为止的数据
      if (date > now) break;

      const monthDomains = filteredData.domains.filter(d => {
        const domainDate = new Date(d.purchase_date || '');
        const domainMonth = domainDate.toISOString().slice(0, 7);
        return domainMonth <= monthKey;
      });

      const monthTransactions = filteredData.transactions.filter(t => {
        const transactionDate = new Date(t.date);
        const transactionMonth = transactionDate.toISOString().slice(0, 7);
        return transactionMonth === monthKey;
      });

      const investment = monthDomains.reduce((sum, domain) => {
        const holdingCost = (domain.purchase_cost || 0) + (domain.renewal_count * (domain.renewal_cost || 0));
        return sum + holdingCost;
      }, 0);

      const revenue = monthTransactions
        .filter(t => t.type === 'sell')
        .reduce((sum, t) => sum + (t.net_amount || t.amount), 0);

      const profit = revenue - investment;
      const portfolioValue = investment + profit;
      const monthlyReturn = investment > 0 ? (profit / investment) * 100 : 0;

      data.push({
        date: monthKey,
        investment,
        revenue,
        profit,
        portfolioValue,
        monthlyReturn
      });
    }

    return data;
  }, [filteredData, selectedTimeframe]);

  // 计算风险分析（基于筛选后的数据）
  const riskAnalysis: RiskAnalysis = useMemo(() => {
    const totalValue = portfolioMetrics.totalInvestment + portfolioMetrics.totalProfit;
    const domainValues = filteredData.domains.map(d => d.estimated_value || 0);
    const maxDomainValue = Math.max(...domainValues);
    const concentrationRisk = totalValue > 0 ? (maxDomainValue / totalValue) * 100 : 0;

    const activeDomains = filteredData.domains.filter(d => d.status === 'active').length;
    const forSaleDomains = filteredData.domains.filter(d => d.status === 'for_sale').length;
    const liquidityRisk = filteredData.domains.length > 0 && totalValue > 0
      ? ((activeDomains + forSaleDomains) / filteredData.domains.length) * 100
      : 0;

    const diversificationScore = Math.min(100, filteredData.domains.length * 10); // 每个域名10分，最高100分

    let riskLevel: 'Low' | 'Medium' | 'High' = 'Low';
    if (concentrationRisk > 50 || portfolioMetrics.volatility > 30 || liquidityRisk < 30) {
      riskLevel = 'High';
    } else if (concentrationRisk > 30 || portfolioMetrics.volatility > 20 || liquidityRisk < 50) {
      riskLevel = 'Medium';
    }

    const recommendations: string[] = [];
    if (concentrationRisk > 30) {
      recommendations.push(t('analytics.considerDiversification'));
    }
    if (portfolioMetrics.volatility > 20) {
      recommendations.push(t('analytics.highVolatility'));
    }
    if (liquidityRisk < 50) {
      recommendations.push(t('analytics.lowLiquidity'));
    }
    if (filteredData.domains.length < 5) {
      recommendations.push(t('analytics.lowDiversity'));
    }

    return {
      riskLevel,
      diversificationScore,
      concentrationRisk,
      liquidityRisk,
      recommendations
    };
  }, [filteredData.domains, portfolioMetrics, t]);

  // 辅助函数已移至共享计算库

  const renderPortfolioMetrics = () => {
    if (filteredData.domains.length === 0 && filteredData.transactions.length === 0) {
      return (
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            <BarChart3 className="h-16 w-16 text-gray-300 mb-4" />
            <p className="text-lg font-medium text-gray-600 mb-2">{t('analytics.noDataAvailable')}</p>
            <p className="text-sm text-gray-400">{t('analytics.noDataMessage')}</p>
          </div>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-6 rounded-lg text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm">{t('analytics.totalInvestment')}</p>
              <p className="text-2xl font-bold">${portfolioMetrics.totalInvestment.toLocaleString()}</p>
              {filteredData.domains.length > 0 && (
                <p className="text-blue-200 text-xs mt-1">
                  {filteredData.domains.length} {t('analytics.domainsCount') || '个域名'}
                </p>
              )}
            </div>
            <DollarSign className="h-8 w-8 text-blue-200" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-6 rounded-lg text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 text-sm">{t('analytics.totalRevenue')}</p>
              <p className="text-2xl font-bold">${portfolioMetrics.totalRevenue.toLocaleString()}</p>
              {filteredData.transactions.filter(t => t.type === 'sell').length > 0 && (
                <p className="text-purple-200 text-xs mt-1">
                  {filteredData.transactions.filter(t => t.type === 'sell').length} {t('analytics.salesCount') || '笔出售'}
                </p>
              )}
            </div>
            <TrendingUp className="h-8 w-8 text-purple-200" />
          </div>
        </div>

      <div className="bg-gradient-to-br from-green-500 to-green-600 p-6 rounded-lg text-white">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-green-100 text-sm">{t('analytics.netProfit')}</p>
              <div className="group relative">
                <Info className="h-4 w-4 text-green-200 cursor-help hover:text-green-100 transition-colors" />
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10 max-w-xs">
                  <div className="text-center whitespace-normal">
                    {t('analytics.netProfitCalculation')}
                  </div>
                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                    <div className="w-2 h-2 bg-gray-900 transform rotate-45"></div>
                  </div>
                </div>
              </div>
            </div>
            <p className="text-2xl font-bold">${portfolioMetrics.totalProfit.toLocaleString()}</p>
            <p className={`text-green-200 text-xs mt-1 ${
              portfolioMetrics.totalProfit >= 0 ? 'text-green-100' : 'text-red-200'
            }`}>
              {portfolioMetrics.totalProfit >= 0 ? t('analytics.performanceRating.profitable') : t('analytics.performanceRating.loss')}
            </p>
          </div>
          <Target className="h-8 w-8 text-green-200" />
        </div>
      </div>

      <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-6 rounded-lg text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-orange-100 text-sm">{t('analytics.totalReturn')}</p>
            <p className="text-2xl font-bold">{portfolioMetrics.totalReturn.toFixed(1)}%</p>
            <p className={`text-orange-200 text-xs mt-1 ${
              portfolioMetrics.totalReturn >= 20 ? 'text-green-100' :
              portfolioMetrics.totalReturn >= 10 ? 'text-yellow-100' : ''
            }`}>
              {portfolioMetrics.totalReturn >= 20 ? t('analytics.performanceRating.excellent') :
               portfolioMetrics.totalReturn >= 10 ? t('analytics.performanceRating.good') :
               portfolioMetrics.totalReturn >= 0 ? t('analytics.performanceRating.normal') : t('analytics.performanceRating.needsImprovement')}
            </p>
          </div>
          <BarChart3 className="h-8 w-8 text-orange-200" />
        </div>
      </div>

      <div className="bg-gradient-to-br from-red-500 to-red-600 p-6 rounded-lg text-white">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-red-100 text-sm">{t('analytics.annualizedReturn')}</p>
              <div className="group relative">
                <Info className="h-4 w-4 text-red-200 cursor-help hover:text-red-100 transition-colors" />
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10 max-w-xs">
                  <div className="text-center whitespace-normal">
                    {t('analytics.annualizedReturnDesc')}
                  </div>
                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                    <div className="w-2 h-2 bg-gray-900 transform rotate-45"></div>
                  </div>
                </div>
              </div>
            </div>
            <p className="text-2xl font-bold">{portfolioMetrics.annualizedReturn.toFixed(1)}%</p>
          </div>
          <Activity className="h-8 w-8 text-red-200" />
        </div>
      </div>

      <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 p-6 rounded-lg text-white">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-indigo-100 text-sm">{t('analytics.sharpeRatio')}</p>
              <div className="group relative">
                <Info className="h-4 w-4 text-indigo-200 cursor-help hover:text-indigo-100 transition-colors" />
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10 max-w-xs">
                  <div className="text-center whitespace-normal">
                    {t('analytics.sharpeRatioDesc')}
                  </div>
                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                    <div className="w-2 h-2 bg-gray-900 transform rotate-45"></div>
                  </div>
                </div>
              </div>
            </div>
            <p className="text-2xl font-bold">{portfolioMetrics.sharpeRatio.toFixed(2)}</p>
          </div>
          <Zap className="h-8 w-8 text-indigo-200" />
        </div>
      </div>
      </div>
    );
  };

  const renderPerformanceChart = () => {
    if (timeSeriesData.length === 0) {
      return (
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('analytics.portfolioPerformance')}</h3>
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            <BarChart3 className="h-12 w-12 text-gray-300 mb-4" />
            <p className="text-gray-600">{t('analytics.noChartData')}</p>
            <p className="text-sm text-gray-400 mt-2">{t('analytics.noChartDataMessage')}</p>
          </div>
        </div>
      );
    }

    return (
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">{t('analytics.portfolioPerformance')}</h3>
          <div className="flex items-center gap-4 text-xs text-gray-600">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded"></div>
              <span>{t('analytics.investment')}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded"></div>
              <span>{t('analytics.revenue')}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-purple-500 rounded"></div>
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
                <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10B981" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorPortfolio" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis 
              dataKey="date" 
              tick={{ fontSize: 12, fill: '#6B7280' }}
              tickFormatter={(value) => {
                const date = new Date(value);
                return `${date.getMonth() + 1}/${date.getFullYear()}`;
              }}
              stroke="#9CA3AF"
            />
            <YAxis 
              tick={{ fontSize: 12, fill: '#6B7280' }}
              tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
              stroke="#9CA3AF"
            />
            <Tooltip 
              contentStyle={{
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                border: '1px solid #E5E7EB',
                borderRadius: '8px',
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
              }}
              cursor={{ stroke: '#3B82F6', strokeWidth: 2 }}
              formatter={(value, name) => [
                `$${Number(value).toLocaleString()}`, 
                name === 'investment' ? t('analytics.investment') : 
                name === 'revenue' ? t('analytics.revenue') : 
                name === 'profit' ? t('analytics.profit') : t('analytics.portfolioValue')
              ]}
              labelFormatter={(value) => {
                const date = new Date(value);
                return date.toLocaleDateString(locale === 'zh' ? 'zh-CN' : 'en-US', { year: 'numeric', month: 'long' });
              }}
            />
            <Legend 
              wrapperStyle={{ paddingTop: '20px' }}
              iconType="circle"
            />
            <defs>
              <linearGradient id="colorInvestment" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10B981" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorPortfolio" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <Area 
              type="monotone" 
              dataKey="investment" 
              stackId="1" 
              stroke="#3B82F6" 
              fill="url(#colorInvestment)"
              strokeWidth={2}
              name={t('analytics.investment')}
              activeDot={{ r: 6, fill: '#3B82F6' }}
            />
            <Area 
              type="monotone" 
              dataKey="revenue" 
              stackId="2" 
              stroke="#10B981" 
              fill="url(#colorRevenue)"
              strokeWidth={2}
              name={t('analytics.revenue')}
              activeDot={{ r: 6, fill: '#10B981' }}
            />
            <Line 
              type="monotone" 
              dataKey="portfolioValue" 
              stroke="#8B5CF6" 
              fill="url(#colorPortfolio)"
              strokeWidth={3}
              name={t('analytics.portfolioValue')}
              dot={{ r: 4, fill: '#8B5CF6' }}
              activeDot={{ r: 8, fill: '#8B5CF6' }}
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

  const renderRiskAnalysis = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('analytics.riskMetrics')}</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-gray-600">{t('analytics.riskLevel')}</span>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              riskAnalysis.riskLevel === 'Low' ? 'bg-green-100 text-green-800' :
              riskAnalysis.riskLevel === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
              'bg-red-100 text-red-800'
            }`}>
              {riskAnalysis.riskLevel === 'Low' ? t('analytics.lowRisk') :
               riskAnalysis.riskLevel === 'Medium' ? t('analytics.mediumRisk') : t('analytics.highRisk')}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-600">{t('analytics.diversificationScore')}</span>
            <span className="text-lg font-semibold">{riskAnalysis.diversificationScore}/100</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-600">{t('analytics.concentrationRisk')}</span>
            <span className="text-lg font-semibold">{riskAnalysis.concentrationRisk.toFixed(1)}%</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-600">{t('analytics.liquidityRisk')}</span>
            <span className="text-lg font-semibold">{riskAnalysis.liquidityRisk.toFixed(1)}%</span>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('analytics.investmentAdvice')}</h3>
        <div className="space-y-3">
          {riskAnalysis.recommendations.length > 0 ? (
            riskAnalysis.recommendations.map((recommendation, index) => (
              <div key={index} className="flex items-start space-x-3 p-3 bg-blue-50 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-blue-800">{recommendation}</p>
              </div>
            ))
          ) : (
            <div className="flex items-center space-x-3 p-3 bg-green-50 rounded-lg">
              <Target className="h-5 w-5 text-green-600" />
              <p className="text-sm text-green-800">{t('analytics.portfolioPerformingWell')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

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

    // 出售域名后缀分布（基于筛选后的数据）
    const soldDomains = filteredData.domains.filter(d => d.status === 'sold');
    const soldSuffixCount: { [key: string]: number } = {};
    soldDomains.forEach(domain => {
      const suffix = extractSuffix(domain.domain_name);
      soldSuffixCount[suffix] = (soldSuffixCount[suffix] || 0) + 1;
    });

    // 转换为图表数据
    const heldSuffixData = Object.entries(heldSuffixCount)
      .map(([suffix, count]) => ({
        name: `.${suffix}`,
        value: count,
        percentage: heldDomains.length > 0 ? (count / heldDomains.length) * 100 : 0
      }))
      .sort((a, b) => b.value - a.value);

    const soldSuffixData = Object.entries(soldSuffixCount)
      .map(([suffix, count]) => ({
        name: `.${suffix}`,
        value: count,
        percentage: soldDomains.length > 0 ? (count / soldDomains.length) * 100 : 0
      }))
      .sort((a, b) => b.value - a.value);

    return {
      heldSuffixData,
      soldSuffixData,
      totalHeld: heldDomains.length,
      totalSold: soldDomains.length
    };
  }, [filteredData.domains]);

  const renderTrendsAnalysis = () => (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('analytics.monthlyReturnTrend')}</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={timeSeriesData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip formatter={(value) => [`${Number(value).toFixed(1)}%`, t('analytics.monthlyReturn')]} />
            <Line 
              type="monotone" 
              dataKey="monthlyReturn" 
              stroke="#3B82F6" 
              strokeWidth={2}
              name={t('analytics.monthlyReturn')}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('analytics.heldDomainSuffix')}</h3>
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
                      <Cell key={`cell-${index}`} fill={`hsl(${index * 60}, 70%, 50%)`} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value, name) => [`${value}${t('analytics.countUnit')}`, name]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2">
                <h4 className="font-medium text-gray-700">{t('analytics.detailedStats')}</h4>
                {domainSuffixAnalysis.heldSuffixData.slice(0, 5).map((suffix, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <span className="text-sm font-medium">{suffix.name}</span>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-600">{suffix.value}{t('analytics.countUnit')}</span>
                      <span className="text-xs text-gray-500">({suffix.percentage.toFixed(1)}%)</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Globe className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>{t('analytics.noHeldDomains')}</p>
            </div>
          )}
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('analytics.soldDomainSuffix')}</h3>
          {domainSuffixAnalysis.soldSuffixData.length > 0 ? (
            <div className="space-y-4">
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={domainSuffixAnalysis.soldSuffixData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {domainSuffixAnalysis.soldSuffixData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={`hsl(${index * 60 + 180}, 70%, 50%)`} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value, name) => [`${value}${t('analytics.countUnit')}`, name]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2">
                <h4 className="font-medium text-gray-700">{t('analytics.detailedStats')}</h4>
                {domainSuffixAnalysis.soldSuffixData.slice(0, 5).map((suffix, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <span className="text-sm font-medium">{suffix.name}</span>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-600">{suffix.value}{t('analytics.countUnit')}</span>
                      <span className="text-xs text-gray-500">({suffix.percentage.toFixed(1)}%)</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Globe className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>{t('analytics.noSoldDomains')}</p>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('analytics.suffixComparison')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium text-gray-700 mb-3">{t('analytics.heldDomainRanking')}</h4>
            <div className="space-y-2">
              {domainSuffixAnalysis.heldSuffixData.slice(0, 8).map((suffix, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-blue-600 font-semibold text-sm">{index + 1}</span>
                    </div>
                    <span className="font-medium text-gray-900">{suffix.name}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-semibold text-blue-600">{suffix.value}{t('analytics.countUnit')}</span>
                    <p className="text-xs text-gray-500">{suffix.percentage.toFixed(1)}%</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 className="font-medium text-gray-700 mb-3">{t('analytics.soldDomainRanking')}</h4>
            <div className="space-y-2">
              {domainSuffixAnalysis.soldSuffixData.slice(0, 8).map((suffix, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                      <span className="text-green-600 font-semibold text-sm">{index + 1}</span>
                    </div>
                    <span className="font-medium text-gray-900">{suffix.name}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-semibold text-green-600">{suffix.value}{t('analytics.countUnit')}</span>
                    <p className="text-xs text-gray-500">{suffix.percentage.toFixed(1)}%</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('analytics.investmentDistribution')}</h3>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={[
                { name: t('analytics.activeDomains'), value: filteredData.domains.filter(d => d.status === 'active').length, color: '#10B981' },
                { name: t('analytics.forSaleDomains'), value: filteredData.domains.filter(d => d.status === 'for_sale').length, color: '#F59E0B' },
                { name: t('analytics.soldDomains'), value: filteredData.domains.filter(d => d.status === 'sold').length, color: '#3B82F6' },
                { name: t('analytics.expiredDomains'), value: filteredData.domains.filter(d => d.status === 'expired').length, color: '#EF4444' },
              ]}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name} ${(Number(percent) * 100).toFixed(0)}%`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
            >
              {[
                { name: t('analytics.activeDomains'), value: filteredData.domains.filter(d => d.status === 'active').length, color: '#10B981' },
                { name: t('analytics.forSaleDomains'), value: filteredData.domains.filter(d => d.status === 'for_sale').length, color: '#F59E0B' },
                { name: t('analytics.soldDomains'), value: filteredData.domains.filter(d => d.status === 'sold').length, color: '#3B82F6' },
                { name: t('analytics.expiredDomains'), value: filteredData.domains.filter(d => d.status === 'expired').length, color: '#EF4444' },
              ].map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  // 获取时间范围显示文本
  const getTimeframeText = () => {
    switch (selectedTimeframe) {
      case '3M':
        return t('analytics.timeframe.3M') || '最近3个月';
      case '6M':
        return t('analytics.timeframe.6M') || '最近6个月';
      case '1Y':
        return t('analytics.timeframe.1Y') || '最近1年';
      case 'ALL':
      default:
        return t('analytics.timeframe.ALL') || '全部时间';
    }
  };

  return (
    <div className="space-y-6">
      {/* 分析类型选择器 */}
      <div className="bg-white p-4 rounded-lg shadow-sm border">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{t('analytics.title') || '投资分析'}</h3>
            <p className="text-sm text-gray-500 mt-1">
              {t('analytics.dataRange') || '数据范围'}: <span className="font-medium text-gray-700">{getTimeframeText()}</span>
              {selectedTimeframe !== 'ALL' && (
                <span className="ml-2 text-xs text-gray-400">
                  ({filteredData.domains.length} {t('analytics.domainsCount') || '个域名'}, {filteredData.transactions.length} {t('analytics.transactionsCount') || '笔交易'})
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <select
              value={selectedMetric}
              onChange={(e) => setSelectedMetric(e.target.value as 'portfolio' | 'performance' | 'risk' | 'trends')}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="portfolio">{t('analytics.tab.portfolio')}</option>
              <option value="performance">{t('analytics.tab.performance')}</option>
              <option value="risk">{t('analytics.tab.risk')}</option>
              <option value="trends">{t('analytics.tab.trends')}</option>
            </select>
            <select
              value={selectedTimeframe}
              onChange={(e) => setSelectedTimeframe(e.target.value as '3M' | '6M' | '1Y' | 'ALL')}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="3M">{t('analytics.timeframe.3M')}</option>
              <option value="6M">{t('analytics.timeframe.6M')}</option>
              <option value="1Y">{t('analytics.timeframe.1Y')}</option>
              <option value="ALL">{t('analytics.timeframe.ALL')}</option>
            </select>
          </div>
        </div>
      </div>

      {/* 投资组合指标 */}
      {selectedMetric === 'portfolio' && (
        <div className="space-y-6">
          {/* 关键洞察概览 */}
          <div className="bg-gradient-to-br from-indigo-50 to-purple-50 p-6 rounded-lg border border-indigo-100">
            <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Target className="h-5 w-5 text-indigo-600" />
              {t('analytics.keyInsights')}
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white p-4 rounded-lg shadow-sm">
                <p className="text-xs text-gray-500 mb-1">{t('analytics.totalReturn')}</p>
                <p className={`text-2xl font-bold ${
                  portfolioMetrics.totalReturn >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {portfolioMetrics.totalReturn >= 0 ? '+' : ''}{portfolioMetrics.totalReturn.toFixed(1)}%
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {portfolioMetrics.totalReturn >= 20 ? t('analytics.returnRating.excellent') :
                   portfolioMetrics.totalReturn >= 10 ? t('analytics.returnRating.good') :
                   portfolioMetrics.totalReturn >= 0 ? t('analytics.returnRating.slightlyProfitable') : t('analytics.returnRating.loss')}
                </p>
              </div>
              <div className="bg-white p-4 rounded-lg shadow-sm">
                <p className="text-xs text-gray-500 mb-1">{t('analytics.sharpeRatio')}</p>
                <p className={`text-2xl font-bold ${
                  portfolioMetrics.sharpeRatio >= 1 ? 'text-green-600' :
                  portfolioMetrics.sharpeRatio >= 0.5 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {portfolioMetrics.sharpeRatio.toFixed(2)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {portfolioMetrics.sharpeRatio >= 1 ? t('analytics.sharpeRating.excellent') :
                   portfolioMetrics.sharpeRatio >= 0.5 ? t('analytics.sharpeRating.average') : t('analytics.sharpeRating.needsOptimization')}
                </p>
              </div>
              <div className="bg-white p-4 rounded-lg shadow-sm">
                <p className="text-xs text-gray-500 mb-1">{t('analytics.winRate')}</p>
                <p className={`text-2xl font-bold ${
                  portfolioMetrics.winRate >= 50 ? 'text-green-600' :
                  portfolioMetrics.winRate >= 30 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {portfolioMetrics.winRate.toFixed(1)}%
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {portfolioMetrics.winRate >= 50 ? t('analytics.winRateRating.good') :
                   portfolioMetrics.winRate >= 30 ? t('analytics.winRateRating.average') : t('analytics.winRateRating.needsImprovement')}
                </p>
              </div>
            </div>
          </div>
          {renderPortfolioMetrics()}
          {renderPerformanceChart()}
        </div>
      )}

      {/* 表现分析 */}
      {selectedMetric === 'performance' && (
        <div className="space-y-6">
          {renderPerformanceChart()}
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('analytics.keyMetrics')}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">{t('analytics.winRate')}</p>
                <p className="text-2xl font-bold text-green-600">{portfolioMetrics.winRate.toFixed(1)}%</p>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">{t('analytics.avgHoldingPeriodLabel')}</p>
                <p className="text-2xl font-bold text-blue-600">{portfolioMetrics.avgHoldingPeriod.toFixed(0)}{t('analytics.daysUnit')}</p>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">{t('analytics.maxDrawdownLabel')}</p>
                <p className="text-2xl font-bold text-red-600">{portfolioMetrics.maxDrawdown.toFixed(1)}%</p>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">{t('analytics.volatilityLabel')}</p>
                <p className="text-2xl font-bold text-orange-600">{portfolioMetrics.volatility.toFixed(1)}%</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 风险评估 */}
      {selectedMetric === 'risk' && renderRiskAnalysis()}

      {/* 趋势分析 */}
      {selectedMetric === 'trends' && (
        <div className="space-y-6">
          {renderTrendsAnalysis()}
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('analytics.bestWorstTitle')}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-4 bg-green-50 rounded-lg">
                <div className="flex items-center space-x-2 mb-2">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                  <span className="font-medium text-green-800">{t('analytics.bestPerformance')}</span>
                </div>
                <p className="text-lg font-semibold text-green-900">{portfolioMetrics.bestPerformingDomain}</p>
              </div>
              <div className="p-4 bg-red-50 rounded-lg">
                <div className="flex items-center space-x-2 mb-2">
                  <TrendingDown className="h-5 w-5 text-red-600" />
                  <span className="font-medium text-red-800">{t('analytics.worstPerformance')}</span>
                </div>
                <p className="text-lg font-semibold text-red-900">{portfolioMetrics.worstPerformingDomain}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
