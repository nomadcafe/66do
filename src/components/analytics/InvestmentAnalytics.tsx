'use client';

import React, { useState, useMemo } from 'react';
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
  AreaChart
} from 'recharts';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Target, 
  AlertTriangle,
  BarChart3,
  Activity,
  Zap
} from 'lucide-react';

interface Domain {
  id: string;
  domain_name: string;
  registrar: string;
  purchase_date: string;
  purchase_cost: number;
  renewal_cost: number;
  renewal_cycle: number;
  renewal_count: number;
  expiry_date?: string;
  status: 'active' | 'for_sale' | 'sold' | 'expired';
  estimated_value: number;
  sale_date?: string;
  sale_price?: number;
  platform_fee?: number;
  tags: string[];
}

interface Transaction {
  id: string;
  domain_id: string;
  type: 'buy' | 'sell' | 'renew' | 'transfer' | 'fee' | 'marketing' | 'advertising';
  amount: number;
  currency: string;
  date: string;
  notes?: string;
  platform?: string;
  exchange_rate?: number;
  base_amount?: number;
  platform_fee?: number;
  platform_fee_percentage?: number;
  net_amount?: number;
  category?: string;
  tax_deductible?: boolean;
  receipt_url?: string;
}

interface InvestmentAnalyticsProps {
  domains: Domain[];
  transactions: Transaction[];
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
  const [selectedTimeframe, setSelectedTimeframe] = useState<'1M' | '3M' | '6M' | '1Y' | 'ALL'>('ALL');
  const [selectedMetric, setSelectedMetric] = useState<'portfolio' | 'performance' | 'risk' | 'trends'>('portfolio');

  // 计算投资组合指标
  const portfolioMetrics: PortfolioMetrics = useMemo(() => {
    const totalInvestment = domains.reduce((sum, domain) => {
      const holdingCost = domain.purchase_cost + (domain.renewal_count * domain.renewal_cost);
      return sum + holdingCost;
    }, 0);

    const totalRevenue = transactions
      .filter(t => t.type === 'sell')
      .reduce((sum, t) => sum + (t.net_amount || t.amount), 0);

    const totalProfit = totalRevenue - totalInvestment;
    const totalReturn = totalInvestment > 0 ? (totalProfit / totalInvestment) * 100 : 0;

    // 计算年化收益率
    const oldestDomain = domains.reduce((oldest, domain) => {
      const domainDate = new Date(domain.purchase_date);
      const oldestDate = new Date(oldest.purchase_date);
      return domainDate < oldestDate ? domain : oldest;
    }, domains[0]);
    
    const years = oldestDomain ? 
      (new Date().getTime() - new Date(oldestDomain.purchase_date).getTime()) / (1000 * 60 * 60 * 24 * 365) : 1;
    
    const annualizedReturn = years > 0 ? Math.pow(1 + totalReturn / 100, 1 / years) - 1 : 0;

    // 计算夏普比率（简化版）
    const monthlyReturns = calculateMonthlyReturns(domains, transactions);
    const avgReturn = monthlyReturns.reduce((sum, r) => sum + r, 0) / monthlyReturns.length;
    const variance = monthlyReturns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / monthlyReturns.length;
    const volatility = Math.sqrt(variance);
    const sharpeRatio = volatility > 0 ? (avgReturn - 0.02) / volatility : 0; // 假设无风险利率2%

    // 计算最大回撤
    const maxDrawdown = calculateMaxDrawdown(monthlyReturns);

    // 计算胜率
    const soldDomains = domains.filter(d => d.status === 'sold');
    const profitableDomains = soldDomains.filter(d => {
      const totalCost = d.purchase_cost + (d.renewal_count * d.renewal_cost);
      return (d.sale_price || 0) > totalCost;
    });
    const winRate = soldDomains.length > 0 ? (profitableDomains.length / soldDomains.length) * 100 : 0;

    // 计算平均持有期
    const avgHoldingPeriod = soldDomains.length > 0 ? 
      soldDomains.reduce((sum, domain) => {
        const purchaseDate = new Date(domain.purchase_date);
        const saleDate = new Date(domain.sale_date || domain.purchase_date);
        return sum + (saleDate.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24);
      }, 0) / soldDomains.length : 0;

    // 最佳和最差表现域名
    const domainPerformance = domains.map(domain => {
      const totalCost = domain.purchase_cost + (domain.renewal_count * domain.renewal_cost);
      const revenue = domain.sale_price || domain.estimated_value;
      const profit = revenue - totalCost;
      const roi = totalCost > 0 ? (profit / totalCost) * 100 : 0;
      return { domain, profit, roi };
    });

    const bestDomain = domainPerformance.reduce((best, current) => 
      current.roi > best.roi ? current : best, domainPerformance[0] || { domain: { domain_name: 'N/A' }, roi: 0 }
    );

    const worstDomain = domainPerformance.reduce((worst, current) => 
      current.roi < worst.roi ? current : worst, domainPerformance[0] || { domain: { domain_name: 'N/A' }, roi: 0 }
    );

    return {
      totalInvestment,
      totalRevenue,
      totalProfit,
      totalReturn,
      annualizedReturn: annualizedReturn * 100,
      sharpeRatio,
      maxDrawdown,
      volatility: volatility * 100,
      winRate,
      avgHoldingPeriod,
      bestPerformingDomain: bestDomain.domain.domain_name,
      worstPerformingDomain: worstDomain.domain.domain_name
    };
  }, [domains, transactions]);

