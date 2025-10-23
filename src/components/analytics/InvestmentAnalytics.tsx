'use client';

import React, { useState, useMemo } from 'react';
import { useComprehensiveFinancialAnalysis } from '../../hooks/useFinancialCalculations';
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
  Zap,
  Globe
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
  notes: string;
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

  // 使用共享的计算逻辑
  const financialAnalysis = useComprehensiveFinancialAnalysis(domains, transactions);
  
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

  // 辅助函数已移至共享计算库

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

  // 计算域名后缀分布
  const domainSuffixAnalysis = useMemo(() => {
    // 提取域名后缀
    const extractSuffix = (domainName: string): string => {
      const parts = domainName.split('.');
      return parts.length > 1 ? parts[parts.length - 1] : 'unknown';
    };

    // 持有域名后缀分布
    const heldDomains = domains.filter(d => d.status === 'active' || d.status === 'for_sale');
    const heldSuffixCount: { [key: string]: number } = {};
    heldDomains.forEach(domain => {
      const suffix = extractSuffix(domain.domain_name);
      heldSuffixCount[suffix] = (heldSuffixCount[suffix] || 0) + 1;
    });

    // 出售域名后缀分布
    const soldDomains = domains.filter(d => d.status === 'sold');
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
        percentage: (count / heldDomains.length) * 100
      }))
      .sort((a, b) => b.value - a.value);

    const soldSuffixData = Object.entries(soldSuffixCount)
      .map(([suffix, count]) => ({
        name: `.${suffix}`,
        value: count,
        percentage: (count / soldDomains.length) * 100
      }))
      .sort((a, b) => b.value - a.value);

    return {
      heldSuffixData,
      soldSuffixData,
      totalHeld: heldDomains.length,
      totalSold: soldDomains.length
    };
  }, [domains]);

  const renderTrendsAnalysis = () => (
    <div className="space-y-6">
      {/* 月度收益趋势 */}
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

      {/* 域名后缀分析 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 持有域名后缀分布 */}
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">持有域名后缀分布</h3>
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
                  <Tooltip formatter={(value, name) => [`${value}个`, name]} />
                </PieChart>
              </ResponsiveContainer>
              
              {/* 后缀统计列表 */}
              <div className="space-y-2">
                <h4 className="font-medium text-gray-700">详细统计</h4>
                {domainSuffixAnalysis.heldSuffixData.slice(0, 5).map((suffix, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <span className="text-sm font-medium">{suffix.name}</span>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-600">{suffix.value}个</span>
                      <span className="text-xs text-gray-500">({suffix.percentage.toFixed(1)}%)</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Globe className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>暂无持有域名数据</p>
            </div>
          )}
        </div>

        {/* 出售域名后缀分布 */}
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">出售域名后缀分布</h3>
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
                  <Tooltip formatter={(value, name) => [`${value}个`, name]} />
                </PieChart>
              </ResponsiveContainer>
              
              {/* 后缀统计列表 */}
              <div className="space-y-2">
                <h4 className="font-medium text-gray-700">详细统计</h4>
                {domainSuffixAnalysis.soldSuffixData.slice(0, 5).map((suffix, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <span className="text-sm font-medium">{suffix.name}</span>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-600">{suffix.value}个</span>
                      <span className="text-xs text-gray-500">({suffix.percentage.toFixed(1)}%)</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Globe className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>暂无出售域名数据</p>
            </div>
          )}
        </div>
      </div>

      {/* 后缀对比分析 */}
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">后缀对比分析</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 持有域名后缀排名 */}
          <div>
            <h4 className="font-medium text-gray-700 mb-3">持有域名后缀排名</h4>
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
                    <span className="text-sm font-semibold text-blue-600">{suffix.value}个</span>
                    <p className="text-xs text-gray-500">{suffix.percentage.toFixed(1)}%</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 出售域名后缀排名 */}
          <div>
            <h4 className="font-medium text-gray-700 mb-3">出售域名后缀排名</h4>
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
                    <span className="text-sm font-semibold text-green-600">{suffix.value}个</span>
                    <p className="text-xs text-gray-500">{suffix.percentage.toFixed(1)}%</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 投资分布 */}
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
