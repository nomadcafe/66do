// 续费成本管理服务
// 支持动态续费成本、成本历史追踪和智能成本预测

import { supabase } from './supabase';

interface RenewalCostHistory {
  id: string;
  domain_id: string;
  renewal_date: string;
  renewal_cost: number;
  currency: string;
  renewal_cycle: number;
  registrar: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface AnnualRenewalCostAnalysis {
  year: number;
  total_estimated_cost: number;
  total_actual_cost: number;
  cost_accuracy: number; // 预测准确性，已在源头夹紧到 [0, 100]
  domains_needing_renewal: number;
  cost_by_registrar: { [registrar: string]: number };
  cost_trends: {
    average_cost_increase: number;
    most_expensive_domains: string[];
    cost_optimization_opportunities: string[];
  };
}

/** 按自然年的续费预估与实际（用于多年对比） */
export interface RenewalYearSummary {
  year: number;
  total_estimated_cost: number;
  total_actual_cost: number;
  domains_needing_renewal: number;
}

export class RenewalCostService {
  /** 批量拉取续费历史，避免按域名 N 次查询 */
  private static async batchFetchRenewalHistories(domainIds: string[]): Promise<Map<string, RenewalCostHistory[]>> {
    const map = new Map<string, RenewalCostHistory[]>();
    if (domainIds.length === 0) return map;
    const { data, error } = await supabase
      .from('renewal_cost_history')
      .select('*')
      .in('domain_id', domainIds);
    if (error) {
      console.error('batchFetchRenewalHistories:', error);
      return map;
    }
    for (const row of data || []) {
      const id = row.domain_id as string;
      const list = map.get(id) || [];
      list.push(row as RenewalCostHistory);
      map.set(id, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => b.renewal_date.localeCompare(a.renewal_date));
    }
    return map;
  }

  /** 某年到期域名的预估续费总额、数量、按注册商分布（基于已分组的历史） */
  private static buildAnnualEstimatedBreakdown(
    year: number,
    activeDomains: Array<{
      id: string;
      domain_name?: string;
      renewal_cost?: number | null;
      expiry_date?: string | null;
      registrar?: string | null;
    }>,
    historyByDomain: Map<string, RenewalCostHistory[]>
  ): {
    total_estimated_cost: number;
    domains_needing_renewal: number;
    cost_by_registrar: { [registrar: string]: number };
  } {
    let total_estimated_cost = 0;
    let domains_needing_renewal = 0;
    const cost_by_registrar: { [registrar: string]: number } = {};

    for (const domain of activeDomains) {
      const expiryDate = domain.expiry_date;
      if (!expiryDate) continue;
      const expiryDateObj = new Date(expiryDate);
      if (expiryDateObj.getFullYear() !== year) continue;

      domains_needing_renewal += 1;
      const history = historyByDomain.get(domain.id) || [];
      const predictedCost =
        history.length > 0 ? this.predictNextRenewalCost(history) : (domain.renewal_cost ?? 0);
      total_estimated_cost += predictedCost;
      const registrar = (domain.registrar as string) || 'Unknown';
      cost_by_registrar[registrar] = (cost_by_registrar[registrar] || 0) + predictedCost;
    }

    return { total_estimated_cost, domains_needing_renewal, cost_by_registrar };
  }

