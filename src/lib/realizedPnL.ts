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
