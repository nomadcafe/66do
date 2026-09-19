/**
 * 按销售平台（marketplace）聚合的成交表现。
 *
 * 回答的是米农最常问的那个问题：**哪个平台真正给我赚得多，它们各抽走多少**。
 * 各家名义费率差得很远（Afternic ~15–20%、Sedo ~10–15%、Dan ~9%…），但名义
 * 费率不等于你实际付出的——分期的手续费按已收比例摊、一口价按成交价扣，
 * 真正有用的是"实收 / 成交额"这个事后算出来的**有效费率**。
 *
 * 口径全部建立在 tradeOutcomes 之上（每笔 sell 一行，cost basis 走
 * holdingCostAsOf，分期按已付期折算），所以这张表和 Insights 的 Realized P&L /
 * Top Performers / Realized ROI 是同一批事实，不会各说各话。
 *
 * 只看卖出侧。买入 / 续费的注册商维度已经由 renewalCostService 的
 * cost_by_registrar 和持仓分布那几张图覆盖了，不在这里重复。
 */

import { tradeOutcomes } from './realizedPnL';
import type { DomainWithTags } from '../types/dashboard';
import type { TransactionWithRequiredFields } from '../types/transaction';

/**
 * platform_fee_type 里已经结构化地写着平台了——用户选了"Afternic 分期"
 * 这个费率模型，平台是谁就没有悬念。platform 这一列是后加的自由文本，
 * 老交易全是 NULL，只靠它的话这张表大半会是 Unknown。
 *
 * 'standard' 不在表里：它只说明"按固定费率算"，没有平台信息。
 */
const PLATFORM_BY_FEE_TYPE: Record<string, string> = {
  afternic_installment: 'Afternic',
  atom_installment: 'Atom',
  spaceship_installment: 'Spaceship',
  escrow_installment: 'Escrow.com',
};

/** 表单 datalist 的种子名，同时充当规范写法字典：用户打了 'sedo'、'SEDO'，
 *  聚合时都归到 'Sedo' 这一行，而不是散成三行。 */
const CANONICAL_NAMES = [
  'Afternic', 'Atom', 'Sedo', 'Dan', 'Escrow.com',
  'Spaceship', 'GoDaddy', 'Namecheap', 'NameSilo',
];
const CANONICAL_BY_LOWER = new Map(CANONICAL_NAMES.map((n) => [n.toLowerCase(), n]));

/** 这笔成交发生在哪个平台。拿不到就返回 null，由调用方归入 Unknown 桶。 */
export function platformOfSale(t: TransactionWithRequiredFields): string | null {
  const explicit = (t.platform || '').trim();
  if (explicit) return CANONICAL_BY_LOWER.get(explicit.toLowerCase()) ?? explicit;
  const derived = PLATFORM_BY_FEE_TYPE[(t.platform_fee_type || '').trim()];
  return derived ?? null;
}

export interface PlatformSalesRow {
  /** 显示名。规范写法优先，用户自造的名字保留他自己的大小写。 */
  platform: string;
  /** true = 这一行是"没有平台信息"的兜底桶。UI 据此弱化显示 + 给补录提示。 */
  isUnknown: boolean;
  salesCount: number;
  /** 成交额（毛额，分期按已收期折算） */
  grossSales: number;
  /** 平台抽成 = 毛额 − 实收 */
  platformFees: number;
  /** 实收（已扣平台费） */
  netProceeds: number;
  /** 有效费率 = 平台费 / 成交额 × 100。成交额 <= 0 时为 null（除不了）。 */
  feeRatePercent: number | null;
  /** 这些成交的 cost basis 合计（买入 + 卖出前的续费） */
  costBasis: number;
  /** 已实现盈亏 = 实收 − cost basis */
  realizedPnL: number;
}

export interface SalesByPlatformSummary {
  rows: PlatformSalesRow[];
  totals: Omit<PlatformSalesRow, 'platform' | 'isUnknown'>;
  /** 没有平台信息的成交笔数。> 0 时 UI 提示用户可以补录。 */
  unknownCount: number;
}

