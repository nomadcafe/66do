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
    if (sellNet <= 0) continue;
    const costBasis = holdingCostAsOf(domain, transactions, new Date(t.date));
    const tradePnL = sellNet - costBasis;
    for (const r of expandSellToCashReceipts(t)) {
      const receiptDate = new Date(`${r.monthKey}-01T00:00:00`);
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
    if (sellNet <= 0) continue;
    const costBasis = holdingCostAsOf(domain, transactions, new Date(t.date));
    const tradePnL = sellNet - costBasis;
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
    const sellNet = sellNetUSD(t);
    if (sellNet <= 0) continue;
    const saleDateObj = new Date(t.date);
    const costBasis = holdingCostAsOf(domain, transactions, saleDateObj);
    const profit = sellNet - costBasis;
    let holdingDays: number | null = null;
    if (domain.purchase_date) {
      const p = new Date(domain.purchase_date).getTime();
      const s = saleDateObj.getTime();
      if (Number.isFinite(p) && Number.isFinite(s) && s > p) {
        holdingDays = Math.round((s - p) / (1000 * 60 * 60 * 24));
      }
    }
    outcomes.push({
      domainId: domain.id,
      domainName: domain.domain_name,
      profit,
      saleDate: t.date,
      holdingDays,
    });
  }
  return outcomes;
}

/** Insights KPI 横条用的聚合：best sale / win rate / avg holding period */
export interface InsightsKPISummary {
  /** 单笔最大盈利（≥ 0；没有出售时为 null） */
  bestSale: { amount: number; domainName: string | null | undefined } | null;
  /** 出售域名中盈利的占比 */
  winRate: { percent: number; wins: number; total: number } | null;
  /** 已售域名的平均持有天数 */
  avgHoldingDays: number | null;
}

export function insightsKPISummary(
  domains: DomainWithTags[],
  transactions: TransactionWithRequiredFields[]
): InsightsKPISummary {
  const outcomes = tradeOutcomes(domains, transactions);
  if (outcomes.length === 0) {
    return { bestSale: null, winRate: null, avgHoldingDays: null };
  }
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
  return {
    // bestSale 至少展示出来；如果所有交易都亏损（best.profit ≤ 0），就视作"没有正收益"
    bestSale: best && best.profit > 0
      ? { amount: best.profit, domainName: best.domainName }
      : null,
    winRate: { percent: (wins / outcomes.length) * 100, wins, total: outcomes.length },
    avgHoldingDays: holdingCount > 0 ? Math.round(holdingSum / holdingCount) : null,
  };
}
