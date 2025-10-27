// 续费成本管理服务
// 支持动态续费成本、成本历史追踪和智能成本预测

import { supabase } from './supabase';

export interface RenewalCostHistory {
  id: string;
  domain_id: string;
  renewal_date: string;
  renewal_cost: number;
  currency: string;
  exchange_rate: number;
  base_amount: number;
  renewal_cycle: number;
  registrar: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface DomainRenewalCostAnalysis {
  domain_id: string;
  domain_name: string;
  current_renewal_cost: number;
  average_renewal_cost: number;
  cost_trend: 'increasing' | 'decreasing' | 'stable';
  cost_variance: number; // 成本变化百分比
  renewal_frequency: number; // 续费频率（年）
  last_renewal_date?: string;
  next_expected_cost: number;
  cost_history: RenewalCostHistory[];
}

export interface AnnualRenewalCostAnalysis {
  year: number;
  total_estimated_cost: number;
  total_actual_cost: number;
  cost_accuracy: number; // 预测准确性
  domains_needing_renewal: number;
  cost_by_month: { [month: string]: number };
  cost_by_registrar: { [registrar: string]: number };
  cost_trends: {
    average_cost_increase: number;
    most_expensive_domains: string[];
    cost_optimization_opportunities: string[];
  };
}

export class RenewalCostService {
  // 获取域名的续费成本历史（通过RLS策略自动过滤）
  static async getDomainRenewalCostHistory(domainId: string): Promise<RenewalCostHistory[]> {
    const { data, error } = await supabase
      .from('renewal_cost_history')
      .select('*')
      .eq('domain_id', domainId)
      .order('renewal_date', { ascending: false });

    if (error) {
      console.error('Error fetching renewal cost history:', error);
      return [];
    }

    return data || [];
  }

  // 分析域名的续费成本趋势（通过RLS策略自动过滤）
  static async analyzeDomainRenewalCost(domainId: string): Promise<DomainRenewalCostAnalysis | null> {
    const { data: domain } = await supabase
      .from('domains')
      .select('id, domain_name, renewal_cost, renewal_cycle, renewal_count, expiry_date')
      .eq('id', domainId)
      .single();

    if (!domain) return null;

    const costHistory = await this.getDomainRenewalCostHistory(domainId);
    
    if (costHistory.length === 0) {
      return {
        domain_id: domainId,
        domain_name: domain.domain_name,
        current_renewal_cost: domain.renewal_cost,
        average_renewal_cost: domain.renewal_cost,
        cost_trend: 'stable',
        cost_variance: 0,
        renewal_frequency: domain.renewal_cycle,
        next_expected_cost: domain.renewal_cost,
        cost_history: []
      };
    }

    // 计算平均成本
    const averageCost = costHistory.reduce((sum, record) => sum + record.renewal_cost, 0) / costHistory.length;
    
    // 计算成本趋势
    const costs = costHistory.map(record => record.renewal_cost);
    const costTrend = this.calculateCostTrend(costs);
    
    // 计算成本变化百分比
    const latestCost = costs[0];
    const costVariance = averageCost > 0 ? ((latestCost - averageCost) / averageCost) * 100 : 0;
    
    // 预测下次续费成本
    const nextExpectedCost = this.predictNextRenewalCost(costHistory);

    return {
      domain_id: domainId,
      domain_name: domain.domain_name,
      current_renewal_cost: latestCost,
      average_renewal_cost: averageCost,
      cost_trend: costTrend,
      cost_variance: costVariance,
      renewal_frequency: domain.renewal_cycle,
      last_renewal_date: costHistory[0]?.renewal_date,
      next_expected_cost: nextExpectedCost,
      cost_history: costHistory
    };
  }

  // 计算年度续费成本分析（基于传入的域名数据）
  static async calculateAnnualRenewalCostAnalysisFromDomains(
    domains: Array<{ 
      id: string;
      status: string; 
      renewal_cost?: number | null; 
      renewal_cycle?: number;
      created_at?: string;
      domain_name?: string;
      expiry_date?: string | null;
      registrar?: string | null;
    }>,
    year: number = new Date().getFullYear()
  ): Promise<AnnualRenewalCostAnalysis> {
    // 过滤出活跃域名
    const activeDomains = domains.filter(domain => domain.status === 'active');

    if (activeDomains.length === 0) {
      return this.getEmptyAnnualAnalysis(year);
    }

    // 获取该年度的实际续费记录
    const yearStart = new Date(year, 0, 1).toISOString().split('T')[0];
    const yearEnd = new Date(year, 11, 31).toISOString().split('T')[0];

    const { data: actualRenewals } = await supabase
      .from('renewal_cost_history')
      .select('*')
      .gte('renewal_date', yearStart)
      .lte('renewal_date', yearEnd);

    const actualCost = actualRenewals?.reduce((sum, record) => sum + record.renewal_cost, 0) || 0;

    // 计算预计续费成本
    let estimatedCost = 0;
    const domainsNeedingRenewal: string[] = [];
    const costByMonth: { [month: string]: number } = {};
    const costByRegistrar: { [registrar: string]: number } = {};

    // 初始化月度分布
    for (let month = 0; month < 12; month++) {
      costByMonth[month.toString()] = 0;
    }

    activeDomains.forEach(domain => {
      const expiryDate = domain.expiry_date as string;
      if (!expiryDate) return;

      const expiryDateObj = new Date(expiryDate);
      const domainExpiryYear = expiryDateObj.getFullYear();

      if (domainExpiryYear === year) {
        const domainName = domain.domain_name as string;
        domainsNeedingRenewal.push(domainName);
        
        // 获取该域名的历史成本趋势
        this.getDomainRenewalCostHistory(domain.id).then(history => {
          const predictedCost = this.predictNextRenewalCost(history) || domain.renewal_cost || 0;
          estimatedCost += predictedCost;

          // 按月份分布
          const renewalMonth = expiryDateObj.getMonth();
          costByMonth[renewalMonth.toString()] += predictedCost;

          // 按注册商分布
          const registrar = (domain.registrar as string) || 'Unknown';
          costByRegistrar[registrar] = (costByRegistrar[registrar] || 0) + predictedCost;
        });
      }
    });

    // 计算成本趋势
    const costTrends = await this.calculateCostTrends(activeDomains);

    return {
      year,
      total_estimated_cost: estimatedCost,
      total_actual_cost: actualCost,
      cost_accuracy: actualCost > 0 ? (1 - Math.abs(estimatedCost - actualCost) / actualCost) * 100 : 0,
      domains_needing_renewal: domainsNeedingRenewal.length,
      cost_by_month: costByMonth,
      cost_by_registrar: costByRegistrar,
      cost_trends: costTrends
    };
  }