/**
 * @param domains 全量域名。
 * @param transactions **transactionsForMetrics**（分期按实际已收折算过的那一份），
 *   而不是原始 transactions。折算发生在 dashboard 那一层：未收完的分期，
 *   amount / net_amount / platform_fee 都已经按已付比例缩过，带平台规则的
 *   分期还会实时重算费率。传原始列表的话，一笔签了 $12,000 才收到 $2,000
 *   的分期会按 $12,000 全额计入成交额和实收——整张表凭空放大。
 *
 *   两者都要全量、不要预过滤：cost basis 要看域名完整的购买 + 续费历史，
 *   截短过的会把成本算小、利润算大。
 */
export function salesByPlatform(
  domains: DomainWithTags[],
  transactions: TransactionWithRequiredFields[]
): SalesByPlatformSummary {
  const txById = new Map(transactions.map((t) => [t.id, t]));

  type Bucket = {
    /** null = 没有平台信息的兜底桶 */
    display: string | null;
    salesCount: number;
    grossSales: number;
    netProceeds: number;
    costBasis: number;
  };
  // key 用小写，所以 'Sedo' / 'sedo' / 'SEDO' 落同一个桶。这也是为什么库里
  // 那些大小写分叉的历史数据不需要专门写迁移去洗——聚合这一层就消化掉了。
  //
  // 兜底桶的 key 直接用 null，而不是造个哨兵字符串：哨兵得保证永远撞不上
  // 真实平台名，null 天然做得到，也不用在源码里塞控制字符。
  const buckets = new Map<string | null, Bucket>();

  for (const trade of tradeOutcomes(domains, transactions)) {
    const tx = txById.get(trade.transactionId);
    const name = tx ? platformOfSale(tx) : null;
    const key = name ? name.toLowerCase() : null;

    let b = buckets.get(key);
    if (!b) {
      b = { display: name, salesCount: 0, grossSales: 0, netProceeds: 0, costBasis: 0 };
      buckets.set(key, b);
    }
    b.salesCount += 1;
    b.grossSales += trade.sellGross;
    b.netProceeds += trade.sellNet;
    b.costBasis += trade.costBasisAtSale;
  }

  const finish = (b: Omit<Bucket, 'display'>) => {
    // 平台费从 gross − net 反推，而不是读 tx.platform_fee：分期只收到一部分
    // 时，tradeOutcomes 的 gross/net 都是按已付比例折算过的，费用自然跟着摊；
    // 直接读 platform_fee 会把整笔合同的费用算进只收了两期的成交里。
    const platformFees = b.grossSales - b.netProceeds;
    return {
      salesCount: b.salesCount,
      grossSales: b.grossSales,
      platformFees,
      netProceeds: b.netProceeds,
      feeRatePercent: b.grossSales > 0 ? (platformFees / b.grossSales) * 100 : null,
      costBasis: b.costBasis,
      realizedPnL: b.netProceeds - b.costBasis,
    };
  };

  const rows: PlatformSalesRow[] = Array.from(buckets.values())
    .map((b) => ({
      platform: b.display ?? '',
      isUnknown: b.display === null,
      ...finish(b),
    }))
    // 按实收降序——"哪个平台给我带来的钱最多"是看这张表的第一个问题。
    // Unknown 永远沉底：它不是一个平台，是一堆待补录的数据。
    .sort((a, b) => {
      if (a.isUnknown !== b.isUnknown) return a.isUnknown ? 1 : -1;
      return b.netProceeds - a.netProceeds;
    });

  const totals = finish(
    rows.reduce(
      (acc, r) => ({
        salesCount: acc.salesCount + r.salesCount,
        grossSales: acc.grossSales + r.grossSales,
        netProceeds: acc.netProceeds + r.netProceeds,
        costBasis: acc.costBasis + r.costBasis,
      }),
      { salesCount: 0, grossSales: 0, netProceeds: 0, costBasis: 0 }
    )
  );

  return {
    rows,
    totals,
    unknownCount: rows.find((r) => r.isUnknown)?.salesCount ?? 0,
  };
}
