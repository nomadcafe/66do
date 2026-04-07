'use client';

import { useState, useMemo } from 'react';
import { 
  TrendingUp, 
  DollarSign, 
  CheckCircle,
  XCircle,
  Target
} from 'lucide-react';
// 使用优化后的组件
import { 
  calculateROI, 
  calculateProfitMargin, 
  calculateAnnualizedReturn,
  formatCurrency,
  formatPercentage
} from '../../lib/financialCalculations';
import { useI18nContext } from '../../contexts/I18nProvider';

interface Domain {
  id: string;
  domain_name: string;
  purchase_date: string;
  purchase_cost: number;
  renewal_cost: number;
  renewal_cycle: number;
  renewal_count: number;
  expiry_date?: string; // 改为可选字段
  status: 'active' | 'for_sale' | 'sold' | 'expired';
  estimated_value: number;
  tags: string[];
}

interface Transaction {
  id: string;
  domain_id: string;
  type: 'buy' | 'renew' | 'sell' | 'transfer' | 'fee' | 'marketing' | 'advertising';
  amount: number;
  currency: string;
  exchange_rate?: number;
  platform_fee?: number;
  net_amount?: number;
  date: string;
  notes: string;
  platform?: string;
  category?: string;
  tax_deductible?: boolean;
}

interface FinancialAnalysisProps {
  domains: Domain[];
  transactions: Transaction[];
}

interface AnalysisResult {
  overall: {
    totalInvestment: number;
    totalRevenue: number;
    totalProfit: number;
    roi: number;
    profitMargin: number;
    annualizedReturn: number;
  };
  performance: {
    bestDomain: { name: string; profit: number; roi: number };
    worstDomain: { name: string; profit: number; roi: number };
    avgHoldingPeriod: number;
    successRate: number;
  };
  trends: {
    monthlyGrowth: number;
    quarterlyGrowth: number;
    yearlyGrowth: number;
  };
  recommendations: string[];
}

