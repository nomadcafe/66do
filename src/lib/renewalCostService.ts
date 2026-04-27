// 续费成本分析（高级面板使用）
// 数据源：transactions (type='renew')。单一数据源，与 dashboard 底部
// Yearly Renewal vs Profit 表保持一致，避免上下两半数字打架。

import type { TransactionWithRequiredFields } from '../types/transaction';

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
    /** 结构化数据，由 UI 层自行 i18n 拼装文案 */
    cost_optimization_opportunities: Array<{ name: string; variance: number }>;
  };
}

/** 按自然年的续费预估与实际（用于多年对比） */
export interface RenewalYearSummary {
  year: number;
  total_estimated_cost: number;
  total_actual_cost: number;
  domains_needing_renewal: number;
}

/** 单条续费记录的最小投影，从 transaction 派生 */
interface RenewalRecord {
  renewal_date: string;
  renewal_cost: number;
}

type DomainLike = {
  id: string;
  status: string;
  renewal_cost?: number | null;
  renewal_cycle?: number;
  domain_name?: string;
  expiry_date?: string | null;
  registrar?: string | null;
};

/** 把 transactions 中的 renew 类型按 domain 分组，并按日期降序排序 */
function groupRenewalsByDomain(
  transactions: TransactionWithRequiredFields[]
): Map<string, RenewalRecord[]> {
  const map = new Map<string, RenewalRecord[]>();
  for (const t of transactions) {
    if (t.type !== 'renew') continue;
    if (!t.domain_id || !t.date) continue;
    const list = map.get(t.domain_id) || [];
    list.push({
      renewal_date: String(t.date).slice(0, 10),
      renewal_cost: Number(t.amount) || 0,
    });
    map.set(t.domain_id, list);
  }
  for (const list of map.values()) {
    list.sort((a, b) => b.renewal_date.localeCompare(a.renewal_date));
  }
  return map;
}

/** 按年份汇总实际续费金额（来自 transactions） */
function sumActualByYear(transactions: TransactionWithRequiredFields[]): Map<number, number> {
  const map = new Map<number, number>();
  for (const t of transactions) {
    if (t.type !== 'renew') continue;
    if (!t.date) continue;
    const y = new Date(String(t.date)).getFullYear();
    if (!Number.isFinite(y)) continue;
    map.set(y, (map.get(y) || 0) + (Number(t.amount) || 0));
  }
  return map;
}

/** 预测下次续费成本（基于历史的线性回归） */
function predictNextRenewalCost(history: RenewalRecord[]): number {
  if (history.length === 0) return 0;
  if (history.length === 1) return history[0].renewal_cost;

  const points = history.map((record, index) => ({ x: index, y: record.renewal_cost }));
  const n = points.length;
  const sumX = points.reduce((sum, p) => sum + p.x, 0);
  const sumY = points.reduce((sum, p) => sum + p.y, 0);
  const sumXY = points.reduce((sum, p) => sum + p.x * p.y, 0);
  const sumXX = points.reduce((sum, p) => sum + p.x * p.x, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  const nextX = n;
  const predicted = slope * nextX + intercept;

  return Math.max(0, predicted);
}

/** 基于历史价格序列判断趋势（前后两半均值对比） */
function calculateCostTrend(costs: number[]): 'increasing' | 'decreasing' | 'stable' {
  if (costs.length < 2) return 'stable';

  const firstHalf = costs.slice(0, Math.floor(costs.length / 2));
  const secondHalf = costs.slice(Math.floor(costs.length / 2));

  const firstAvg = firstHalf.reduce((sum, c) => sum + c, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((sum, c) => sum + c, 0) / secondHalf.length;

  const changePercent = ((secondAvg - firstAvg) / firstAvg) * 100;

  if (changePercent > 5) return 'increasing';
  if (changePercent < -5) return 'decreasing';
  return 'stable';
}

/** 某年到期域名的预估续费总额、数量、按注册商分布（基于已分组的历史） */
function buildAnnualEstimatedBreakdown(
  year: number,
  activeDomains: DomainLike[],
  historyByDomain: Map<string, RenewalRecord[]>
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
      history.length > 0 ? predictNextRenewalCost(history) : (domain.renewal_cost ?? 0);
    total_estimated_cost += predictedCost;
    const registrar = (domain.registrar as string) || 'Unknown';
    cost_by_registrar[registrar] = (cost_by_registrar[registrar] || 0) + predictedCost;
  }

  return { total_estimated_cost, domains_needing_renewal, cost_by_registrar };
}

/**
 * 趋势分析：纯内存计算。每个 domain 用其历史的最近一笔作为 currentCost，
 * 和历史均值对比得出 variance；前后两半均值对比得出 trend。
 */
function calculateCostTrends(
  activeDomains: DomainLike[],
  historyByDomain: Map<string, RenewalRecord[]>
): {
  average_cost_increase: number;
  most_expensive_domains: string[];
  cost_optimization_opportunities: Array<{ name: string; variance: number }>;
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
    // groupRenewalsByDomain 已按日期降序排，costs[0] 即最近一次
    const costs = history.map((h) => h.renewal_cost);
    const avg = costs.reduce((sum, c) => sum + c, 0) / costs.length;
    const latest = costs[0];
    return {
      name: d.domain_name || '',
      currentCost: latest,
      trend: calculateCostTrend(costs),
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
    .map((s) => ({ name: s.name, variance: s.variance }));

  return {
    average_cost_increase: averageCostIncrease,
    most_expensive_domains: mostExpensiveDomains,
    cost_optimization_opportunities: optimizationOpportunities,
  };
}

function getEmptyAnnualAnalysis(year: number): AnnualRenewalCostAnalysis {
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
      cost_optimization_opportunities: [],
    },
  };
}