  // 计算时间序列数据
  const timeSeriesData: TimeSeriesData[] = useMemo(() => {
    const data: TimeSeriesData[] = [];
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 12); // 过去12个月

    for (let i = 0; i < 12; i++) {
      const date = new Date(startDate);
      date.setMonth(date.getMonth() + i);
      const monthKey = date.toISOString().slice(0, 7);

      const monthDomains = domains.filter(d => 
        new Date(d.purchase_date).toISOString().slice(0, 7) <= monthKey
      );

      const monthTransactions = transactions.filter(t => 
        new Date(t.date).toISOString().slice(0, 7) === monthKey
      );

      const investment = monthDomains.reduce((sum, domain) => {
        const holdingCost = domain.purchase_cost + (domain.renewal_count * domain.renewal_cost);
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
  }, [domains, transactions]);

  // 计算风险分析
  const riskAnalysis: RiskAnalysis = useMemo(() => {
    const totalValue = portfolioMetrics.totalInvestment + portfolioMetrics.totalProfit;
    const domainValues = domains.map(d => d.estimated_value);
    const maxDomainValue = Math.max(...domainValues);
    const concentrationRisk = totalValue > 0 ? (maxDomainValue / totalValue) * 100 : 0;

    const activeDomains = domains.filter(d => d.status === 'active').length;
    const forSaleDomains = domains.filter(d => d.status === 'for_sale').length;
    const liquidityRisk = totalValue > 0 ? ((activeDomains + forSaleDomains) / domains.length) * 100 : 0;

    const diversificationScore = Math.min(100, domains.length * 10); // 每个域名10分，最高100分

    let riskLevel: 'Low' | 'Medium' | 'High' = 'Low';
    if (concentrationRisk > 50 || portfolioMetrics.volatility > 30 || liquidityRisk < 30) {
      riskLevel = 'High';
    } else if (concentrationRisk > 30 || portfolioMetrics.volatility > 20 || liquidityRisk < 50) {
      riskLevel = 'Medium';
    }

    const recommendations: string[] = [];
    if (concentrationRisk > 30) {
      recommendations.push('考虑分散投资，降低单一域名占比');
    }
    if (portfolioMetrics.volatility > 20) {
      recommendations.push('投资组合波动性较高，建议增加稳定收益域名');
    }
    if (liquidityRisk < 50) {
      recommendations.push('流动性不足，建议增加待售域名数量');
    }
    if (domains.length < 5) {
      recommendations.push('域名数量较少，建议增加投资组合多样性');
    }

    return {
      riskLevel,
      diversificationScore,
      concentrationRisk,
      liquidityRisk,
      recommendations
    };
  }, [domains, portfolioMetrics]);

  // 辅助函数
  function calculateMonthlyReturns(domains: Domain[], transactions: Transaction[]): number[] {
    const returns: number[] = [];
    for (let i = 0; i < 12; i++) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthKey = date.toISOString().slice(0, 7);
      
      const monthTransactions = transactions.filter(t => 
        new Date(t.date).toISOString().slice(0, 7) === monthKey
      );
      
      const revenue = monthTransactions
        .filter(t => t.type === 'sell')
        .reduce((sum, t) => sum + (t.net_amount || t.amount), 0);
      
      const investment = domains.reduce((sum, domain) => {
        const holdingCost = domain.purchase_cost + (domain.renewal_count * domain.renewal_cost);
        return sum + holdingCost;
      }, 0);
      
      const monthlyReturn = investment > 0 ? (revenue / investment) * 100 : 0;
      returns.push(monthlyReturn);
    }
    return returns;
  }

  function calculateMaxDrawdown(returns: number[]): number {
    let maxDrawdown = 0;
    let peak = 0;
    let runningSum = 0;

    for (const return_ of returns) {
      runningSum += return_;
      if (runningSum > peak) {
        peak = runningSum;
      }
      const drawdown = peak - runningSum;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    return maxDrawdown;
  }

  const renderPortfolioMetrics = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-6 rounded-lg text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-blue-100 text-sm">总投资</p>
            <p className="text-2xl font-bold">${portfolioMetrics.totalInvestment.toLocaleString()}</p>
          </div>
          <DollarSign className="h-8 w-8 text-blue-200" />
        </div>
      </div>

      <div className="bg-gradient-to-br from-green-500 to-green-600 p-6 rounded-lg text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-green-100 text-sm">总收益</p>
            <p className="text-2xl font-bold">${portfolioMetrics.totalRevenue.toLocaleString()}</p>
          </div>
          <TrendingUp className="h-8 w-8 text-green-200" />
        </div>
      </div>

      <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-6 rounded-lg text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-purple-100 text-sm">净利润</p>
            <p className="text-2xl font-bold">${portfolioMetrics.totalProfit.toLocaleString()}</p>
          </div>
          <Target className="h-8 w-8 text-purple-200" />
        </div>
      </div>

      <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-6 rounded-lg text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-orange-100 text-sm">总回报率</p>
            <p className="text-2xl font-bold">{portfolioMetrics.totalReturn.toFixed(1)}%</p>
          </div>
          <BarChart3 className="h-8 w-8 text-orange-200" />
        </div>
      </div>

      <div className="bg-gradient-to-br from-red-500 to-red-600 p-6 rounded-lg text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-red-100 text-sm">年化收益率</p>
            <p className="text-2xl font-bold">{portfolioMetrics.annualizedReturn.toFixed(1)}%</p>
          </div>
          <Activity className="h-8 w-8 text-red-200" />
        </div>
      </div>

      <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 p-6 rounded-lg text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-indigo-100 text-sm">夏普比率</p>
            <p className="text-2xl font-bold">{portfolioMetrics.sharpeRatio.toFixed(2)}</p>
          </div>
          <Zap className="h-8 w-8 text-indigo-200" />
        </div>
      </div>
    </div>
  );

  const renderPerformanceChart = () => (
    <div className="bg-white p-6 rounded-lg shadow-sm border">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">投资组合表现</h3>
      <ResponsiveContainer width="100%" height={400}>
        <AreaChart data={timeSeriesData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis />
          <Tooltip 
            formatter={(value, name) => [
              `$${Number(value).toLocaleString()}`, 
              name === 'investment' ? '投资' : 
              name === 'revenue' ? '收益' : 
              name === 'profit' ? '利润' : '组合价值'
            ]}
          />
          <Area 
            type="monotone" 
            dataKey="investment" 
            stackId="1" 
            stroke="#3B82F6" 
            fill="#3B82F6" 
            fillOpacity={0.6}
            name="投资"
          />
          <Area 
            type="monotone" 
            dataKey="revenue" 
            stackId="2" 
            stroke="#10B981" 
            fill="#10B981" 
            fillOpacity={0.6}
            name="收益"
          />
          <Line 
            type="monotone" 
            dataKey="portfolioValue" 
            stroke="#8B5CF6" 
            strokeWidth={3}
            name="组合价值"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );

  const renderRiskAnalysis = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">风险指标</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-gray-600">风险等级</span>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              riskAnalysis.riskLevel === 'Low' ? 'bg-green-100 text-green-800' :
              riskAnalysis.riskLevel === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
              'bg-red-100 text-red-800'
            }`}>
              {riskAnalysis.riskLevel}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-600">分散化评分</span>
            <span className="text-lg font-semibold">{riskAnalysis.diversificationScore}/100</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-600">集中度风险</span>
            <span className="text-lg font-semibold">{riskAnalysis.concentrationRisk.toFixed(1)}%</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-600">流动性风险</span>
            <span className="text-lg font-semibold">{riskAnalysis.liquidityRisk.toFixed(1)}%</span>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">投资建议</h3>
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
              <p className="text-sm text-green-800">投资组合表现良好，风险控制得当</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderTrendsAnalysis = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">月度收益趋势</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={timeSeriesData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip formatter={(value) => [`${Number(value).toFixed(1)}%`, '月度收益']} />
            <Line 
              type="monotone" 
              dataKey="monthlyReturn" 
              stroke="#3B82F6" 
              strokeWidth={2}
              name="月度收益"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">投资分布</h3>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={[
                { name: '活跃域名', value: domains.filter(d => d.status === 'active').length, color: '#10B981' },
                { name: '待售域名', value: domains.filter(d => d.status === 'for_sale').length, color: '#F59E0B' },
                { name: '已售域名', value: domains.filter(d => d.status === 'sold').length, color: '#3B82F6' },
                { name: '已过期', value: domains.filter(d => d.status === 'expired').length, color: '#EF4444' },
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
                { name: '活跃域名', value: domains.filter(d => d.status === 'active').length, color: '#10B981' },
                { name: '待售域名', value: domains.filter(d => d.status === 'for_sale').length, color: '#F59E0B' },
                { name: '已售域名', value: domains.filter(d => d.status === 'sold').length, color: '#3B82F6' },
                { name: '已过期', value: domains.filter(d => d.status === 'expired').length, color: '#EF4444' },
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

  return (
    <div className="space-y-6">
      {/* 分析类型选择器 */}
      <div className="bg-white p-4 rounded-lg shadow-sm border">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">投资分析</h3>
          <div className="flex items-center space-x-4">
            <select
              value={selectedMetric}
              onChange={(e) => setSelectedMetric(e.target.value as 'portfolio' | 'performance' | 'risk' | 'trends')}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="portfolio">投资组合</option>
              <option value="performance">表现分析</option>
              <option value="risk">风险评估</option>
              <option value="trends">趋势分析</option>
            </select>
            <select
              value={selectedTimeframe}
              onChange={(e) => setSelectedTimeframe(e.target.value as '1M' | '3M' | '6M' | '1Y' | 'ALL')}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="1M">1个月</option>
              <option value="3M">3个月</option>
              <option value="6M">6个月</option>
              <option value="1Y">1年</option>
              <option value="ALL">全部</option>
            </select>
          </div>
        </div>
      </div>

      {/* 投资组合指标 */}
      {selectedMetric === 'portfolio' && (
        <div className="space-y-6">
          {renderPortfolioMetrics()}
          {renderPerformanceChart()}
        </div>
      )}

      {/* 表现分析 */}
      {selectedMetric === 'performance' && (
        <div className="space-y-6">
          {renderPerformanceChart()}
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">关键指标</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">胜率</p>
                <p className="text-2xl font-bold text-green-600">{portfolioMetrics.winRate.toFixed(1)}%</p>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">平均持有期</p>
                <p className="text-2xl font-bold text-blue-600">{portfolioMetrics.avgHoldingPeriod.toFixed(0)}天</p>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">最大回撤</p>
                <p className="text-2xl font-bold text-red-600">{portfolioMetrics.maxDrawdown.toFixed(1)}%</p>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">波动率</p>
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
            <h3 className="text-lg font-semibold text-gray-900 mb-4">最佳/最差表现</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-4 bg-green-50 rounded-lg">
                <div className="flex items-center space-x-2 mb-2">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                  <span className="font-medium text-green-800">最佳表现</span>
                </div>
                <p className="text-lg font-semibold text-green-900">{portfolioMetrics.bestPerformingDomain}</p>
              </div>
              <div className="p-4 bg-red-50 rounded-lg">
                <div className="flex items-center space-x-2 mb-2">
                  <TrendingDown className="h-5 w-5 text-red-600" />
                  <span className="font-medium text-red-800">最差表现</span>
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