  // 预测下次续费成本
  private static predictNextRenewalCost(costHistory: RenewalCostHistory[]): number {
    if (costHistory.length === 0) return 0;
    if (costHistory.length === 1) return costHistory[0].renewal_cost;

    // 使用线性回归预测
    const costs = costHistory.map((record, index) => ({
      x: index,
      y: record.renewal_cost
    }));

    const n = costs.length;
    const sumX = costs.reduce((sum, point) => sum + point.x, 0);
    const sumY = costs.reduce((sum, point) => sum + point.y, 0);
    const sumXY = costs.reduce((sum, point) => sum + point.x * point.y, 0);
    const sumXX = costs.reduce((sum, point) => sum + point.x * point.x, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // 预测下一个值
    const nextX = n;
    const predictedCost = slope * nextX + intercept;

    // 确保预测值不为负数
    return Math.max(0, predictedCost);
  }

  // 计算成本趋势
  private static calculateCostTrend(costs: number[]): 'increasing' | 'decreasing' | 'stable' {
    if (costs.length < 2) return 'stable';

    const firstHalf = costs.slice(0, Math.floor(costs.length / 2));
    const secondHalf = costs.slice(Math.floor(costs.length / 2));

    const firstAvg = firstHalf.reduce((sum, cost) => sum + cost, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, cost) => sum + cost, 0) / secondHalf.length;

    const changePercent = ((secondAvg - firstAvg) / firstAvg) * 100;

    if (changePercent > 5) return 'increasing';
    if (changePercent < -5) return 'decreasing';
    return 'stable';
  }

  // 计算成本趋势分析
  private static async calculateCostTrends(domains: Array<{ id: string }>): Promise<{
    average_cost_increase: number;
    most_expensive_domains: string[];
    cost_optimization_opportunities: string[];
  }> {
    const domainAnalyses = await Promise.all(
      domains.map(domain => this.analyzeDomainRenewalCost(domain.id))
    );

    const validAnalyses = domainAnalyses.filter(analysis => analysis !== null) as DomainRenewalCostAnalysis[];

    // 计算平均成本增长
    const increasingCosts = validAnalyses.filter(analysis => analysis.cost_trend === 'increasing');
    const averageCostIncrease = increasingCosts.length > 0 
      ? increasingCosts.reduce((sum, analysis) => sum + analysis.cost_variance, 0) / increasingCosts.length
      : 0;

    // 找出最昂贵的域名
    const mostExpensiveDomains = validAnalyses
      .sort((a, b) => b.current_renewal_cost - a.current_renewal_cost)
      .slice(0, 5)
      .map(analysis => analysis.domain_name);

    // 找出成本优化机会
    const optimizationOpportunities = validAnalyses
      .filter(analysis => analysis.cost_trend === 'increasing' && analysis.cost_variance > 10)
      .map(analysis => `${analysis.domain_name} (${analysis.cost_variance.toFixed(1)}% increase)`);

    return {
      average_cost_increase: averageCostIncrease,
      most_expensive_domains: mostExpensiveDomains,
      cost_optimization_opportunities: optimizationOpportunities
    };
  }

  // 获取空的年度分析结果
  private static getEmptyAnnualAnalysis(year: number): AnnualRenewalCostAnalysis {
    return {
      year,
      total_estimated_cost: 0,
      total_actual_cost: 0,
      cost_accuracy: 0,
      domains_needing_renewal: 0,
      cost_by_month: {},
      cost_by_registrar: {},
      cost_trends: {
        average_cost_increase: 0,
        most_expensive_domains: [],
        cost_optimization_opportunities: []
      }
    };
  }

  // 更新域名的续费成本（基于历史数据）
  static async updateDomainRenewalCost(domainId: string): Promise<boolean> {
    const analysis = await this.analyzeDomainRenewalCost(domainId);
    if (!analysis) return false;

    // 如果预测成本与当前成本差异较大，更新域名的续费成本
    const costDifference = Math.abs(analysis.next_expected_cost - analysis.current_renewal_cost);
    const costDifferencePercent = (costDifference / analysis.current_renewal_cost) * 100;

    if (costDifferencePercent > 10) { // 如果差异超过10%
      const { error } = await supabase
        .from('domains')
        .update({ 
          renewal_cost: analysis.next_expected_cost,
          updated_at: new Date().toISOString()
        })
        .eq('id', domainId);

      if (error) {
        console.error('Error updating domain renewal cost:', error);
        return false;
      }

      return true;
    }

    return false;
  }
}
