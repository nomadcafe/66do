/**
 * 已实现盈亏（Realized P&L）共享计算。
 *
 * 对每笔 sell 交易计算：
 *   tradePnL = sellNetUSD(t) − holdingCostAsOf(domain, txs, t.date)
 * 然后按 expandSellToCashReceipts 的 netAmount 占比分摊到每个到账月，
 * 最终累加得到任一时点的累计 Realized P&L。
 *
 * 该函数不引入 estimated_value，不算未卖出的浮盈/浮亏：
 * 持有未卖的域名既不进分子也不进分母，体现"已落袋"的语义。
 *
 * 同一份算法在 Portfolio Performance 黄色折线（per-month）和
 * Hero Card 大数字（cumulative）共用，通过本模块的两个导出函数实现。
 */

import { expandSellToCashReceipts } from './coreCalculations';
import { holdingCostAsOf } from './renewalCostBasis';
import { sellNetUSD } from './sellProceeds';
import type { DomainWithTags, TransactionWithRequiredFields } from '../types/dashboard';
import { localMonthKey, parseLocalCalendarDate } from './localCalendarDate';

/** 成交月的 1 号零点。净额 <= 0 的成交没有到账序列，整笔盈亏归到这个月。 */
function saleMonthStartOf(date: string): Date | null {
  const d = parseLocalCalendarDate(date);
  if (!d) return null;
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/** 累计已实现盈亏（截至 asOf；缺省 = 当下） */
export function totalRealizedPnL(
  domains: DomainWithTags[],
  transactions: TransactionWithRequiredFields[],
  asOf: Date = new Date()
): number {
  const domainsById = new Map(domains.map((d) => [d.id, d]));
  const asOfMs = asOf.getTime();
  let total = 0;
  for (const t of transactions) {
    if (t.type !== 'sell') continue;
    const domain = domainsById.get(t.domain_id);
    if (!domain) continue;
    const sellNet = sellNetUSD(t);
    const costBasis = holdingCostAsOf(domain, transactions, parseLocalCalendarDate(t.date) ?? new Date(NaN));
    const tradePnL = sellNet - costBasis;

    // sellNet <= 0（白送、平台费吃光、净额填成负数）：share 的分母就是 sellNet，
    // 分摊机制在这里没有意义。这类成交没有到账序列可言，整笔亏损直接落在成交月。
    // 以前这里是 `continue` —— 亏得最狠的那类交易反而从 Realized P&L 里消失了，
    // 而它的成本仍然在 Total Investment 里，账对不上。
    if (sellNet <= 0) {
      const saleMonthStart = saleMonthStartOf(t.date);
      if (saleMonthStart && saleMonthStart.getTime() <= asOfMs) total += tradePnL;
      continue;
    }

    for (const r of expandSellToCashReceipts(t)) {
      const receiptDate = parseLocalCalendarDate(`${r.monthKey}-01`) ?? new Date(NaN);
      // 月级精度：到账月 > asOf 月份的 receipt 不计
      if (receiptDate.getTime() > asOfMs) continue;
      const share = r.netAmount / sellNet;
      total += tradePnL * share;
    }
  }
  return total;
}

/** 按月聚合的已实现盈亏增量（key=YYYY-MM, value=该月新增 realized P&L） */
export function realizedPnLByMonth(
  domains: DomainWithTags[],
  transactions: TransactionWithRequiredFields[]
): Map<string, number> {
  const map = new Map<string, number>();
  const domainsById = new Map(domains.map((d) => [d.id, d]));
  for (const t of transactions) {
    if (t.type !== 'sell') continue;
    const domain = domainsById.get(t.domain_id);
    if (!domain) continue;
    const sellNet = sellNetUSD(t);
    const costBasis = holdingCostAsOf(domain, transactions, parseLocalCalendarDate(t.date) ?? new Date(NaN));
    const tradePnL = sellNet - costBasis;

    // 与 totalRealizedPnL 同一条规则：净额 <= 0 没有可分摊的到账序列，
    // 整笔落在成交月，而不是被丢掉。
    if (sellNet <= 0) {
      const saleMonthStart = saleMonthStartOf(t.date);
      if (saleMonthStart) {
        const key = localMonthKey(saleMonthStart);
        map.set(key, (map.get(key) ?? 0) + tradePnL);
      }
      continue;
    }

    for (const r of expandSellToCashReceipts(t)) {
      const share = r.netAmount / sellNet;
      map.set(r.monthKey, (map.get(r.monthKey) ?? 0) + tradePnL * share);
    }
  }
  return map;
}

/**
 * 持有库存的 cost basis（"Portfolio at Cost"）。
 * 只统计 status ∈ {active, for_sale} 的域名，按截至 asOf 的 holdingCostAsOf 累加。
 * sold / expired 已经退出库存，归 Realized P&L 或沉没成本。
 */
export function portfolioAtCost(
  domains: DomainWithTags[],
  transactions: TransactionWithRequiredFields[],
  asOf: Date = new Date()
): number {
  let total = 0;
  for (const d of domains) {
    if (d.status !== 'active' && d.status !== 'for_sale') continue;
    total += holdingCostAsOf(d, transactions, asOf);
  }
  return total;
}

/** 单笔交易的盈亏明细（用于 best/worst sale 等聚合） */
export interface TradeOutcome {
  domainId: string;
  domainName: string | null | undefined;
  /** sellNet − holdingCostAsOf(domain, ..., t.date) */
  profit: number;
  /** 出售净额（已扣平台费 / 已折算分期已收部分） */
  sellNet: number;
  /** 出售日截止的 cost basis（purchase + 已发生续费） */
  costBasisAtSale: number;
  /** 单笔 ROI = profit / costBasisAtSale × 100。
   *  costBasisAtSale === 0（免费域名）时为 null——避免 div-by-0 / 误显 0%。
   *  调用方应处理 null：免费域名通常按 profit 排序而非 ROI。 */
  roi: number | null;
  /** 该 sell tx 的日期 */
  saleDate: string;
  /** 持有天数（purchase_date 缺失 / 异常时为 null） */
  holdingDays: number | null;
}

/**
 * 把所有 sell 交易展开成 TradeOutcome 列表。Insights KPI（best sale / win rate /
 * avg holding period）共用同一份事实底表，确保各个数字之间口径一致。
 *
 * 不分摊到月——每笔交易作为一条事实记录。这跟 realizedPnLByMonth 的关系是：
 *   realizedPnLByMonth = Σ_trade(profit × receipt 占比 / by month)
 *   tradeOutcomes      = 一行一笔交易，profit 不摊
 */
export function tradeOutcomes(
  domains: DomainWithTags[],
  transactions: TransactionWithRequiredFields[]
): TradeOutcome[] {
  const domainsById = new Map(domains.map((d) => [d.id, d]));
  const outcomes: TradeOutcome[] = [];
  for (const t of transactions) {
    if (t.type !== 'sell') continue;
    const domain = domainsById.get(t.domain_id);
    if (!domain) continue;
    // 净额 <= 0 的成交不再跳过。它们是真实完成的交易（白送、平台费吃光、
    // 记了退款），profit = sellNet − costBasis 是一笔实打实的亏损；而
    // calculateBasicFinancialMetrics 的 totalRevenue 从来不过滤它们。以前
    // 这里一 continue，同一屏上 Total Revenue 认这笔、Top Performers 和
    // Realized ROI 不认，亏得最狠的那笔还永远当不上 worst sale。
    const sellNet = sellNetUSD(t);
    const saleDateObj = parseLocalCalendarDate(t.date) ?? new Date(NaN);
    const costBasis = holdingCostAsOf(domain, transactions, saleDateObj);
    const profit = sellNet - costBasis;
    let holdingDays: number | null = null;
    if (domain.purchase_date) {
      const p = (parseLocalCalendarDate(domain.purchase_date) ?? new Date(NaN)).getTime();
      const s = saleDateObj.getTime();
      if (Number.isFinite(p) && Number.isFinite(s) && s > p) {
        holdingDays = Math.round((s - p) / (1000 * 60 * 60 * 24));
      }
    }
    outcomes.push({
      domainId: domain.id,
      domainName: domain.domain_name,
      profit,
      sellNet,
      costBasisAtSale: costBasis,
      roi: costBasis > 0 ? (profit / costBasis) * 100 : null,
      saleDate: t.date,
      holdingDays,
    });
  }
  return outcomes;
}

/**
 * 已实现 ROI（百分比）：
 *   = Σ(sold profit) / Σ(sold cost basis at sale) × 100
 *
 * 跟 totalRealizedPnL 配套，分母是"已变现交易的 cost basis 总和"，不含
 * 持有未卖的域名。这样 Hero 上的"Realized P&L + Realized ROI"语义对齐：
 * 都只看完成的交易。
 *
 * 老的 basic.roi（= totalRevenue/totalInvestment − 1）把持有未卖的 cost
 * 也算分母，跟 Realized P&L 不在一条逻辑上，会出现 P&L 正但 ROI 负的怪现
 * 象（cost basis of held >> cumulative profit on sold）。
 *
 * 没有任何已售域名时返回 0。
 */
export function realizedROI(
  domains: DomainWithTags[],
  transactions: TransactionWithRequiredFields[]
): number {
  return realizedROIFromTrades(tradeOutcomes(domains, transactions));
}

/**
 * 同上，但直接吃已经算好的 tradeOutcomes。
 *
 * 调用方往往两个都要（FinancialAnalysis 的 Top Performers + ROI tile 就是），
 * 而这两个函数原本是同一个循环写了两遍——filter sell → 查 domain → 算
 * holdingCostAsOf。走这个入口，每笔出售的 cost basis 只算一次，两个数字也
 * 不可能再各自漂移。
 */
export function realizedROIFromTrades(trades: TradeOutcome[]): number {
  let pnl = 0;
  let costSold = 0;
  for (const tr of trades) {
    pnl += tr.profit;
    costSold += tr.costBasisAtSale;
  }
  return costSold > 0 ? (pnl / costSold) * 100 : 0;
}

/** Insights KPI 横条用的聚合：best sale / success rate / avg holding period */
export interface InsightsKPISummary {
  /** 单笔最大盈利（≥ 0；没有出售时为 null） */
  bestSale: { amount: number; domainName: string | null | undefined } | null;
  /**
   * 成功率：盈利卖出笔数 / 历史持有过的域名总数（active + for_sale + sold +
   * expired）。比"盈利卖出 / 全部卖出"的标准 win rate 更适合域名投资场景：
   * 域名典型 pattern 是买 100 个 → 卖 5 个 → 95 个过期，纯 win rate 会显示
   * 100% 但实际只有 5% 库存赚到钱。这个指标同时反映「能不能卖出去」+
   * 「卖出去能不能赚钱」，单一数字暴露真实命中率。
   * total = domains.length（含 expired——它们是沉没成本，必须计入分母）
   */
  successRate: { percent: number; wins: number; total: number } | null;
  /** 已售域名的平均持有天数 */
  avgHoldingDays: number | null;
}

export function insightsKPISummary(
  domains: DomainWithTags[],
  transactions: TransactionWithRequiredFields[]
): InsightsKPISummary {
  const outcomes = tradeOutcomes(domains, transactions);
  let best: TradeOutcome | null = null;
  let wins = 0;
  let holdingSum = 0;
  let holdingCount = 0;
  for (const o of outcomes) {
    if (o.profit > 0) wins++;
    if (best === null || o.profit > best.profit) best = o;
    if (o.holdingDays !== null) {
      holdingSum += o.holdingDays;
      holdingCount++;
    }
  }
  // successRate 跟着 domains.length 走（不依赖 outcomes 是否空）：刚买入还没
  // 卖的早期投资者也能看到 0/N 这个真实信号——库存全是负担、还没回血。
  const totalOwned = domains.length;
  return {
    // bestSale 至少展示出来；如果所有交易都亏损（best.profit ≤ 0），就视作"没有正收益"
    bestSale: best && best.profit > 0
      ? { amount: best.profit, domainName: best.domainName }
      : null,
    successRate: totalOwned > 0
      ? { percent: (wins / totalOwned) * 100, wins, total: totalOwned }
      : null,
    avgHoldingDays: holdingCount > 0 ? Math.round(holdingSum / holdingCount) : null,
  };
}
