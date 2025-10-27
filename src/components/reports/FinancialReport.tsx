'use client';

import { useState, useMemo } from 'react';
import { DomainWithTags, TransactionWithRequiredFields } from '../../types/dashboard';
// 使用共享计算逻辑
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Download,
  RefreshCw,
  Target
} from 'lucide-react';
import { 
  calculateROI, 
  calculateProfitMargin, 
  formatCurrency,
  formatPercentage,
  calculateDomainHoldingCost
} from '../../lib/financialCalculations';
import { useI18nContext } from '../../contexts/I18nProvider';

// interface Domain {
//   id: string;
//   domain_name: string;
//   purchase_date: string;
//   purchase_cost: number;
//   renewal_cost: number;
//   renewal_cycle: number;
//   renewal_count: number;
//   expiry_date?: string; // 改为可选字段
//   status: 'active' | 'for_sale' | 'sold' | 'expired';
//   estimated_value: number;
//   tags: string[];
// }

// interface Transaction {
//   id: string;
//   domain_id: string;
//   type: 'buy' | 'renew' | 'sell' | 'transfer' | 'fee' | 'marketing' | 'advertising';
//   amount: number;
//   currency: string;
//   exchange_rate?: number;
//   platform_fee?: number;
//   net_amount?: number;
//   date: string;
//   notes: string;
//   platform?: string;
//   category?: string;
//   tax_deductible?: boolean;
// }

interface FinancialReportProps {
  domains: DomainWithTags[];
  transactions: TransactionWithRequiredFields[];
}

interface ReportPeriod {
  label: string;
  value: string;
  startDate: Date;
  endDate: Date;
}

interface FinancialMetrics {
  totalInvestment: number;
  totalRevenue: number;
  totalProfit: number;
  roi: number;
  profitMargin: number;
  activeDomains: number;
  soldDomains: number;
  avgHoldingPeriod: number;
  bestPerformingDomain: string;
  worstPerformingDomain: string;
  monthlyTrend: Array<{ month: string; profit: number; revenue: number; cost: number }>;
  categoryBreakdown: Array<{ category: string; amount: number; percentage: number }>;
  riskMetrics: {
    volatility: number;
    maxDrawdown: number;
    sharpeRatio: number;
  };
}

