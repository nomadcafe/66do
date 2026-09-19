// 单域名 ROI（TransactionList 用）+ 百分比格式化工具。
// 组合层面的财务指标走 coreCalculations.ts。

import { sellGrossUSD, sellNetUSD } from './coreCalculations';
import {
  totalRenewalCostForHolding,
  transferCostForDomain,
  acquisitionCostForDomain,
} from './renewalCostBasis';
import { isDomainLost } from './domainLossStatus';
import { txsForDomain } from './txIndex';
import { parseLocalCalendarDate } from './localCalendarDate';

interface DomainROI {
  domainId: string;
  domainName: string;
  totalInvestment: number;      // 总投资（购买+续费）
  totalSales: number;          // 总销售额
  netRevenue: number;          // 净收入（扣除手续费）
  grossProfit: number;          // 毛利润（净收入-投资成本）
  /** ROI 百分比。cost basis 为 0（免费域名 / 成本没录）时为 null —— 比值没有
   *  定义，兜底成 0 会被读成「打平」。 */
  roi: number | null;
  /** 持有天数：买入 → 成交（未卖则到今天）。日期缺失 / 异常时为 null。 */
  holdingPeriod: number | null;
  status: string;
  saleDate?: string;
}

/**
 * 单个域名的 ROI —— **已实现**口径：收入只认该域名的 sell 交易净额。
 *
 * 注意仓库里有两个同名函数，导入时别拿错：
 *   - 这个（enhancedFinancialMetrics）：TransactionList 的成交行用，回答
 *     「这笔成交赚了多少」，不看 estimated_value。
 *   - financialCalculations.calculateDomainROI：DomainTable / DomainCard 用，
 *     持有中的域名会用 estimated_value 代入，回答「这个米现在值多少」。
 * 成本口径两边一致（都走 renewalCostBasis）；已出售那一支的收入现在也同源。
 */
// 计算单个域名的ROI
export function calculateDomainROI(
  domain: {
    id: string;
    domain_name: string;
    purchase_cost: number | null;
    renewal_cost: number | null;
    renewal_count: number;
    baseline_renewal_as_of?: string | null;
    purchase_date: string | null;
    status: string;
    expiry_date?: string | null;
  },
  transactions: Array<{
    domain_id: string;
    type: string;
    amount: number;
    platform_fee?: number | null;
    net_amount?: number | null;
    date: string;
  }>
): DomainROI {
  
  // 成本函数直接吃完整数组：它们内部走 txIndex 的 WeakMap 索引（以数组本身
  // 为键）按 domain_id 取桶。在这里先 filter 一遍会产生新数组，每调一次就让
  // 索引重建一次——列表里每行调一次，等于 O(行数 × 交易数 × 4 个索引)。
  const purchaseCost = acquisitionCostForDomain(
    { id: domain.id, purchase_cost: domain.purchase_cost },
    transactions
  );
  const renewalCost = totalRenewalCostForHolding(
    {
      id: domain.id,
      renewal_count: domain.renewal_count,
      renewal_cost: domain.renewal_cost,
      baseline_renewal_as_of: domain.baseline_renewal_as_of ?? null
    },
    transactions
  );
  const transferCost = transferCostForDomain(domain.id, transactions);
  const totalInvestment = purchaseCost + renewalCost + transferCost;

  // 销售收入
  const salesTransactions = txsForDomain(transactions, domain.id).filter(t => t.type === 'sell');
  const totalSales = salesTransactions.reduce((sum, t) => sum + sellGrossUSD(t), 0);
  const netRevenue = salesTransactions.reduce((sum, t) => sum + sellNetUSD(t), 0);
  
  // 检查域名是否构成损失（手动 expired 或过期超过宽限期未续，口径见 domainLossStatus）
  const isExpired = isDomainLost(domain);
  
  // 利润和ROI
  let grossProfit: number;
  let roi: number | null;
  
  if (isExpired) {
    // 过期域名：100%损失
    grossProfit = -totalInvestment;
    roi = -100;
  } else {
    // 正常计算
    grossProfit = netRevenue - totalInvestment;
    // cost basis 为 0（抢注 / 白嫖，或成本没录）时比值没有定义，给 null 而不是
    // 兜底 0：以前一笔 $0 成本卖出 $10,000 的成交，在交易列表里左边写着赚了
    // $10,000、右边 ROI 写 0.0%。与 financialCalculations.domainRoiWithKind 和
    // realizedPnL.tradeOutcomes 对齐，三处对同一笔成交给同一个答案。
    roi = totalInvestment > 0 ? (grossProfit / totalInvestment) * 100 : null;
  }
  
  // 销售日期：同一域名卖过多轮时取最早那笔（持有期的终点）。
  const saleDate =
    salesTransactions.length > 0
      ? salesTransactions.reduce((a, b) => (a.date <= b.date ? a : b)).date
      : undefined;

  // 持有期。三处以前都不对：
  //   - new Date('YYYY-MM-DD') 按 UTC 解析，跟本地的 now 相减，负偏移时区差一天
  //   - purchase_date 为空时 new Date('') 是 Invalid Date → holdingPeriod = NaN
  //   - 已卖掉的域名也一直算到**今天**，两年前成交的域名持有期还在天天增长
  // 与 realizedPnL.tradeOutcomes.holdingDays 同口径：买入 → 成交（未卖则到今天）。
  const purchaseMs = (parseLocalCalendarDate(domain.purchase_date) ?? new Date(NaN)).getTime();
  const endMs = saleDate
    ? (parseLocalCalendarDate(saleDate) ?? new Date(NaN)).getTime()
    : Date.now();
  const holdingPeriod =
    Number.isFinite(purchaseMs) && Number.isFinite(endMs) && endMs > purchaseMs
      ? Math.floor((endMs - purchaseMs) / (1000 * 60 * 60 * 24))
      : null;
  
  return {
    domainId: domain.id,
    domainName: domain.domain_name,
    totalInvestment,
    totalSales,
    netRevenue,
    grossProfit,
    roi,
    holdingPeriod,
    status: domain.status,
    saleDate
  };
}

// 格式化百分比
export function formatPercentage(value: number, decimals: number = 2): string {
  return `${value.toFixed(decimals)}%`;
}
