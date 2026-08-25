/**
 * 续费持有成本口径，一句话：
 *
 *   续费成本 = (renewal_count − 已知金额的 renew 交易条数) × renewal_cost
 *            + Σ(已知金额的 renew 交易金额)
 *
 * 语义：renewal_count 是这个域名续费过的**总次数**，renew 交易是其中**金额已知**
 * 的那个子集，剩下的按 renewal_cost 估算。两部分互补，不重叠，所以不会双算。
 *
 * baseline_renewal_as_of 只决定「哪些交易算金额已知」：
 * - 有 baseline：基线日及之后的 renew 交易（基线之前的那些被认为已经包含在
 *   档案的 renewal_count 里了，是同一批续费的重复记录）。
 * - 无 baseline：全部 renew 交易。
 *
 * 早期版本在无 baseline 时直接 `return renewal_count × renewal_cost`，把用户
 * 手工记的 renew 交易金额整个丢掉——当时是为了防双算，而双算现在由上面那个
 * 减法解决了。baseline 因此不再影响成本总额，只影响 holdingCostAsOf 里档案
 * 部分的**记账时点**（有 baseline 就记在基线日，没有就按 renewal_cycle 摊）。
 *
 * 取得成本：有 buy 交易就以交易金额为准，没有才回落到档案上的 purchase_cost。
 * 两者都是用户手填的同一件事（这个域名花了多少钱买的），谁都可能只填了一边，
 * 相加就会双算——所以是「交易优先、档案兜底」，与 calculateYearlyRenewalVsProfit
 * 里既有的口径一致。
 *
 * transfer 交易（转移注册商的转入费）也算持有成本：域名档案上没有对应的汇总字段，
 * 所以不存在 buy / renew 那种「档案 vs 交易」双算问题，全部 transfer 交易直接
 * 累加，与 baseline 无关。fee / marketing / advertising 仍不计入 —— 它们是运营
 * 支出而非域名本身的取得/保有成本，只在年度现金流表的 otherOutflow 里出现。
 */

import { buyTxsForDomain, renewTxsForDomain, transferTxsForDomain } from './txIndex';

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
 * 取得成本：有 buy 交易就用交易金额之和，一笔都没有才回落到 purchase_cost。
 *
 * 不相加是因为两边记的是同一件事：DomainForm 上的 purchase_cost 和 Add
 * Transaction 里的 buy 交易，用户可能只填一边、也可能两边都填。相加会把同一次
 * 购入算两次，而只认档案又会让手工记的 buy 交易完全不进成本（此前就是如此）。
 */
export function acquisitionCostForDomain(
  domain: { id: string; purchase_cost?: number | null },
  transactions: RenewalCostTx[]
): number {
  // 走索引而不是全扫：这个函数被「按域名循环」调用，全扫就是 O(域名 × 交易)
  const buys = buyTxsForDomain(transactions, domain.id);
  if (buys.length === 0) return Number(domain.purchase_cost) || 0;
  let sum = 0;
  for (const t of buys) sum += Number(t.amount) || 0;
  return sum;
}

/** 该域名「金额已知」的 renew 交易：无 baseline 时是全部，有 baseline 时是
 *  基线日及之后的那些（基线之前的被视为已经计入档案 renewal_count）。 */
export function knownRenewalTxs<T extends RenewalCostTx>(
  domain: DomainRenewalCostFields,
  transactions: T[]
): T[] {
  const baseline = domain.baseline_renewal_as_of
    ? String(domain.baseline_renewal_as_of).slice(0, 10)
    : null;
  const usableBaseline = baseline && baseline.length === 10 ? baseline : null;
  // 走索引而不是全扫：这些函数被「按域名循环」调用，全扫就是 O(域名 × 交易)
  const all = renewTxsForDomain(transactions, domain.id);
  if (!usableBaseline) return all;
  return all.filter((t) => {
    const d = String(t.date).slice(0, 10);
    return d.length === 10 && d >= usableBaseline;
  });
}

/**
 * 归档续费次数 = renewal_count − 金额已知的 renew 交易条数。
 *
 * renewal_count 是续费总次数——mergeRenewTransactionDomainUpdates 每写一笔 renew
 * 交易就 +1。所以它天然包含了那些有交易记录的续费；要按真实金额累加那部分，
 * 就必须先把它们从计数里扣掉，否则同一笔续费既按 renewal_cost 估一遍、又按
 * 真实金额加一遍。
 *
 * 扣到负数时返回 0：renewal_count 是用户手填的，可能比交易条数还小（比如导入
 * 了交易但没同步计数）。这时全部交易金额照常计入，只是没有档案估算部分。
 */