export default function FinancialAnalysis({ domains, transactions }: FinancialAnalysisProps) {
  const { t } = useI18nContext();
  const [selectedMetric, setSelectedMetric] = useState('overall');

  // 计算财务分析结果
  const analysisResult: AnalysisResult = useMemo(() => {
    // 总体指标
    const totalInvestment = domains.reduce((sum, domain) => {
      const holdingCost = domain.purchase_cost + (domain.renewal_count * domain.renewal_cost);
      return sum + holdingCost;
    }, 0);

    const totalRevenue = transactions
      .filter(t => t.type === 'sell')
      .reduce((sum, t) => sum + (t.net_amount || t.amount), 0);

    const totalProfit = totalRevenue - totalInvestment;
    const roi = calculateROI(totalInvestment, totalRevenue);
    const profitMargin = calculateProfitMargin(totalRevenue, totalInvestment);

    // 计算年化收益率
    const oldestDomain = domains.reduce((oldest, domain) => {
      const domainDate = new Date(domain.purchase_date);
      const oldestDate = new Date(oldest.purchase_date);
      return domainDate < oldestDate ? domain : oldest;
    }, domains[0]);
    
    const years = oldestDomain ? 
      (new Date().getTime() - new Date(oldestDomain.purchase_date).getTime()) / (1000 * 60 * 60 * 24 * 365) : 1;
    
    const annualizedReturn = calculateAnnualizedReturn(totalInvestment, totalRevenue, years);

    // 表现分析
    const domainPerformance = domains.map(domain => {
      const domainTransactions = transactions.filter(t => t.domain_id === domain.id);
      const totalSpent = domainTransactions
        .filter(t => t.type === 'buy' || t.type === 'renew' || t.type === 'fee')
        .reduce((sum, t) => sum + t.amount, 0);
      const totalEarned = domainTransactions
        .filter(t => t.type === 'sell')
        .reduce((sum, t) => sum + t.amount, 0);
      const profit = totalEarned - totalSpent;
      const roi = totalSpent > 0 ? (profit / totalSpent) * 100 : 0;
      return { domain, profit, roi };
    });

    const bestDomain = domainPerformance.reduce((best, current) => 
      current.profit > best.profit ? current : best, domainPerformance[0] || { domain: { domain_name: 'N/A' }, profit: 0, roi: 0 });
    
    const worstDomain = domainPerformance.reduce((worst, current) => 
      current.profit < worst.profit ? current : worst, domainPerformance[0] || { domain: { domain_name: 'N/A' }, profit: 0, roi: 0 });

    // 平均持有期
    const soldDomains = domains.filter(d => d.status === 'sold');
    const avgHoldingPeriod = soldDomains.length > 0 
      ? soldDomains.reduce((sum, domain) => {
          const purchaseDate = new Date(domain.purchase_date);
          const now = new Date();
          const days = Math.floor((now.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24));
          return sum + days;
        }, 0) / soldDomains.length
      : 0;

    // 成功率
    const successRate = domains.length > 0 ? (soldDomains.length / domains.length) * 100 : 0;

    // 风险指标
    const monthlyReturns = Array.from({ length: 12 }, (_, i) => {
      const date = new Date();
      date.setMonth(date.getMonth() - (11 - i));
      const monthTransactions = transactions.filter(t => {
        const transactionDate = new Date(t.date);
        return transactionDate.getMonth() === date.getMonth() && 
               transactionDate.getFullYear() === date.getFullYear();
      });
      return monthTransactions
        .filter(t => t.type === 'sell')
        .reduce((sum, t) => sum + t.amount, 0);
    });

    // 趋势分析
    const currentMonth = new Date().getMonth();
    
    const monthlyGrowth = monthlyReturns[currentMonth] || 0;
    const quarterlyGrowth = monthlyReturns.slice(currentMonth - 2, currentMonth + 1).reduce((sum, val) => sum + val, 0);
    const yearlyGrowth = monthlyReturns.reduce((sum, val) => sum + val, 0);

    // 建议
    const recommendations: string[] = [];
    
    if (roi < 0) {
      recommendations.push('Consider reviewing your investment strategy - current ROI is negative');
    }
    if (successRate < 30) {
      recommendations.push('Low success rate - consider improving domain selection criteria');
    }
    if (avgHoldingPeriod > 365) {
      recommendations.push('Long holding periods detected - consider more active portfolio management');
    }
    if (recommendations.length === 0) {
      recommendations.push('Portfolio is performing well - continue current strategy');
    }

    return {
      overall: {
        totalInvestment,
        totalRevenue,
        totalProfit,
        roi,
        profitMargin,
        annualizedReturn
      },
      performance: {
        bestDomain: {
          name: bestDomain.domain.domain_name,
          profit: bestDomain.profit,
          roi: bestDomain.roi
        },
        worstDomain: {
          name: worstDomain.domain.domain_name,
          profit: worstDomain.profit,
          roi: worstDomain.roi
        },
        avgHoldingPeriod,
        successRate
      },
      trends: {
        monthlyGrowth,
        quarterlyGrowth,
        yearlyGrowth
      },
      recommendations
    };
  }, [domains, transactions]);

  const getPerformanceIcon = (value: number, threshold: number = 0) => {
    if (value >= threshold) {
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    } else {
      return <XCircle className="h-5 w-5 text-red-500" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* 分析头部 */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{t('reports.financialAnalysis')}</h2>
            <p className="text-gray-600">{t('reports.advancedPortfolioAnalysis')}</p>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setSelectedMetric('overall')}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                selectedMetric === 'overall' 
                  ? 'bg-blue-100 text-blue-700' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
{t('reports.overall')}
            </button>
            <button
              onClick={() => setSelectedMetric('performance')}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                selectedMetric === 'performance' 
                  ? 'bg-blue-100 text-blue-700' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
{t('reports.performance')}
            </button>
          </div>
        </div>
      </div>

      {/* 总体指标 */}
      {selectedMetric === 'overall' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Investment</h3>
              <DollarSign className="h-6 w-6 text-blue-600" />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Total Investment</span>
                <span className="font-semibold">{formatCurrency(analysisResult.overall.totalInvestment)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Total Revenue</span>
                <span className="font-semibold text-green-600">{formatCurrency(analysisResult.overall.totalRevenue)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Net Profit</span>
                <span className={`font-semibold ${analysisResult.overall.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(analysisResult.overall.totalProfit)}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Returns</h3>
              <Target className="h-6 w-6 text-green-600" />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">ROI</span>
                <span className={`font-semibold ${analysisResult.overall.roi >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatPercentage(analysisResult.overall.roi)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Profit Margin</span>
                <span className="font-semibold">{formatPercentage(analysisResult.overall.profitMargin)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Annualized Return</span>
                <span className="font-semibold">{formatPercentage(analysisResult.overall.annualizedReturn)}</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Trends</h3>
              <TrendingUp className="h-6 w-6 text-purple-600" />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Monthly Growth</span>
                <span className="font-semibold">{formatCurrency(analysisResult.trends.monthlyGrowth)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Quarterly Growth</span>
                <span className="font-semibold">{formatCurrency(analysisResult.trends.quarterlyGrowth)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Yearly Growth</span>
                <span className="font-semibold">{formatCurrency(analysisResult.trends.yearlyGrowth)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 表现分析 */}
      {selectedMetric === 'performance' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Best & Worst Performers</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
                <div>
                  <p className="font-medium text-green-800">Best Performer</p>
                  <p className="text-sm text-green-600">{analysisResult.performance.bestDomain.name}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-green-600">{formatCurrency(analysisResult.performance.bestDomain.profit)}</p>
                  <p className="text-sm text-green-500">{formatPercentage(analysisResult.performance.bestDomain.roi)}</p>
                </div>
              </div>
              
              <div className="flex items-center justify-between p-4 bg-red-50 rounded-lg">
                <div>
                  <p className="font-medium text-red-800">Worst Performer</p>
                  <p className="text-sm text-red-600">{analysisResult.performance.worstDomain.name}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-red-600">{formatCurrency(analysisResult.performance.worstDomain.profit)}</p>
                  <p className="text-sm text-red-500">{formatPercentage(analysisResult.performance.worstDomain.roi)}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Portfolio Metrics</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Average Holding Period</span>
                <span className="font-semibold">{Math.round(analysisResult.performance.avgHoldingPeriod)} days</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Success Rate</span>
                <div className="flex items-center space-x-2">
                  {getPerformanceIcon(analysisResult.performance.successRate, 50)}
                  <span className="font-semibold">{formatPercentage(analysisResult.performance.successRate)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 建议 */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recommendations</h3>
        <div className="space-y-3">
          {analysisResult.recommendations.map((recommendation, index) => (
            <div key={index} className="flex items-start space-x-3 p-3 bg-blue-50 rounded-lg">
              <div className="flex-shrink-0">
                <div className="w-2 h-2 bg-blue-600 rounded-full mt-2"></div>
              </div>
              <p className="text-sm text-gray-700">{recommendation}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
