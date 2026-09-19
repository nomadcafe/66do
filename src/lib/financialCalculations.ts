// 单域名 ROI / 货币格式化 / 过期损失。组合层面的财务指标
// （ROI、年化、夏普、波动率、年化收益率等）一律走 coreCalculations.ts。

import {
  totalRenewalCostForHolding,
  transferCostForDomain,
  acquisitionCostForDomain,
} from './renewalCostBasis';
import { isDomainLost } from './domainLossStatus';
import { sellGrossUSD, sellNetUSD } from './sellProceeds';
import { txsForDomain } from './txIndex';
import { calendarYearOf, parseLocalCalendarDate } from './localCalendarDate';

type RoiDomain = {
  id?: string;
  purchase_cost?: number | null;
  renewal_cost?: number | null;
  renewal_count: number;
  baseline_renewal_as_of?: string | null;
  status: string;
  sale_price?: number | null;
  platform_fee?: number | null;
  estimated_value?: number | null;
  expiry_date?: string | null;
};

type RoiTransactions = Array<{
  domain_id: string;
  type: string;
  date: string;
  amount: number;
  net_amount?: number | null;
  platform_fee?: number | null;
}>;

/** 总持有成本 = 购入 + 续费 + 转移。拿不到 transactions 时退回档案字段。
 *  抽出来给 calculateDomainROI 和 domainRoiWithKind 共用——后者需要知道
 *  分母是不是 0，光看 ROI 的返回值区分不出「打平」和「除不了」。 */
function holdingCostOf(domain: RoiDomain, transactions?: RoiTransactions): number {
  const purchaseCost =
    domain.id && transactions
      ? acquisitionCostForDomain({ id: domain.id, purchase_cost: domain.purchase_cost }, transactions)
      : domain.purchase_cost || 0;
  const renewalCost =
    domain.id && transactions
      ? totalRenewalCostForHolding(
          {
            id: domain.id,
            renewal_count: domain.renewal_count,
            renewal_cost: domain.renewal_cost,
            baseline_renewal_as_of: domain.baseline_renewal_as_of ?? null
          },
          transactions
        )
      : domain.renewal_count * (domain.renewal_cost || 0);
  const transferCost =
    domain.id && transactions ? transferCostForDomain(domain.id, transactions) : 0;
  return purchaseCost + renewalCost + transferCost;
}

/** 该域名全部 sell 交易的净额之和。拿不到 transactions 时退回域名行上的
 *  sale_price − platform_fee 存档字段。
 *
 *  DomainCard 的 Net Profit 以前是直接读那两个存档字段算的，于是同一域名卖过
 *  两轮时只算得到最后一次（而持有成本是累计的），跟它旁边那个按交易算的 ROI
 *  当场矛盾。导出给它用，保证一张卡上两个数同源。 */
export function soldNetRevenueOf(domain: RoiDomain, transactions?: RoiTransactions): number {
  const sellTxs = sellTxsOf(domain, transactions);
  if (sellTxs.length > 0) return sellTxs.reduce((sum, t) => sum + sellNetUSD(t), 0);
  return (domain.sale_price ?? 0) - (domain.platform_fee || 0);
}

/** 该域名全部 sell 交易的**毛额**之和（未扣平台费）。给"成交价"这类展示用——
 *  利润和 ROI 一律走 net（soldNetRevenueOf），两者不能混。 */
export function soldGrossRevenueOf(domain: RoiDomain, transactions?: RoiTransactions): number {
  const sellTxs = sellTxsOf(domain, transactions);
  if (sellTxs.length > 0) return sellTxs.reduce((sum, t) => sum + sellGrossUSD(t), 0);
  return domain.sale_price ?? 0;
}

function sellTxsOf(domain: RoiDomain, transactions?: RoiTransactions) {
  return domain.id && transactions
    ? txsForDomain(transactions, domain.id).filter((t) => t.type === 'sell')
    : [];
}

/**
 * 计算单个域名的 ROI（Domain Portfolio 表格/卡片使用）
 * 公式：ROI = (净收入 - 总持有成本) / 总持有成本 × 100
 * - 总持有成本 = 购买成本(purchase_cost) + 续费成本 + 转移费(transfer 交易)
 *   续费成本口径见 renewalCostBasis；转移费需要传入 transactions 才能算。
 * - 已出售：净收入 = 该域名全部 sell 交易的净额之和；拿不到交易数据时才退回
 *   域名行上的 sale_price − platform_fee 存档字段
 *
 * 与 enhancedFinancialMetrics.calculateDomainROI（同名，TransactionList 用）的
 * 区别：成本口径两边一致，收入口径这边多一条「持有中用 estimated_value 代入」
 * 的未实现分支——表格要的是"现在值多少"，交易列表要的是"这笔成交赚了多少"。
 * 已出售那一支现在两边同源，不会再各说各话。
 * - 过期：视为 -100%
 * - 持有中且有预估价值：净收入用 estimated_value 代入
 *
 * 成本为 0 时返回 0（比值没有定义，这里只能给个数）。调用方要区分「打平」和
 * 「除不了」，走 domainRoiWithKind —— 它在这种情况下返回 roi: null。
 */