export function archiveRenewalCount(
  domain: DomainRenewalCostFields,
  transactions: RenewalCostTx[]
): number {
  const total = Math.max(0, Math.floor(domain.renewal_count ?? 0));
  return Math.max(0, total - knownRenewalTxs(domain, transactions).length);
}

/** 档案估算部分：归档次数 × 单次续费成本。 */
export function archiveRenewalCost(
  domain: DomainRenewalCostFields,
  transactions: RenewalCostTx[]
): number {
  return archiveRenewalCount(domain, transactions) * (Number(domain.renewal_cost) || 0);
}

/** 金额已知部分：renew 交易金额之和。 */
export function knownRenewalCostFromTransactions(
  domain: DomainRenewalCostFields,
  transactions: RenewalCostTx[]
): number {
  let sum = 0;
  for (const t of knownRenewalTxs(domain, transactions)) sum += Number(t.amount) || 0;
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
  return (
    archiveRenewalCost(domain, transactions) +
    knownRenewalCostFromTransactions(domain, transactions)
  );
}

export function totalHoldingCostForDomain(
  domain: DomainRenewalCostFields & { purchase_cost?: number | null },
  transactions: RenewalCostTx[]
): number {
  return (
    acquisitionCostForDomain(domain, transactions) +
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
 * 金额口径与 `totalHoldingCostForDomain` 完全一致，这里只多了「什么时候记账」：
 * - 购买：有 buy 交易时按各自的 date <= asOf 累加，否则用 purchase_cost
 *   （purchase_date > asOf 时整个域名还不存在，直接返回 0）
 * - 金额已知的 renew 交易：按各自的 date <= asOf 累加
 * - 档案估算部分（archiveRenewalCount × renewal_cost）：
 *    - 有 baseline：按 baseline 一次性记账，baseline <= asOf 时计入全额
 *      （基线日就是「存量截止到这天」的那个时点）
 *    - 无 baseline：没有任何日期线索，只能按 renewal_cycle 均匀摊在 purchase
 *      之后，第 i 次续费视为发生在 purchase + i × cycle 年。这只是近似；若
 *      renewal_count 跟 ownership/renewal_cycle 对不上，asOf=now 时的值会与
 *      `totalHoldingCostForDomain` 有微小差异（数据一致性问题）。
 * - 转移费：transfer 交易按 date <= asOf 累加（无 baseline 概念）
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

  // 取得成本：交易优先、档案兜底，与 acquisitionCostForDomain 同口径，
  // 只是 buy 交易还要按各自的日期截断。
  let total = 0;
  const buys = buyTxsForDomain(transactions, domain.id);
  if (buys.length === 0) {
    total += Number(domain.purchase_cost) || 0;
  } else {
    for (const t of buys) {
      const txTime = new Date(t.date).getTime();
      if (Number.isFinite(txTime) && txTime <= asOf) total += Number(t.amount) || 0;
    }
  }

  // 金额已知的 renew 交易：各自按交易日截断
  for (const t of knownRenewalTxs(domain, transactions)) {
    const txTime = new Date(t.date).getTime();
    if (Number.isFinite(txTime) && txTime <= asOf) {
      total += Number(t.amount) || 0;
    }
  }

  // 档案估算部分：金额固定（archiveRenewalCount × renewal_cost），差别只在
  // 什么时候记账 —— 有 baseline 就整块记在基线日，没有就按 renewal_cycle 摊。
  const archiveCount = archiveRenewalCount(domain, transactions);
  const perRenewal = Number(domain.renewal_cost) || 0;
  if (archiveCount > 0 && perRenewal !== 0) {
    if (domain.baseline_renewal_as_of) {
      const baselineTime = new Date(domain.baseline_renewal_as_of).getTime();
      if (Number.isFinite(baselineTime) && baselineTime <= asOf) {
        total += archiveCount * perRenewal;
      }
    } else {
      const cycleYears = Math.max(1, Number(domain.renewal_cycle) || 1);
      const cycleMs = cycleYears * 365.25 * 24 * 60 * 60 * 1000;
      for (let i = 1; i <= archiveCount; i++) {
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