  /**
   * 高级续费面板：一次批量拉历史 + 一次按年实际续费查询，返回所选年度详情 + 过去/未来多年的年度汇总
   */
  static async getAdvancedRenewalPanelData(
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
    selectedYear: number,
    options?: { pastYears?: number; futureYears?: number }
  ): Promise<{
    analysis: AnnualRenewalCostAnalysis;
    yearSummaries: RenewalYearSummary[];
  }> {
    const pastYears = options?.pastYears ?? 2;
    const futureYears = options?.futureYears ?? 3;
    // 只剔除明确退出生命周期的（已售/已弃）；for_sale 仍在持有，仍需续费。
    const activeDomains = domains.filter((d) => d.status !== 'sold' && d.status !== 'expired');

    if (activeDomains.length === 0) {
      return {
        analysis: this.getEmptyAnnualAnalysis(selectedYear),
        yearSummaries: [],
      };
    }

    const ids = activeDomains.map((d) => d.id);
    const historyByDomain = await this.batchFetchRenewalHistories(ids);

    // 一次查 [selectedYear-pastYears, selectedYear+futureYears] 的所有实际续费记录，
    // 按年汇总到 actualByYear；selectedYear 当年的实际值直接从 map 取，
    // 不再单独发一次查询。
    const sumStart = selectedYear - pastYears;
    const sumEnd = selectedYear + futureYears;
    const rangeStart = `${sumStart}-01-01`;
    const rangeEnd = `${sumEnd}-12-31`;

    const { data: actualsInRange } = await supabase
      .from('renewal_cost_history')
      .select('renewal_date, renewal_cost')
      .in('domain_id', ids)
      .gte('renewal_date', rangeStart)
      .lte('renewal_date', rangeEnd);

    const actualByYear = new Map<number, number>();
    for (const row of actualsInRange || []) {
      const y = new Date(row.renewal_date as string).getFullYear();
      actualByYear.set(y, (actualByYear.get(y) || 0) + (row.renewal_cost as number));
    }

    const breakdown = this.buildAnnualEstimatedBreakdown(selectedYear, activeDomains, historyByDomain);
    const actualCost = actualByYear.get(selectedYear) || 0;
    const costTrends = this.calculateCostTrends(activeDomains, historyByDomain);

    const rawAccuracy =
      actualCost > 0
        ? (1 - Math.abs(breakdown.total_estimated_cost - actualCost) / actualCost) * 100
        : 0;

    const analysis: AnnualRenewalCostAnalysis = {
      year: selectedYear,
      total_estimated_cost: breakdown.total_estimated_cost,
      total_actual_cost: actualCost,
      // 源头就夹到 [0, 100]：预估远大于实际时原公式会输出 -300% 之类的负值，
      // 这种值进序列化/日志/下游计算都没意义。UI 不再需要再夹一次。
      cost_accuracy: actualCost > 0 ? Math.max(0, Math.min(100, rawAccuracy)) : 0,
      domains_needing_renewal: breakdown.domains_needing_renewal,
      cost_by_registrar: breakdown.cost_by_registrar,
      cost_trends: costTrends,
    };

    const yearSummaries: RenewalYearSummary[] = [];
    for (let y = sumStart; y <= sumEnd; y++) {
      const b = this.buildAnnualEstimatedBreakdown(y, activeDomains, historyByDomain);
      yearSummaries.push({
        year: y,
        total_estimated_cost: b.total_estimated_cost,
        total_actual_cost: actualByYear.get(y) || 0,
        domains_needing_renewal: b.domains_needing_renewal,
      });
    }

    return { analysis, yearSummaries };
  }

  // 预测下次续费成本（基于历史的线性回归）
  private static predictNextRenewalCost(costHistory: RenewalCostHistory[]): number {
    if (costHistory.length === 0) return 0;
    if (costHistory.length === 1) return costHistory[0].renewal_cost;

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

    const nextX = n;
    const predictedCost = slope * nextX + intercept;

    return Math.max(0, predictedCost);
  }

  // 基于历史价格序列判断趋势（前后两半均值对比）
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

  // 趋势分析：完全在内存里基于已批量拉到的 historyByDomain 计算，零额外 DB 查询。
  // （旧实现给每个 domain 都单独 select domains + select renewal_cost_history，N 个 domain = 2N 个 query。）
  private static calculateCostTrends(
    activeDomains: Array<{ id: string; domain_name?: string; renewal_cost?: number | null }>,
    historyByDomain: Map<string, RenewalCostHistory[]>
  ): {
    average_cost_increase: number;
    most_expensive_domains: string[];
    cost_optimization_opportunities: string[];
  } {
    type DomainStat = {
      name: string;
      currentCost: number;
      trend: 'increasing' | 'decreasing' | 'stable';
      variance: number;
    };

    const stats: DomainStat[] = activeDomains.map((d) => {
      const history = historyByDomain.get(d.id) || [];
      if (history.length === 0) {
        return {
          name: d.domain_name || '',
          currentCost: d.renewal_cost ?? 0,
          trend: 'stable',
          variance: 0,
        };
      }
      // batchFetchRenewalHistories 已按 renewal_date 降序排，costs[0] 即最近一次。
      const costs = history.map((h) => h.renewal_cost);
      const avg = costs.reduce((sum, c) => sum + c, 0) / costs.length;
      const latest = costs[0];
      return {
        name: d.domain_name || '',
        currentCost: latest,
        trend: this.calculateCostTrend(costs),
        variance: avg > 0 ? ((latest - avg) / avg) * 100 : 0,
      };
    });

    const increasing = stats.filter((s) => s.trend === 'increasing');
    const averageCostIncrease =
      increasing.length > 0
        ? increasing.reduce((sum, s) => sum + s.variance, 0) / increasing.length
        : 0;

    const mostExpensiveDomains = [...stats]
      .sort((a, b) => b.currentCost - a.currentCost)
      .slice(0, 5)
      .map((s) => s.name);

    const optimizationOpportunities = stats
      .filter((s) => s.trend === 'increasing' && s.variance > 10)
      .map((s) => `${s.name} (${s.variance.toFixed(1)}% increase)`);

    return {
      average_cost_increase: averageCostIncrease,
      most_expensive_domains: mostExpensiveDomains,
      cost_optimization_opportunities: optimizationOpportunities,
    };
  }

  private static getEmptyAnnualAnalysis(year: number): AnnualRenewalCostAnalysis {
    return {
      year,
      total_estimated_cost: 0,
      total_actual_cost: 0,
      cost_accuracy: 0,
      domains_needing_renewal: 0,
      cost_by_registrar: {},
      cost_trends: {
        average_cost_increase: 0,
        most_expensive_domains: [],
        cost_optimization_opportunities: []
      }
    };
  }
}
