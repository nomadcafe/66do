/**
 * 续费持有成本口径：
 * - 未设置 baseline_renewal_as_of：仅 renewal_count × renewal_cost（与历史行为一致，不叠加 renew 交易以免双算）。
 * - 已设置 baseline_renewal_as_of：档案估算 + 基线日及之后的 renew 交易金额（按自然日 date >= 基线日）。
 *
 * transfer 交易（转移注册商的转入费）也算持有成本：域名档案上没有对应的汇总字段，
 * 所以不存在 renew 那种「档案 vs 交易」双算问题，全部 transfer 交易直接累加，
 * 与 baseline 无关。fee / marketing / advertising 仍不计入 —— 它们是运营支出而
 * 非域名本身的取得/保有成本，只在年度现金流表的 otherOutflow 里出现。
 */

import { renewTxsForDomain, transferTxsForDomain } from './txIndex';

export type RenewalCostTx = {
  domain_id: string;
  type: string;
  date: string;
  amount: number;
};

export type DomainRenewalCostFields = {
  id: string;
  renewal_count?: number | null;
  renewal_cost?: number | null;
  baseline_renewal_as_of?: string | null;
};

/**
 * 归档续费次数：renewal_count 减去「基线日及之后的 renew 交易」条数。
 *
 * renewal_count 是一个总计数器——mergeRenewTransactionDomainUpdates 每写一笔
 * renew 交易就 +1，无论那笔交易在不在基线之后。所以有 baseline 的域名不能直接
 * 拿 renewal_count 当归档次数：基线后的那几次既进了计数器（→ count × cost），
 * 又会被 incrementalRenewalFromTransactions 按真实金额加一遍，同一笔续费算两次。
 *
 * expandRenewalEvents 里早就做了同样的扣减，这里补上让两套口径一致。
 */
export function archiveRenewalCount(
  domain: DomainRenewalCostFields,
  transactions: RenewalCostTx[]
): number {
  const total = Math.max(0, Math.floor(domain.renewal_count ?? 0));
  const baseline = domain.baseline_renewal_as_of
    ? String(domain.baseline_renewal_as_of).slice(0, 10)
    : null;
  if (!baseline || baseline.length < 10) return total;

  let postBaselineTxCount = 0;
  for (const t of renewTxsForDomain(transactions, domain.id)) {
    const d = String(t.date).slice(0, 10);
    if (d.length < 10) continue;
    if (d >= baseline) postBaselineTxCount++;
  }
  return Math.max(0, total - postBaselineTxCount);
}

/** 纯档案口径：renewal_count × renewal_cost。有 baseline 的域名请走
 *  archiveRenewalCount 先扣掉基线后的交易，否则会与交易金额双算。 */
export function archiveRenewalCost(domain: {
  renewal_count?: number | null;
  renewal_cost?: number | null;
}): number {
  return (domain.renewal_count ?? 0) * (Number(domain.renewal_cost) || 0);
}

export function incrementalRenewalFromTransactions(
  domainId: string,
  baselineDate: string | null | undefined,
  transactions: RenewalCostTx[]
): number {
  if (baselineDate == null || String(baselineDate).trim() === '') return 0;
  const b = String(baselineDate).slice(0, 10);
  let sum = 0;
  // 走索引而不是全扫：这个函数被「按域名循环」调用，全扫就是 O(域名 × 交易)
  for (const t of renewTxsForDomain(transactions, domainId)) {
    const d = String(t.date).slice(0, 10);
    if (d.length < 10 || b.length < 10) continue;
    if (d >= b) sum += Number(t.amount) || 0;
  }
  return sum;
}

/** 某域名全部 transfer 交易金额之和（转入费）。与 baseline 无关。 */
export function transferCostForDomain(
  domainId: string,
  transactions: RenewalCostTx[]
): number {
  let sum = 0;
  // 走索引而不是全扫：这个函数被「按域名循环」调用，全扫就是 O(域名 × 交易)
  for (const t of transferTxsForDomain(transactions, domainId)) {
    sum += Number(t.amount) || 0;
  }
  return sum;
}