export default function FinancialReport({ domains, transactions }: FinancialReportProps) {
  const { t } = useI18nContext();
  const [selectedPeriod, setSelectedPeriod] = useState('all');
  // const [reportType, setReportType] = useState('overview');
  const [isGenerating, setIsGenerating] = useState(false);

  // 报告周期选项
  const reportPeriods: ReportPeriod[] = useMemo(() => {
    const now = new Date();
    return [
      {
        label: t('reports.allTime'),
        value: 'all',
        startDate: new Date(2020, 0, 1),
        endDate: now
      },
      {
        label: t('reports.thisYear'),
        value: 'year',
        startDate: new Date(now.getFullYear(), 0, 1),
        endDate: now
      },
      {
        label: t('reports.last6Months'),
        value: '6months',
        startDate: new Date(now.getFullYear(), now.getMonth() - 6, 1),
        endDate: now
      },
      {
        label: t('reports.last3Months'),
        value: '3months',
        startDate: new Date(now.getFullYear(), now.getMonth() - 3, 1),
        endDate: now
      },
      {
        label: t('reports.thisMonth'),
        value: 'month',
        startDate: new Date(now.getFullYear(), now.getMonth(), 1),
        endDate: now
      }
    ];
  }, [t]);

  // 过滤数据
  const filteredData = useMemo(() => {
    const period = reportPeriods.find(p => p.value === selectedPeriod);
    if (!period) return { domains, transactions };

    const filteredDomains = domains.filter(domain => {
      const domainDate = new Date(domain.purchase_date || '');
      return domainDate >= period.startDate && domainDate <= period.endDate;
    });

    const filteredTransactions = transactions.filter(transaction => {
      const transactionDate = new Date(transaction.date);
      return transactionDate >= period.startDate && transactionDate <= period.endDate;
    });

    return { domains: filteredDomains, transactions: filteredTransactions };
  }, [domains, transactions, selectedPeriod, reportPeriods]);

  // 计算财务指标
  const financialMetrics: FinancialMetrics = useMemo(() => {
    const { domains: filteredDomains, transactions: filteredTransactions } = filteredData;
    
    // 基础计算
    const totalInvestment = filteredDomains.reduce((sum, domain) => {
      const holdingCost = calculateDomainHoldingCost(
        domain.purchase_cost || 0,
        domain.renewal_cost || 0,
        domain.renewal_count
      );
      return sum + holdingCost;
    }, 0);

    const totalRevenue = filteredTransactions
      .filter(t => t.type === 'sell')
      .reduce((sum, t) => sum + (t.net_amount || t.amount), 0);

    const totalProfit = totalRevenue - totalInvestment;
    const roi = calculateROI(totalInvestment, totalRevenue);
    const profitMargin = calculateProfitMargin(totalRevenue, totalInvestment);

    // 域名统计
    const activeDomains = filteredDomains.filter(d => d.status === 'active').length;
    const soldDomains = filteredDomains.filter(d => d.status === 'sold').length;

    // 平均持有期
    const soldDomainsWithDates = filteredDomains.filter(d => d.status === 'sold');
    const avgHoldingPeriod = soldDomainsWithDates.length > 0 
      ? soldDomainsWithDates.reduce((sum, domain) => {
          const purchaseDate = new Date(domain.purchase_date || '');
          const sellDate = new Date(); // 这里应该从交易记录中获取实际出售日期
          const days = Math.floor((sellDate.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24));
          return sum + days;
        }, 0) / soldDomainsWithDates.length
      : 0;

    // 最佳/最差表现域名
    const domainPerformance = filteredDomains.map(domain => {
      const domainTransactions = filteredTransactions.filter(t => t.domain_id === domain.id);
      const totalSpent = domainTransactions
        .filter(t => t.type === 'buy' || t.type === 'renew' || t.type === 'fee')
        .reduce((sum, t) => sum + t.amount, 0);
      const totalEarned = domainTransactions
        .filter(t => t.type === 'sell')
        .reduce((sum, t) => sum + t.amount, 0);
      const profit = totalEarned - totalSpent;
      return { domain, profit };
    });

    const bestPerforming = domainPerformance.reduce((best, current) => 
      current.profit > best.profit ? current : best, domainPerformance[0] || { domain: { domain_name: 'N/A' } });
    const worstPerforming = domainPerformance.reduce((worst, current) => 
      current.profit < worst.profit ? current : worst, domainPerformance[0] || { domain: { domain_name: 'N/A' } });

    // 月度趋势
    const monthlyTrend = Array.from({ length: 12 }, (_, i) => {
      const date = new Date();
      date.setMonth(date.getMonth() - (11 - i));
      const month = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      
      const monthTransactions = filteredTransactions.filter(t => {
        const transactionDate = new Date(t.date);
        return transactionDate.getMonth() === date.getMonth() && 
               transactionDate.getFullYear() === date.getFullYear();
      });

      const profit = monthTransactions
        .filter(t => t.type === 'sell')
        .reduce((sum, t) => sum + t.amount, 0);
      const revenue = profit;
      const cost = monthTransactions
        .filter(t => t.type === 'buy' || t.type === 'renew' || t.type === 'fee')
        .reduce((sum, t) => sum + t.amount, 0);

      return { month, profit, revenue, cost };
    });

    // 分类分析
    const categoryBreakdown = filteredTransactions.reduce((acc, transaction) => {
      const category = transaction.category || t('reports.uncategorized');
      const existing = acc.find(item => item.category === category);
      if (existing) {
        existing.amount += transaction.amount;
      } else {
        acc.push({ category, amount: transaction.amount, percentage: 0 });
      }
      return acc;
    }, [] as Array<{ category: string; amount: number; percentage: number }>);

    // 计算百分比
    const totalCategoryAmount = categoryBreakdown.reduce((sum, item) => sum + item.amount, 0);
    categoryBreakdown.forEach(item => {
      item.percentage = totalCategoryAmount > 0 ? (item.amount / totalCategoryAmount) * 100 : 0;
    });

    // 风险指标（简化版）
    const returns = monthlyTrend.map(month => month.profit);
    const volatility = returns.length > 1 ? Math.sqrt(returns.reduce((sum, ret) => sum + Math.pow(ret - (returns.reduce((a, b) => a + b, 0) / returns.length), 2), 0) / returns.length) : 0;
    const maxDrawdown = 0; // 简化计算
    const sharpeRatio = 0; // 简化计算

    return {
      totalInvestment,
      totalRevenue,
      totalProfit,
      roi,
      profitMargin,
      activeDomains,
      soldDomains,
      avgHoldingPeriod,
      bestPerformingDomain: bestPerforming.domain.domain_name,
      worstPerformingDomain: worstPerforming.domain.domain_name,
      monthlyTrend,
      categoryBreakdown,
      riskMetrics: {
        volatility,
        maxDrawdown,
        sharpeRatio
      }
    };
  }, [filteredData, t]);

  const handleGenerateReport = async () => {
    setIsGenerating(true);
    // 模拟报告生成
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsGenerating(false);
  };

  const handleExportReport = () => {
    const reportData = {
      period: selectedPeriod,
      generatedAt: new Date().toISOString(),
      metrics: financialMetrics
    };
    
    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `financial-report-${selectedPeriod}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* 报告头部 */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Financial Report</h2>
            <p className="text-gray-600">Comprehensive analysis of your domain investment portfolio</p>
          </div>
          
          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {reportPeriods.map(period => (
                <option key={period.value} value={period.value}>
                  {period.label}
                </option>
              ))}
            </select>
            
            <button
              onClick={handleGenerateReport}
              disabled={isGenerating}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {isGenerating ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Generate Report
            </button>
            
            <button
              onClick={handleExportReport}
              className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </button>
          </div>
        </div>
      </div>

      {/* 关键指标卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Investment</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(financialMetrics.totalInvestment)}
              </p>
            </div>
            <div className="p-3 bg-blue-100 rounded-full">
              <DollarSign className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Revenue</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(financialMetrics.totalRevenue)}
              </p>
            </div>
            <div className="p-3 bg-green-100 rounded-full">
              <TrendingUp className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">ROI</p>
              <p className={`text-2xl font-bold ${financialMetrics.roi >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatPercentage(financialMetrics.roi)}
              </p>
            </div>
            <div className={`p-3 rounded-full ${financialMetrics.roi >= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
              {financialMetrics.roi >= 0 ? (
                <TrendingUp className="h-6 w-6 text-green-600" />
              ) : (
                <TrendingDown className="h-6 w-6 text-red-600" />
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Profit Margin</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatPercentage(financialMetrics.profitMargin)}
              </p>
            </div>
            <div className="p-3 bg-purple-100 rounded-full">
              <Target className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* 详细分析 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 域名统计 */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('reports.domainStatistics')}</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">{t('reports.activeDomains')}</span>
              <span className="font-semibold text-blue-600">{financialMetrics.activeDomains}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">{t('reports.soldDomains')}</span>
              <span className="font-semibold text-green-600">{financialMetrics.soldDomains}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">{t('reports.averageHoldingPeriod')}</span>
              <span className="font-semibold text-gray-900">
                {Math.round(financialMetrics.avgHoldingPeriod)} {t('common.days')}
              </span>
            </div>
          </div>
        </div>

        {/* 表现分析 */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('reports.performanceAnalysis')}</h3>
          <div className="space-y-4">
            <div>
              <span className="text-gray-600">{t('reports.bestPerforming')}</span>
              <p className="font-semibold text-green-600">{financialMetrics.bestPerformingDomain}</p>
            </div>
            <div>
              <span className="text-gray-600">{t('reports.worstPerforming')}</span>
              <p className="font-semibold text-red-600">{financialMetrics.worstPerformingDomain}</p>
            </div>
          </div>
        </div>
      </div>

      {/* 分类分析 */}
      {financialMetrics.categoryBreakdown.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Category Breakdown</h3>
          <div className="space-y-3">
            {financialMetrics.categoryBreakdown.map((category, index) => (
              <div key={index} className="flex items-center justify-between">
                <span className="text-gray-600">{category.category}</span>
                <div className="flex items-center space-x-3">
                  <span className="font-semibold text-gray-900">
                    {formatCurrency(category.amount)}
                  </span>
                  <span className="text-sm text-gray-500">
                    ({formatPercentage(category.percentage)})
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 月度趋势 */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Monthly Trend</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 text-sm font-medium text-gray-600">Month</th>
                <th className="text-right py-2 text-sm font-medium text-gray-600">Revenue</th>
                <th className="text-right py-2 text-sm font-medium text-gray-600">Cost</th>
                <th className="text-right py-2 text-sm font-medium text-gray-600">Profit</th>
              </tr>
            </thead>
            <tbody>
              {financialMetrics.monthlyTrend.map((month, index) => (
                <tr key={index} className="border-b border-gray-100">
                  <td className="py-2 text-sm text-gray-900">{month.month}</td>
                  <td className="py-2 text-sm text-right text-green-600">
                    {formatCurrency(month.revenue)}
                  </td>
                  <td className="py-2 text-sm text-right text-red-600">
                    {formatCurrency(month.cost)}
                  </td>
                  <td className={`py-2 text-sm text-right font-medium ${
                    month.profit >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {formatCurrency(month.profit)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
