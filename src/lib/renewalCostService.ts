// 续费成本分析（高级面板使用）
// 历史/实际续费走 expandRenewalEvents（archive + transaction 两类事件源），
// 与 Portfolio Performance 紫色 Renewal cost 折线、Dashboard YTD tile 共享同一
// 事件流口径。否则只有逐笔 renew tx 的域名能进 actual，archive 续费会消失。

import type { TransactionWithRequiredFields } from '../types/transaction';
import { expandRenewalEvents } from './expandRenewalEvents';

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
  renewal_count?: number | null;
  domain_name?: string;
  purchase_date?: string | null;
  expiry_date?: string | null;
  registrar?: string | null;
  baseline_renewal_as_of?: string | null;
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

/**
 * 按年份汇总「已发生」的续费支出（archive + 显式 renew tx）。
 * - 走 expandRenewalEvents 与紫色 Renewal cost 折线、YTD tile 同源
 * - 不含 projected：这里只想看真实历史，不想把估的未来续费当 actual
 * - 仅遍历活跃域名（与上层 activeDomains 同口径），sold/expired 已经在调用处剔除
 */
function sumActualByYear(
  domains: DomainLike[],
  transactions: TransactionWithRequiredFields[]
): Map<number, number> {
  const map = new Map<number, number>();
  for (const d of domains) {
    for (const ev of expandRenewalEvents(d, transactions)) {
      if (ev.source === 'projected') continue;
      const y = ev.date.getFullYear();
      if (!Number.isFinite(y)) continue;
      map.set(y, (map.get(y) || 0) + ev.amount);
    }
  }
  return map;
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

/**
 * 某年的预估续费总额、涉及域名数、按注册商分布。
 *
 * 走 expandRenewalEvents（forecastUntil = 该年最后一刻），把档案 archive、显式
 * renew tx、未来 projected 三类事件都纳入：
 *   - 历史年：events 全是 archive + tx，与 actual 列同源 → 历史年 estimated == actual
 *   - 当前年：已发生部分（archive + tx）+ 年内剩余的 projected 续费
 *   - 未来年：纯 projected
 *
 * 这样 cycle=1 年的域名，未来 3 年每一年都会贡献一笔 projected，Outlook 列表
 * 不会再出现"今年到期域名贡献 $X，明年/后年凭空降到 $0"的假象。
 *
 * domains_needing_renewal 用 Set 去重：一个域名在该年有任何事件就计 1，
 * 不会因为多条事件（理论上不会发生，但 cycle=0.5 之类边界情况兜个底）重复。
 */
function buildAnnualEstimatedBreakdown(
  year: number,
  activeDomains: DomainLike[],
  transactions: TransactionWithRequiredFields[]
): {
  total_estimated_cost: number;
  domains_needing_renewal: number;
  cost_by_registrar: { [registrar: string]: number };
} {
  let total_estimated_cost = 0;
  const domainsThisYear = new Set<string>();
  const cost_by_registrar: { [registrar: string]: number } = {};
  const yearEnd = new Date(year, 11, 31, 23, 59, 59, 999);

  for (const domain of activeDomains) {
    let costThisYear = 0;
    for (const ev of expandRenewalEvents(domain, transactions, { forecastUntil: yearEnd })) {
      if (ev.date.getFullYear() !== year) continue;
      costThisYear += ev.amount;
    }
    if (costThisYear === 0) continue;
    total_estimated_cost += costThisYear;
    domainsThisYear.add(domain.id);
    const registrar = (domain.registrar as string) || 'Unknown';
    cost_by_registrar[registrar] = (cost_by_registrar[registrar] || 0) + costThisYear;
  }

  return {
    total_estimated_cost,
    domains_needing_renewal: domainsThisYear.size,
    cost_by_registrar,
  };
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
  // historyByDomain 只喂给 calculateCostTrends（涨价趋势、最贵 domain、优化机会）。
  // archive 续费没有逐笔单价，所以这块仍只看真实 renew tx 序列。
  const historyByDomain = groupRenewalsByDomain(relevantRenewals);
  // actualByYear / 估值都走 expandRenewalEvents：archive + tx + projected 三类。
  const actualByYear = sumActualByYear(activeDomains, transactions);

  const breakdown = buildAnnualEstimatedBreakdown(selectedYear, activeDomains, transactions);
  const actualCost = actualByYear.get(selectedYear) || 0;
  const costTrends = calculateCostTrends(activeDomains, historyByDomain);

  // 现在 estimated 与 actual 同源（archive+tx 部分完全相同），差额只来自 projected。
  // 历史年：projected = 0 → estimated == actual → accuracy = 100%
  // 当前年中：actual / estimated = 已发生比例（"今年续费已经走完多少"）
  // 未来年：actual = 0 → 不显示 accuracy（落到下方 actualCost > 0 分支）
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
    const b = buildAnnualEstimatedBreakdown(y, activeDomains, transactions);
    yearSummaries.push({
      year: y,
      total_estimated_cost: b.total_estimated_cost,
      total_actual_cost: actualByYear.get(y) || 0,
      domains_needing_renewal: b.domains_needing_renewal,
    });
  }

  return { analysis, yearSummaries };
}
