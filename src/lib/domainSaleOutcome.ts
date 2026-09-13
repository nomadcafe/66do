import type { DomainWithTags, TransactionWithRequiredFields } from '../types/dashboard';
import { tradeOutcomes, type TradeOutcome } from './realizedPnL';

/**
 * 某个域名最近一次成交的结果（净额 / 利润 / ROI）。
 *
 * 口径与 Insights 的 Top Performers、Realized ROI 完全同源——都走 tradeOutcomes：
 * 利润 = sellNetUSD(成交交易) − 成交当时的持有成本。
 *
 * 分享卡片原本各自算了一套（ShareModal 和 DomainShareModal 里是两份一模一样的
 * 拷贝）：
 *
 *   if (!domain.sale_price) return 0;
 *   return domain.sale_price - totalHoldingCost - domain.platform_fee;
 *
 * 三个问题：
 *   - 取的是域名行上的存档字段。sale_price 为 null 时直接返回 0 —— 导入的数据、
 *     或者补录了 sell 交易但没回写域名行的情况，卡片上就写着「利润 $0 / ROI 0%」，
 *     而同一个域名在 Insights 里明明是赚的。
 *   - 同一个域名卖过两轮（分期中断 → 重新挂牌成交）时，sale_price 只留得住最后
 *     一次，而持有成本是累计的，两者不配套。
 *   - 持有成本取的是「此刻」的，不是「成交当时」的。
 *
 * 分享图是要发出去给别人看的，上面的数字跟自己仪表盘对不上最难解释，所以这里
 * 统一回主口径。
 *
 * 分期注意：结果是否按「实际已收」折算，取决于调用方传进来的是原始交易还是
 * 折算过的交易（transactionsForMetrics）。传原始交易时，分期出售按合同全额算。
 */
export function latestSaleOutcome(
  domain: DomainWithTags,
  transactions: TransactionWithRequiredFields[]
): TradeOutcome | null {
  const outcomes = tradeOutcomes([domain], transactions);
  if (outcomes.length === 0) return null;
  return outcomes.reduce((latest, o) =>
    (o.saleDate || '') > (latest.saleDate || '') ? o : latest
  );
}

/** 利润；没有任何成交记录时为 0（卡片按「还没卖」渲染）。 */
export function domainSaleProfit(
  domain: DomainWithTags,
  transactions: TransactionWithRequiredFields[]
): number {
  return latestSaleOutcome(domain, transactions)?.profit ?? 0;
}

/** ROI 百分比。成本基准为 0 的免费域名 roi 是 null，卡片上按 0 渲染。 */
export function domainSaleROI(
  domain: DomainWithTags,
  transactions: TransactionWithRequiredFields[]
): number {
  return latestSaleOutcome(domain, transactions)?.roi ?? 0;
}