export function calculateDomainROI(
  domain: RoiDomain,
  transactions?: RoiTransactions
): number {
  const totalHoldingCost = holdingCostOf(domain, transactions);

  if (totalHoldingCost === 0) return 0;

  // 已出售：净收入优先按 sell 交易算，与 TransactionList / Insights 同口径。
  //
  // 以前只读域名行上的 sale_price − platform_fee，两个后果：
  //   - sale_price 没回写时（导入的数据、补录的 sell 交易）netRevenue = 0，
  //     一笔赚了 4 倍的成交在表格里显示成 −100%；
  //   - 同一个域名卖过两轮时 sale_price 只留得住最后一次，而持有成本是累计的。
  // 存档字段留作兜底：调用方没传 transactions 时仍然按老路走。
  if (domain.status === 'sold') {
    const netRevenue = soldNetRevenueOf(domain, transactions);
    return ((netRevenue - totalHoldingCost) / totalHoldingCost) * 100;
  }

  // 已放弃续费，或过期超过宽限期未续 → 视为 -100%（口径见 domainLossStatus）
  if (isDomainLost(domain)) return -100;

  if (domain.estimated_value != null && domain.estimated_value > 0) {
    return ((domain.estimated_value - totalHoldingCost) / totalHoldingCost) * 100;
  }

  return 0;
}

/** ROI 这个数是怎么来的。列表要据此决定显示成什么样。 */
export type DomainRoiKind =
  /** 已成交，钱到账了 */
  | 'realized'
  /** 持有中，按用户填的 estimated_value 折算出来的账面浮盈/浮亏 */
  | 'unrealized'
  /** 放弃续费 / 过期未续，全额冲销 */
  | 'lost'
  /** 持有中但没填估值——没有依据，不是 0% */
  | 'unknown';

/**
 * 带出处的域名 ROI。
 *
 * calculateDomainROI 只返回一个 number，四种完全不同的情况被压成同一个数字：
 * 已实现收益、按用户手填估值算的浮盈、−100% 的冲销，以及"没填估值"。
 * 最后那种返回 0，在列表里被渲染成**绿色的 +0.0%**——读起来是"打平"，实际
 * 意思是"不知道"。CSV 刚导进来、还没填任何估值的组合，整张表会铺满绿色的
 * +0.0%，而那些域名此刻全是净支出。
 *
 * 金额口径与 calculateDomainROI 完全一致，这里只多告诉调用方「这个数算不算数」。
 */
export function domainRoiWithKind(
  domain: Parameters<typeof calculateDomainROI>[0],
  transactions?: Parameters<typeof calculateDomainROI>[1]
): { roi: number | null; kind: DomainRoiKind } {
  if (domain.status === 'sold') {
    // cost basis 为 0（抢注 / 白嫖来的米，或成本压根没录）时 ROI 没有定义：
    // 分母是 0，任何正收益都是无穷大。calculateDomainROI 在这里兜底返回 0，
    // 于是一个 $0 成本卖出 $10,000 的域名在表格里渲染成**绿色的 +0.0%**——
    // 跟"持有中没填估值"那档一模一样的读法错误（那档已经修成 null 了）。
    // realizedPnL.tradeOutcomes 早就是 `costBasis > 0 ? … : null`，这里对齐它。
    //
    // kind 仍然是 realized：这笔交易确确实实成交了、profit 也算得出来，
    // 只有"回报率"这个比值无从表达。表格据此渲染成「—」并给出对应提示。
    if (holdingCostOf(domain, transactions) <= 0) {
      return { roi: null, kind: 'realized' };
    }
    return { roi: calculateDomainROI(domain, transactions), kind: 'realized' };
  }
  if (isDomainLost(domain)) return { roi: -100, kind: 'lost' };
  if (domain.estimated_value != null && domain.estimated_value > 0) {
    return { roi: calculateDomainROI(domain, transactions), kind: 'unrealized' };
  }
  return { roi: null, kind: 'unknown' };
}

// 格式化货币
export function formatCurrency(
  amount: number,
  currency: string = 'USD',
  locale: string = 'en-US'
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency
  }).format(amount);
}

