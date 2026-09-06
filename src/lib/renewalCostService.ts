// 续费成本分析（高级面板使用）
// 历史/实际续费走 expandRenewalEvents（archive + transaction 两类事件源），
// 与 Portfolio Performance 紫色 Renewal cost 折线、Dashboard YTD tile 共享同一
// 事件流口径。否则只有逐笔 renew tx 的域名能进 actual，archive 续费会消失。

import type { TransactionWithRequiredFields } from '../types/transaction';
import { expandRenewalEvents } from './expandRenewalEvents';
import { UNKNOWN_REGISTRAR } from './upcomingRenewals';

/** 「续费最贵」榜单的一项。金额统一归一到每年，见 perYearCost 的注释。 */
export interface ExpensiveDomain {
  name: string;
  cost_per_year: number;
}

export interface AnnualRenewalCostAnalysis {
  year: number;
  total_estimated_cost: number;
  total_actual_cost: number;
  /**
   * 该年预估里「已经发生」的比例，[0, 1]。
   *   - 历史年：estimated ≡ actual（都只由 archive + tx 组成）→ 恒为 1
   *   - 当年：已发生的续费 / 全年预估 —— 「今年续费预算走掉了多少」
   *   - 未来年：actual = 0 → 0
   * 预估为 0 时返回 0。
   */
  spent_ratio: number;
  /** 该年预估中尚未发生的部分 = max(0, estimated − actual) */
  remaining_estimated_cost: number;
  domains_needing_renewal: number;
  cost_by_registrar: { [registrar: string]: number };
  cost_trends: {
    /**
     * 有价格样本的域名的平均成本变动百分比，**可以为负**。
     * 旧口径只对「上涨」的域名求均值，所以它要么是 0、要么必然是正数，
     * 根本不是平均值。样本量见 trend_sample_size。
     */
    average_cost_change: number;
    /** 参与上面这个均值的域名数（有 ≥2 笔已知金额的续费）。0 时 UI 应显示「—」。 */
    trend_sample_size: number;
    most_expensive_domains: ExpensiveDomain[];
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

/**
 * 预估口径的覆盖情况。
 *
 * expandRenewalEvents 只有在「有精确到期日作为锚点」（expiry_date，其次
 * next_renewal_date）且「renewal_cost > 0」时才产 projected 事件，年度汇总又会
 * 跳过当年成本为 0 的域名。也就是说，资料没填全的域名既不进金额、也不进「待续费
 * 域名数」——用户看到的是一个偏低但毫无提示的预估。把这批域名数出来交给 UI 说明。
 */
export interface RenewalForecastCoverage {
  /** 活跃域名总数（active + for_sale） */
  total_active: number;
  /** 至少缺一项、因而完全无法预估未来续费的域名数 */
  excluded: number;
  /** 其中：续费价缺失或 <= 0 */
  missing_cost: number;
  /** 其中：没有到期日，projected 没有锚点 */
  missing_expiry: number;
}

/** 单条续费记录的最小投影，金额已归一到「每年」 */
interface RenewalRecord {
  renewal_date: string;
  /** 该笔续费的每年成本 = amount / renewal_period_years */
  cost_per_year: number;
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
  next_renewal_date?: string | null;
  registrar?: string | null;
  baseline_renewal_as_of?: string | null;
};

/** 续费周期，与 expandRenewalEvents 的取法保持一致（下限 1 年） */
function domainCycle(d: Pick<DomainLike, 'renewal_cycle'>): number {
  return Math.max(1, Math.floor(d.renewal_cycle ?? 1) || 1);
}

/**
 * 把 transactions 中的 renew 类型按 domain 分组，按日期降序排序。
 *
 * 金额一律除以该笔续费覆盖的年数：一笔 3 年 $36 和一笔 1 年 $12 是同一个价，
 * 直接比原始 amount 会读成「涨了 200%」。renewal_period_years 缺失时退回域名的
 * renewal_cycle，与 expandRenewalEvents 的兜底一致。
 */
function groupRenewalsByDomain(
  domains: DomainLike[],
  transactions: TransactionWithRequiredFields[]
): Map<string, RenewalRecord[]> {
  const cycleById = new Map(domains.map((d) => [d.id, domainCycle(d)]));
  const map = new Map<string, RenewalRecord[]>();

  for (const t of transactions) {
    if (t.type !== 'renew') continue;
    if (!t.domain_id || !t.date) continue;
    const cycle = cycleById.get(t.domain_id);
    if (cycle === undefined) continue; // 非活跃域名的续费，不参与趋势
    const years = Math.max(1, Math.floor(t.renewal_period_years ?? cycle) || cycle);
    const list = map.get(t.domain_id) || [];
    list.push({
      renewal_date: String(t.date).slice(0, 10),
      cost_per_year: (Number(t.amount) || 0) / years,
    });
    map.set(t.domain_id, list);
  }

  for (const list of map.values()) {
    list.sort((a, b) => b.renewal_date.localeCompare(a.renewal_date));
  }
  return map;
}

/**
 * 数出「预估算不到」的活跃域名。
 *
 * 判据与 expandRenewalEvents 的 projected 分支一一对应：expiry_date 和
 * next_renewal_date 都没有就没有起步锚点，renewal_cost <= 0 就没有金额，两者缺一
 * 都不会产生任何 projected 事件。这里必须跟着那个分支走——判据一旦和事件源脱节，
 * 报出来的「未计入」数量就是错的。
 * 这类域名在未来年份恒定贡献 0，既不进 total_estimated_cost 也不进
 * domains_needing_renewal —— 所以必须单独报出来，否则用户无从知道预估是缺斤少两的。
 *
 * 两个 missing_* 各自独立计数（同时缺两项的域名会在两边都 +1），excluded 是去重后
 * 的并集大小，UI 用 excluded 报总数、用 missing_* 说明原因。
 */
function computeForecastCoverage(activeDomains: DomainLike[]): RenewalForecastCoverage {
  let missing_cost = 0;
  let missing_expiry = 0;
  let excluded = 0;

  for (const d of activeDomains) {
    const noCost = !(Number(d.renewal_cost) > 0);
    const noExpiry = !d.expiry_date && !d.next_renewal_date;
    if (noCost) missing_cost++;
    if (noExpiry) missing_expiry++;
    if (noCost || noExpiry) excluded++;
  }

  return {
    total_active: activeDomains.length,
    excluded,
    missing_cost,
    missing_expiry,
  };
}

interface YearBucket {
  total_estimated_cost: number;
  total_actual_cost: number;
  domains: Set<string>;
  cost_by_registrar: { [registrar: string]: number };
}

function emptyBucket(): YearBucket {
  return {
    total_estimated_cost: 0,
    total_actual_cost: 0,
    domains: new Set<string>(),
    cost_by_registrar: {},
  };
}

/**
 * 一次遍历把所有年份的桶都填满。
 *
 * 之前是「每个年份各调一次 buildAnnualEstimatedBreakdown + 一次 sumActualByYear」，
 * 也就是每个域名每次渲染要跑 7 遍 expandRenewalEvents，archive 反向回溯和 transfer
 * 年数累加全部重算。关键观察：forecastUntil 只会**追加**更远的 projected 事件，
 * 不会改变已有事件——所以按最大年份的年末做一次 forecastUntil，再按年份分桶，
 * 结果与逐年调用逐位相同（同一域名内事件顺序不变、跨域名累加顺序不变，浮点加法
 * 的结合律问题不会被引入），成本降到 1/7。
 *
 * actual 桶只收非 projected 事件，与紫色 Renewal cost 折线、YTD tile 同源；这类
 * 事件不受 forecastUntil 影响，所以窗口外的历史年也照样统计得到。
 */
function buildYearBuckets(
  activeDomains: DomainLike[],
  transactions: TransactionWithRequiredFields[],
  horizonYear: number
): Map<number, YearBucket> {
  const buckets = new Map<number, YearBucket>();
  const bucketFor = (year: number): YearBucket => {
    let b = buckets.get(year);
    if (!b) {
      b = emptyBucket();
      buckets.set(year, b);
    }
    return b;
  };

  const forecastUntil = new Date(horizonYear, 11, 31, 23, 59, 59, 999);
  const estimatedByYear = new Map<number, number>();

  for (const domain of activeDomains) {
    estimatedByYear.clear();

    for (const ev of expandRenewalEvents(domain, transactions, { forecastUntil })) {
      const y = ev.date.getFullYear();
      if (!Number.isFinite(y)) continue;
      estimatedByYear.set(y, (estimatedByYear.get(y) || 0) + ev.amount);
      if (ev.source !== 'projected') {
        const b = bucketFor(y);
        b.total_actual_cost += ev.amount;
      }
    }

    const registrar = domain.registrar || UNKNOWN_REGISTRAR;
    for (const [year, cost] of estimatedByYear) {
      // 成本为 0 的年份不计入「待续费域名数」：那是资料没填全的域名，
      // 由 coverage 单独报，混进这里只会让数字看着有、金额却是 0。
      if (cost === 0) continue;
      const b = bucketFor(year);
      b.total_estimated_cost += cost;
      b.domains.add(domain.id);
      b.cost_by_registrar[registrar] = (b.cost_by_registrar[registrar] || 0) + cost;
    }
  }

  return buckets;
}

/**
 * 趋势分析：纯内存计算，全部基于「每年成本」口径。
 *
 * variance = 最近一笔相对**此前各笔均值**的变动百分比。旧实现用两把尺子——
 * trend 看前后两半均值、variance 看最近一笔 vs 含自己的全期均值——然后拿 trend
 * 去筛 variance，两者可以互相矛盾。现在只留一个定义：variance > 0 即上涨。
 */
function calculateCostTrends(
  activeDomains: DomainLike[],
  historyByDomain: Map<string, RenewalRecord[]>
): AnnualRenewalCostAnalysis['cost_trends'] {
  type DomainStat = {
    name: string;
    costPerYear: number;
    /** 有 ≥2 笔已知金额才谈得上变动；否则为 null，不进均值 */
    variance: number | null;
  };

  const stats: DomainStat[] = activeDomains.map((d) => {
    const name = d.domain_name || '';
    const history = historyByDomain.get(d.id) || [];

    if (history.length === 0) {
      // 没有逐笔记录：用域名上的续费价，同样归一到每年
      return {
        name,
        costPerYear: (Number(d.renewal_cost) || 0) / domainCycle(d),
        variance: null,
      };
    }

    // groupRenewalsByDomain 已按日期降序排，[0] 即最近一次
    const latest = history[0].cost_per_year;
    const earlier = history.slice(1).map((h) => h.cost_per_year);
    if (earlier.length === 0) {
      return { name, costPerYear: latest, variance: null };
    }

    const earlierAvg = earlier.reduce((sum, c) => sum + c, 0) / earlier.length;
    return {
      name,
      costPerYear: latest,
      variance: earlierAvg > 0 ? ((latest - earlierAvg) / earlierAvg) * 100 : null,
    };
  });

  const withVariance = stats.filter((s) => s.variance !== null);
  const averageCostChange =
    withVariance.length > 0
      ? withVariance.reduce((sum, s) => sum + (s.variance as number), 0) / withVariance.length
      : 0;

  // 空名字和 0 成本不上榜：前者会渲染成空行，后者是没填价的域名，
  // 说它「最贵」纯属误导。
  const mostExpensiveDomains: ExpensiveDomain[] = stats
    .filter((s) => s.name !== '' && s.costPerYear > 0)
    .sort((a, b) => b.costPerYear - a.costPerYear)
    .slice(0, 5)
    .map((s) => ({ name: s.name, cost_per_year: s.costPerYear }));

  const optimizationOpportunities = stats
    .filter((s) => s.name !== '' && s.variance !== null && (s.variance as number) > 10)
    .map((s) => ({ name: s.name, variance: s.variance as number }));

  return {
    average_cost_change: averageCostChange,
    trend_sample_size: withVariance.length,
    most_expensive_domains: mostExpensiveDomains,
    cost_optimization_opportunities: optimizationOpportunities,
  };
}

function getEmptyAnnualAnalysis(year: number): AnnualRenewalCostAnalysis {
  return {
    year,
    total_estimated_cost: 0,
    total_actual_cost: 0,
    spent_ratio: 0,
    remaining_estimated_cost: 0,
    domains_needing_renewal: 0,
    cost_by_registrar: {},
    cost_trends: {
      average_cost_change: 0,
      trend_sample_size: 0,
      most_expensive_domains: [],
      cost_optimization_opportunities: [],
    },
  };
}

/**
 * 高级续费面板的纯派生数据。所有输入已在内存（domains + transactions），
 * 不再触发数据库往返；切换 selectedYear 是瞬秒的纯计算。
 *
 * anchorYear（默认今年）决定 yearSummaries 的窗口，**不是** selectedYear：以选中
 * 年份为锚会让年份列表随每次选择整体平移，选到 +3 年后今年就从下拉里消失了，
 * 而 header 那句「过去 N 年 + 未来 M 年」也只在选中今年时才成立。锚死在今年后，
 * 下拉是一个固定窗口，selectedYear 只是窗口内的高亮项。
 */
export function computeAdvancedRenewalPanelData(
  domains: DomainLike[],
  transactions: TransactionWithRequiredFields[],
  selectedYear: number,
  options?: { pastYears?: number; futureYears?: number; anchorYear?: number }
): {
  analysis: AnnualRenewalCostAnalysis;
  yearSummaries: RenewalYearSummary[];
  coverage: RenewalForecastCoverage;
} {
  const pastYears = options?.pastYears ?? 2;
  const futureYears = options?.futureYears ?? 3;
  const anchorYear = options?.anchorYear ?? new Date().getFullYear();
  // 只剔除明确退出生命周期的（已售/已弃）；for_sale 仍在持有，仍需续费。
  const activeDomains = domains.filter((d) => d.status !== 'sold' && d.status !== 'expired');

  const coverage = computeForecastCoverage(activeDomains);

  if (activeDomains.length === 0) {
    return { analysis: getEmptyAnnualAnalysis(selectedYear), yearSummaries: [], coverage };
  }

  // 固定窗口 = [今年-past, 今年+future]。selectedYear 理论上永远来自这个窗口
  // （下拉就是用它渲染的），但跨年时组件里的 currentYear 会前移一格，所以兜底
  // 把它并进来，避免 <select> 的 value 找不到对应 <option> 而显示空白。
  const years: number[] = [];
  for (let y = anchorYear - pastYears; y <= anchorYear + futureYears; y++) years.push(y);
  if (!years.includes(selectedYear)) {
    years.push(selectedYear);
    years.sort((a, b) => a - b);
  }

  const buckets = buildYearBuckets(activeDomains, transactions, years[years.length - 1]);

  // historyByDomain 只喂给 calculateCostTrends（涨跌趋势、最贵 domain、优化机会）。
  // archive 续费没有逐笔单价，所以这块仍只看真实 renew tx 序列。
  const historyByDomain = groupRenewalsByDomain(activeDomains, transactions);
  const costTrends = calculateCostTrends(activeDomains, historyByDomain);

  const selected = buckets.get(selectedYear) ?? emptyBucket();
  const estimated = selected.total_estimated_cost;
  const actual = selected.total_actual_cost;

  const analysis: AnnualRenewalCostAnalysis = {
    year: selectedYear,
    total_estimated_cost: estimated,
    total_actual_cost: actual,
    // estimated 与 actual 同源（archive+tx 部分完全相同），差额只来自 projected：
    // 历史年 projected = 0 → 比值为 1；当年 = 已走掉的比例；未来年 actual = 0 → 0。
    // 夹到 [0, 1]：renewal_count 手填偏小等情况下 actual 可能反超 estimated。
    spent_ratio: estimated > 0 ? Math.max(0, Math.min(1, actual / estimated)) : 0,
    remaining_estimated_cost: Math.max(0, estimated - actual),
    domains_needing_renewal: selected.domains.size,
    cost_by_registrar: selected.cost_by_registrar,
    cost_trends: costTrends,
  };

  const yearSummaries: RenewalYearSummary[] = years.map((y) => {
    const b = buckets.get(y);
    return {
      year: y,
      total_estimated_cost: b?.total_estimated_cost ?? 0,
      total_actual_cost: b?.total_actual_cost ?? 0,
      domains_needing_renewal: b?.domains.size ?? 0,
    };
  });

  return { analysis, yearSummaries, coverage };
}