/**
 * 高级续费面板的纯派生数据。所有输入已在内存（domains + transactions），
 * 不再触发数据库往返；切换 selectedYear 是瞬秒的纯计算。
 */
export function computeAdvancedRenewalPanelData(
  domains: DomainLike[],
  transactions: TransactionWithRequiredFields[],
  selectedYear: number,
  options?: { pastYears?: number; futureYears?: number }
): { analysis: AnnualRenewalCostAnalysis; yearSummaries: RenewalYearSummary[] } {
  const pastYears = options?.pastYears ?? 2;
  const futureYears = options?.futureYears ?? 3;
  // 只剔除明确退出生命周期的（已售/已弃）；for_sale 仍在持有，仍需续费。
  const activeDomains = domains.filter((d) => d.status !== 'sold' && d.status !== 'expired');

  if (activeDomains.length === 0) {
    return { analysis: getEmptyAnnualAnalysis(selectedYear), yearSummaries: [] };
  }

  const activeIds = new Set(activeDomains.map((d) => d.id));
  const relevantRenewals = transactions.filter(
    (t) => t.type === 'renew' && activeIds.has(t.domain_id)
  );
  const historyByDomain = groupRenewalsByDomain(relevantRenewals);
  const actualByYear = sumActualByYear(relevantRenewals);

  const breakdown = buildAnnualEstimatedBreakdown(selectedYear, activeDomains, historyByDomain);
  const actualCost = actualByYear.get(selectedYear) || 0;
  const costTrends = calculateCostTrends(activeDomains, historyByDomain);

  const rawAccuracy =
    actualCost > 0
      ? (1 - Math.abs(breakdown.total_estimated_cost - actualCost) / actualCost) * 100
      : 0;

  const analysis: AnnualRenewalCostAnalysis = {
    year: selectedYear,
    total_estimated_cost: breakdown.total_estimated_cost,
    total_actual_cost: actualCost,
    // 源头就夹到 [0, 100]：预估远大于实际时原公式会输出 -300% 之类的负值。
    cost_accuracy: actualCost > 0 ? Math.max(0, Math.min(100, rawAccuracy)) : 0,
    domains_needing_renewal: breakdown.domains_needing_renewal,
    cost_by_registrar: breakdown.cost_by_registrar,
    cost_trends: costTrends,
  };

  const sumStart = selectedYear - pastYears;
  const sumEnd = selectedYear + futureYears;
  const yearSummaries: RenewalYearSummary[] = [];
  for (let y = sumStart; y <= sumEnd; y++) {
    const b = buildAnnualEstimatedBreakdown(y, activeDomains, historyByDomain);
    yearSummaries.push({
      year: y,
      total_estimated_cost: b.total_estimated_cost,
      total_actual_cost: actualByYear.get(y) || 0,
      domains_needing_renewal: b.domains_needing_renewal,
    });
  }

  return { analysis, yearSummaries };
}