/**
 * 过期域名损失口径（与续费持有成本一致）：
 * - 计入条件：status=expired，或过期超过 EXPIRY_GRACE_DAYS 仍未续费（见 isDomainLost）
 * - 损失金额 = 购买成本 + renewal_count × renewal_cost（已发生续费成本）
 * - 视为全额冲销：未扣减任何售出/回款；若曾部分出售需在交易层单独体现
 * - 无 expiry_date 但 status=expired 时，仍计入列表；年度归桶优先用 purchase_date 年，否则归入 unknown
 */
export interface ExpiredDomainLoss {
  totalLoss: number;
  annualLoss: { [year: string]: number };
  expiredDomains: Array<{
    id: string;
    domain_name: string;
    totalInvestment: number;
    /** 到期日；null 表示未填 expiry_date */
    expiryDate: string | null;
    /** 用于年度汇总：到期年，或购买年，或 unknown */
    lossYear: string;
  }>;
  lossByYear: Array<{
    year: string;
    loss: number;
    domainCount: number;
  }>;
  /**
   * expiredDomains 里没有任何成本数据的域名数（totalInvestment <= 0）。
   *
   * 它们照样是已损失的域名，只是没填 purchase_cost —— 所以计入个数、但对
   * totalLoss 贡献 0，合计因此偏低。以前这类域名被整个丢弃，全部过期域名都
   * 没填成本时 expiredDomains 会是空的，界面于是弹出「恭喜！您没有因域名过期
   * 造成的损失」，而同一张卡下方的状态统计里明写着「已过期: N」。
   */
  unknownCostCount: number;
}

// 计算过期域名损失
export function calculateExpiredDomainLoss(
  domains: Array<{
    id: string;
    domain_name: string;
    purchase_cost?: number | null;
    renewal_cost?: number | null;
    renewal_count: number;
    baseline_renewal_as_of?: string | null;
    status: string;
    expiry_date?: string | null;
    purchase_date?: string | null;
  }>,
  transactions?: Array<{ domain_id: string; type: string; date: string; amount: number }>
): ExpiredDomainLoss {
  const expiredDomains: ExpiredDomainLoss['expiredDomains'] = [];
  const annualLoss: { [year: string]: number } = {};
  let totalLoss = 0;
  let unknownCostCount = 0;

  domains.forEach(domain => {
    // 损失 = 用户手动标 expired（主动放弃）+ 过期超过宽限期仍未续费（自动冲销）。
    // 宽限期内（刚过期但未到 EXPIRY_GRACE_DAYS）只是"逾期催办"信号，由 dashboard
    // 的 next-expiry 提示负责，不在损失里归账，避免误把可能续费的域名当成损失。
    if (!isDomainLost(domain)) return;

    const expiryDateStr: string | null = domain.expiry_date ?? null;
    const expiryDate: Date | null = parseLocalCalendarDate(domain.expiry_date);

    const purchaseCost = transactions
      ? acquisitionCostForDomain({ id: domain.id, purchase_cost: domain.purchase_cost }, transactions)
      : domain.purchase_cost || 0;
    const renewalCost = transactions
      ? totalRenewalCostForHolding(
          {
            id: domain.id,
            renewal_count: domain.renewal_count,
            renewal_cost: domain.renewal_cost,
            baseline_renewal_as_of: domain.baseline_renewal_as_of ?? null
          },
          transactions
        )
      : (domain.renewal_count ?? 0) * (domain.renewal_cost || 0);
    const transferCost = transactions ? transferCostForDomain(domain.id, transactions) : 0;
    const totalInvestment = purchaseCost + renewalCost + transferCost;

    // 没有成本数据的照样计入：它是一个已经损失掉的域名，这是事实；
    // 只是金额未知，由 unknownCostCount 单独报出来，别让它把整个板块变成
    // 「恭喜，没有过期域名」。
    if (totalInvestment <= 0) unknownCostCount++;

    let lossYear: string;
    if (expiryDate) {
      lossYear = String(calendarYearOf(expiryDateStr));
    } else if (domain.purchase_date) {
      lossYear = String(calendarYearOf(domain.purchase_date));
    } else {
      lossYear = 'unknown';
    }

    expiredDomains.push({
      id: domain.id,
      domain_name: domain.domain_name,
      totalInvestment,
      expiryDate: expiryDateStr,
      lossYear
    });

    annualLoss[lossYear] = (annualLoss[lossYear] || 0) + totalInvestment;
    totalLoss += totalInvestment;
  });

  // 按年份排序
  const lossByYear = Object.entries(annualLoss)
    .map(([year, loss]) => ({
      year,
      loss,
      domainCount: expiredDomains.filter((d) => d.lossYear === year).length
    }))
    .sort((a, b) => {
      if (a.year === 'unknown') return 1;
      if (b.year === 'unknown') return -1;
      return parseInt(a.year, 10) - parseInt(b.year, 10);
    });

  return {
    totalLoss,
    annualLoss,
    expiredDomains,
    lossByYear,
    unknownCostCount
  };
}
