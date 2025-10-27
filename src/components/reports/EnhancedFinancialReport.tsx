'use client';

import React, { useState, useMemo } from 'react';
import { useI18nContext } from '../../contexts/I18nProvider';
import { DomainWithTags, TransactionWithRequiredFields } from '../../types/dashboard';
import { 
  InvestmentTrendChart, 
  DomainStatusChart, 
  ROIComparisonChart, 
  MonthlyRevenueChart, 
  PlatformFeeChart, 
  PortfolioValueChart 
} from '../charts/ChartLibrary';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  BarChart3, 
  PieChart, 
  LineChart,
  Download,
  Calendar,
  Filter,
  RefreshCw
} from 'lucide-react';

interface EnhancedFinancialReportProps {
  domains: DomainWithTags[];
  transactions: TransactionWithRequiredFields[];
}

export default function EnhancedFinancialReport({ domains, transactions }: EnhancedFinancialReportProps) {
  const { t } = useI18nContext();
  const [selectedPeriod, setSelectedPeriod] = useState('all');
  const [selectedChart, setSelectedChart] = useState('overview');
  const [isGenerating, setIsGenerating] = useState(false);

  // 计算财务指标
  const financialMetrics = useMemo(() => {
    const activeDomains = domains.filter(d => d.status === 'active');
    const soldDomains = domains.filter(d => d.status === 'sold');
    const expiredDomains = domains.filter(d => d.status === 'expired');
    const forSaleDomains = domains.filter(d => d.status === 'for_sale');

    const totalInvestment = domains.reduce((sum, domain) => {
      return sum + (domain.purchase_cost || 0) + (domain.renewal_count * (domain.renewal_cost || 0));
    }, 0);

    const totalRevenue = transactions
      .filter(t => t.type === 'sell')
      .reduce((sum, t) => sum + (t.net_amount || t.amount), 0);

    const totalProfit = totalRevenue - totalInvestment;
    const roi = totalInvestment > 0 ? (totalProfit / totalInvestment) * 100 : 0;

    const avgPurchasePrice = domains.length > 0 
      ? domains.reduce((sum, d) => sum + (d.purchase_cost || 0), 0) / domains.length 
      : 0;

    const avgSalePrice = soldDomains.length > 0
      ? soldDomains.reduce((sum, d) => sum + (d.sale_price || 0), 0) / soldDomains.length
      : 0;

    return {
      totalInvestment,
      totalRevenue,
      totalProfit,
      roi,
      activeDomains: activeDomains.length,
      soldDomains: soldDomains.length,
      expiredDomains: expiredDomains.length,
      forSaleDomains: forSaleDomains.length,
      avgPurchasePrice,
      avgSalePrice,
    };
  }, [domains, transactions]);

  // 计算图表数据
  const chartData = useMemo(() => {
    // 投资趋势数据
    const investmentTrendData = transactions
      .filter(t => t.type === 'buy' || t.type === 'renew')
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .reduce((acc, transaction) => {
        const date = new Date(transaction.date).toISOString().split('T')[0];
        const existing = acc.find(item => item.date === date);
        if (existing) {
          existing.investment += transaction.amount;
        } else {
          acc.push({
            date,
            investment: transaction.amount,
            revenue: 0,
            profit: 0,
          });
        }
        return acc;
      }, [] as Array<{ date: string; investment: number; revenue: number; profit: number }>);

    // 添加收入数据
    transactions
      .filter(t => t.type === 'sell')
      .forEach(transaction => {
        const date = new Date(transaction.date).toISOString().split('T')[0];
        const existing = investmentTrendData.find(item => item.date === date);
        if (existing) {
          existing.revenue += transaction.net_amount || transaction.amount;
        } else {
          investmentTrendData.push({
            date,
            investment: 0,
            revenue: transaction.net_amount || transaction.amount,
            profit: 0,
          });
        }
      });

    // 计算利润
    investmentTrendData.forEach(item => {
      item.profit = item.revenue - item.investment;
    });

    // 域名状态数据
    const domainStatusData = {
      active: financialMetrics.activeDomains,
      forSale: financialMetrics.forSaleDomains,
      sold: financialMetrics.soldDomains,
      expired: financialMetrics.expiredDomains,
    };

    // ROI对比数据
    const roiData = domains
      .filter(d => d.status === 'sold' && d.sale_price && d.purchase_cost)
      .map(domain => {
        const investment = (domain.purchase_cost || 0) + (domain.renewal_count * (domain.renewal_cost || 0));
        const revenue = domain.sale_price || 0;
        const roi = investment > 0 ? ((revenue - investment) / investment) * 100 : 0;
        return {
          domain: domain.domain_name,
          roi,
          investment,
          revenue,
        };
      })
      .sort((a, b) => b.roi - a.roi)
      .slice(0, 10);

    // 月度收入数据
    const monthlyRevenueData = transactions
      .filter(t => t.type === 'sell')
      .reduce((acc, transaction) => {
        const month = new Date(transaction.date).toISOString().slice(0, 7);
        const existing = acc.find(item => item.month === month);
        if (existing) {
          existing.revenue += transaction.net_amount || transaction.amount;
        } else {
          acc.push({
            month,
            revenue: transaction.net_amount || transaction.amount,
            investment: 0,
            profit: 0,
          });
        }
        return acc;
      }, [] as Array<{ month: string; revenue: number; investment: number; profit: number }>);

    // 平台费用数据
    const platformFeeData = transactions
      .filter(t => t.platform_fee && t.platform_fee > 0)
      .reduce((acc, transaction) => {
        const platform = transaction.platform || 'Unknown';
        const existing = acc.find(item => item.platform === platform);
        if (existing) {
          existing.totalFees += transaction.platform_fee || 0;
          existing.transactionCount += 1;
        } else {
          acc.push({
            platform,
            totalFees: transaction.platform_fee || 0,
            transactionCount: 1,
            averageFee: transaction.platform_fee || 0,
          });
        }
        return acc;
      }, [] as Array<{ platform: string; totalFees: number; transactionCount: number; averageFee: number }>);

    // 计算平均费用
    platformFeeData.forEach(item => {
      item.averageFee = item.totalFees / item.transactionCount;
    });

    return {
      investmentTrend: investmentTrendData,
      domainStatus: domainStatusData,
      roiComparison: roiData,
      monthlyRevenue: monthlyRevenueData,
      platformFees: platformFeeData,
    };
  }, [domains, transactions, financialMetrics]);

  // 生成报告
  const handleGenerateReport = async () => {
    setIsGenerating(true);
    // 模拟报告生成
    await new Promise(resolve => setTimeout(resolve, 2000));
    setIsGenerating(false);
  };

  // 导出报告
  const handleExportReport = () => {
    const reportData = {
      financialMetrics,
      chartData,
      generatedAt: new Date().toISOString(),
      period: selectedPeriod,
    };
    
    const dataStr = JSON.stringify(reportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `financial-report-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* 报告头部 */}
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{t('reports.enhancedFinancialReport')}</h2>
            <p className="text-gray-600 mt-1">{t('reports.comprehensiveAnalysis')}</p>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={handleGenerateReport}
              disabled={isGenerating}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {isGenerating ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <BarChart3 className="w-4 h-4 mr-2" />
              )}
              {isGenerating ? t('reports.generating') : t('reports.generateReport')}
            </button>
            <button
              onClick={handleExportReport}
              className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <Download className="w-4 h-4 mr-2" />
              {t('reports.exportReport')}
            </button>
          </div>
        </div>

        {/* 控制面板 */}
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center space-x-2">
            <Calendar className="w-4 h-4 text-gray-500" />
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm"
            >
              <option value="all">{t('reports.allTime')}</option>
              <option value="year">{t('reports.thisYear')}</option>
              <option value="6months">{t('reports.last6Months')}</option>
              <option value="3months">{t('reports.last3Months')}</option>
              <option value="month">{t('reports.thisMonth')}</option>
            </select>
          </div>
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <select
              value={selectedChart}
              onChange={(e) => setSelectedChart(e.target.value)}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm"
            >
              <option value="overview">{t('reports.overview')}</option>
              <option value="trends">{t('reports.trends')}</option>
              <option value="performance">{t('reports.performance')}</option>
              <option value="analysis">{t('reports.analysis')}</option>
            </select>
          </div>
        </div>
      </div>

      {/* 关键指标卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">{t('reports.totalInvestment')}</p>
              <p className="text-2xl font-bold text-gray-900">
                ${financialMetrics.totalInvestment.toLocaleString()}
              </p>
            </div>
            <div className="p-3 bg-blue-100 rounded-full">
              <DollarSign className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">{t('reports.totalRevenue')}</p>
              <p className="text-2xl font-bold text-gray-900">
                ${financialMetrics.totalRevenue.toLocaleString()}
              </p>
            </div>
            <div className="p-3 bg-green-100 rounded-full">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">{t('reports.totalProfit')}</p>
              <p className={`text-2xl font-bold ${financialMetrics.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ${financialMetrics.totalProfit.toLocaleString()}
              </p>
            </div>
            <div className={`p-3 rounded-full ${financialMetrics.totalProfit >= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
              {financialMetrics.totalProfit >= 0 ? (
                <TrendingUp className="w-6 h-6 text-green-600" />
              ) : (
                <TrendingDown className="w-6 h-6 text-red-600" />
              )}
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">{t('reports.roi')}</p>
              <p className={`text-2xl font-bold ${financialMetrics.roi >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {financialMetrics.roi.toFixed(1)}%
              </p>
            </div>
            <div className={`p-3 rounded-full ${financialMetrics.roi >= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
              {financialMetrics.roi >= 0 ? (
                <TrendingUp className="w-6 h-6 text-green-600" />
              ) : (
                <TrendingDown className="w-6 h-6 text-red-600" />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 图表区域 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 投资趋势图 */}
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">{t('charts.investmentTrend')}</h3>
            <LineChart className="w-5 h-5 text-gray-500" />
          </div>
          <InvestmentTrendChart data={chartData.investmentTrend} />
        </div>

        {/* 域名状态分布图 */}
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">{t('charts.domainStatusDistribution')}</h3>
            <PieChart className="w-5 h-5 text-gray-500" />
          </div>
          <DomainStatusChart data={chartData.domainStatus} />
        </div>

        {/* ROI对比图 */}
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">{t('charts.topROIDomains')}</h3>
            <BarChart3 className="w-5 h-5 text-gray-500" />
          </div>
          <ROIComparisonChart data={chartData.roiComparison} />
        </div>

        {/* 月度收入趋势图 */}
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">{t('charts.monthlyRevenueTrend')}</h3>
            <LineChart className="w-5 h-5 text-gray-500" />
          </div>
          <MonthlyRevenueChart data={chartData.monthlyRevenue} />
        </div>

        {/* 平台费用分析图 */}
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">{t('charts.platformFeeAnalysis')}</h3>
            <BarChart3 className="w-5 h-5 text-gray-500" />
          </div>
          <PlatformFeeChart data={chartData.platformFees} />
        </div>

        {/* 投资组合价值变化图 */}
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">{t('charts.portfolioValueChange')}</h3>
            <LineChart className="w-5 h-5 text-gray-500" />
          </div>
          <PortfolioValueChart data={chartData.investmentTrend.map(item => ({
            date: item.date,
            totalValue: item.investment + item.revenue,
            totalInvestment: item.investment,
            totalRevenue: item.revenue,
          }))} />
        </div>
      </div>
    </div>
  );
}