export function totalRenewalCostForHolding(
  domain: DomainRenewalCostFields,
  transactions: RenewalCostTx[]
): number {
  if (domain.baseline_renewal_as_of) {
    const archive =
      archiveRenewalCount(domain, transactions) * (Number(domain.renewal_cost) || 0);
    return archive + incrementalRenewalFromTransactions(domain.id, domain.baseline_renewal_as_of, transactions);
  }
  return archiveRenewalCost(domain);
}

export function totalHoldingCostForDomain(
  domain: DomainRenewalCostFields & { purchase_cost?: number | null },
  transactions: RenewalCostTx[]
): number {
  return (
    (Number(domain.purchase_cost) || 0) +
    totalRenewalCostForHolding(domain, transactions) +
    transferCostForDomain(domain.id, transactions)
  );
}

/**
 * 域名截至 `asOfDate` 时点已累计的持有成本（purchase + 已发生续费）。
 *
 * 用途：时间序列图表按月聚合"历史投资"时，不应把未来才发生的续费算进
 * 过去月份的点上。例如 2 年前买入、现在已续费 2 次的域名，在"1 年前那一点"
 * 的投资额里不该包含之后那些续费。
 *
 * 与 `totalHoldingCostForDomain` 语义对齐：
 * - 购买：purchase_date <= asOf 才计入 purchase_cost
 * - 有 baseline_renewal_as_of：
 *    - 档案部分（renewal_count × renewal_cost）按 baseline 一次性记账，
 *      baseline <= asOf 时计入全额（baseline 时点即存量的切换点）
 *    - baseline 之后的 renew 交易（有真实日期）按 date <= asOf 累加
 * - 转移费：transfer 交易按 date <= asOf 累加（无 baseline 概念）
 * - 无 baseline：档案部分按 renewal_cycle 均匀分布在 purchase 之后，
 *   第 i 次续费视为发生在 purchase + i × cycle 年。这只是近似；若用户填写
 *   的 renewal_count 跟 ownership/renewal_cycle 对不上，asOf=now 时的值
 *   会与 `totalHoldingCostForDomain` 有微小差异（数据一致性问题）。
 */
export function holdingCostAsOf(
  domain: DomainRenewalCostFields & {
    purchase_cost?: number | null;
    purchase_date?: string | null;
    renewal_cycle?: number | null;
  },
  transactions: RenewalCostTx[],
  asOfDate: Date
): number {
  const asOf = asOfDate.getTime();
  if (!Number.isFinite(asOf)) return 0;

  const purchaseTime = domain.purchase_date ? new Date(domain.purchase_date).getTime() : NaN;
  if (!Number.isFinite(purchaseTime) || purchaseTime > asOf) return 0;

  let total = Number(domain.purchase_cost) || 0;

  if (domain.baseline_renewal_as_of) {
    const baselineTime = new Date(domain.baseline_renewal_as_of).getTime();
    if (Number.isFinite(baselineTime) && baselineTime <= asOf) {
      // 基线后的 renew 交易在下面按真实金额累加，这里必须扣掉它们的计数
      total += archiveRenewalCount(domain, transactions) * (Number(domain.renewal_cost) || 0);
    }
    // Post-baseline renew transactions
    const b = String(domain.baseline_renewal_as_of).slice(0, 10);
    for (const t of renewTxsForDomain(transactions, domain.id)) {
      const d = String(t.date).slice(0, 10);
      if (d.length < 10 || b.length < 10) continue;
      if (d < b) continue;
      const txTime = new Date(t.date).getTime();
      if (Number.isFinite(txTime) && txTime <= asOf) {
        total += Number(t.amount) || 0;
      }
    }
  } else {
    const renewCount = domain.renewal_count ?? 0;
    if (renewCount > 0) {
      const cycleYears = Math.max(1, Number(domain.renewal_cycle) || 1);
      const cycleMs = cycleYears * 365.25 * 24 * 60 * 60 * 1000;
      const perRenewal = Number(domain.renewal_cost) || 0;
      for (let i = 1; i <= renewCount; i++) {
        const renewalTime = purchaseTime + i * cycleMs;
        if (renewalTime <= asOf) total += perRenewal;
      }
    }
  }

  // 转移费：与 baseline 无关，只按交易日截断
  for (const t of transferTxsForDomain(transactions, domain.id)) {
    const txTime = new Date(t.date).getTime();
    if (Number.isFinite(txTime) && txTime <= asOf) {
      total += Number(t.amount) || 0;
    }
  }

  return total;
}
