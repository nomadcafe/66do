// import { Domain, DomainTransaction as Transaction } from '../types/domain';
import { DomainWithTags, TransactionWithRequiredFields } from '../types/dashboard';
import { sellGrossUSD, sellNetUSD } from './sellProceeds';
import { totalHoldingCostForDomain } from './renewalCostBasis';

export type { SellProceedsFields } from './sellProceeds';
export { sellGrossUSD, sellNetUSD } from './sellProceeds';

/** 统一以 USD 计价的交易金额（优先 base_amount，用于汇总） */
function amountUSD(t: TransactionWithRequiredFields): number {
  if (t.base_amount != null && t.base_amount !== undefined) return t.base_amount;
  return t.net_amount != null && t.net_amount !== undefined ? t.net_amount : t.amount;
}

// 基础财务计算接口
export interface BasicFinancialMetrics {
  totalInvestment: number;
  /** 累计出售净收入（扣平台费后） */
  totalRevenue: number;
  /** 累计出售毛额（未扣平台费，与 Total Sales 卡片一致） */
  totalGrossSales: number;
  totalProfit: number;
  roi: number;
  profitMargin: number;
}

// 域名表现接口
export interface DomainPerformance {
  domain: DomainWithTags;
  profit: number;
  roi: number;
  totalCost: number;
  revenue: number;
}

// 高级财务指标接口
export interface AdvancedFinancialMetrics extends BasicFinancialMetrics {
  annualizedReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  volatility: number;
  winRate: number;
  avgHoldingPeriod: number;
  bestPerformingDomain: string;
  worstPerformingDomain: string;
}

/**
 * 域名持有成本（仅已发生）：购买成本 + 已续费次数 × 单次续费成本。
 * 不含未来计划续费；若后续需「预估总持有成本」，可基于 next_renewal_date 扩展。
 */
export function calculateDomainHoldingCost(
  purchaseCost: number,
  renewalCost: number,
  renewalCount: number
): number {
  return purchaseCost + (renewalCount * renewalCost);
}

// 计算基础财务指标
export function calculateBasicFinancialMetrics(
  domains: DomainWithTags[],
  transactions: TransactionWithRequiredFields[]
): BasicFinancialMetrics {
  const totalInvestment = domains.reduce(
    (sum, domain) => sum + totalHoldingCostForDomain(domain, transactions),
    0
  );

  const sellTransactions = transactions.filter(t => t.type === 'sell');
  const totalGrossSales = sellTransactions.reduce((sum, t) => sum + sellGrossUSD(t), 0);
  const totalRevenue = sellTransactions.reduce((sum, t) => sum + sellNetUSD(t), 0);

  const totalProfit = totalRevenue - totalInvestment;
  const roi = totalInvestment > 0 ? (totalProfit / totalInvestment) * 100 : 0;
  const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

  return {
    totalInvestment,
    totalRevenue,
    totalGrossSales,
    totalProfit,
    roi,
    profitMargin
  };
}

// 计算域名表现
export function calculateDomainPerformance(
  domains: DomainWithTags[],
  transactions: TransactionWithRequiredFields[]
): DomainPerformance[] {
  return domains.map(domain => {
    const totalCost = totalHoldingCostForDomain(domain, transactions);
    
    const domainTransactions = transactions.filter(t => t.domain_id === domain.id);
    
    const totalEarned = domainTransactions
      .filter(t => t.type === 'sell')
      .reduce((sum, t) => sum + sellNetUSD(t), 0);
    
    const revenue = domain.sale_price || domain.estimated_value || totalEarned;
    const profit = revenue - totalCost;
    const roi = totalCost > 0 ? (profit / totalCost) * 100 : 0;

    return {
      domain,
      profit,
      roi,
      totalCost,
      revenue
    };
  });
}

// 计算年化收益率
export function calculateAnnualizedReturn(
  totalInvestment: number,
  totalRevenue: number,
  years: number
): number {
  if (years <= 0 || totalInvestment <= 0) return 0;
  
  const totalReturn = (totalRevenue - totalInvestment) / totalInvestment;
  return Math.pow(1 + totalReturn, 1 / years) - 1;
}

// 计算投资年限
export function calculateInvestmentYears(domains: DomainWithTags[]): number {
  if (domains.length === 0) return 1;
  
  const oldestDomain = domains.reduce((oldest, domain) => {
    const domainDate = new Date(domain.purchase_date || '');
    const oldestDate = new Date(oldest.purchase_date || '');
    return domainDate < oldestDate ? domain : oldest;
  }, domains[0]);
  
  if (!oldestDomain) return 1;
  
  return (new Date().getTime() - new Date(oldestDomain.purchase_date || '').getTime()) / (1000 * 60 * 60 * 24 * 365);
}

/** 月度收益率（%）：每月出售收入 / 当月累计投资成本 */
export function calculateMonthlyReturns(
  domains: DomainWithTags[],
  transactions: TransactionWithRequiredFields[]
): number[] {
  return Array.from({ length: 12 }, (_, i) => {
    const date = new Date();
    date.setMonth(date.getMonth() - (11 - i));
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    const monthDomains = domains.filter(d => {
      const domainMonth = (d.purchase_date || '').slice(0, 7);
      return domainMonth <= monthKey;
    });
    const investment = monthDomains.reduce(
      (sum, d) => sum + totalHoldingCostForDomain(d, transactions),
      0
    );

    const monthTransactions = transactions.filter(t => {
      const transactionDate = new Date(t.date);
      return transactionDate.getMonth() === date.getMonth() &&
             transactionDate.getFullYear() === date.getFullYear() && t.type === 'sell';
    });
    const revenue = monthTransactions.reduce((sum, t) => sum + sellNetUSD(t), 0);

    if (investment <= 0) return 0;
    return (revenue / investment) * 100;
  });
}

// 计算波动率
export function calculateVolatility(returns: number[]): number {
  if (returns.length === 0) return 0;
  
  const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
  return Math.sqrt(variance);
}

/** 最大回撤（小数）：基于月度收益率序列的累计净值，从高点到低点的最大相对回撤 */
export function calculateMaxDrawdown(returns: number[]): number {
  if (returns.length === 0) return 0;
  let wealth = 1;
  let peak = 1;
  let maxDrawdown = 0;
  for (let i = 0; i < returns.length; i++) {
    wealth *= 1 + returns[i] / 100;
    if (wealth > peak) peak = wealth;
    const drawdown = peak > 0 ? (peak - wealth) / peak : 0;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  }
  return maxDrawdown;
}

/** 夏普比率：年化收益率与年化波动率均为小数（如 0.05, 0.12） */
export function calculateSharpeRatio(
  annualizedReturnDecimal: number,
  riskFreeRate: number = 0.02,
  annualizedVolatilityDecimal: number
): number {
  if (annualizedVolatilityDecimal <= 0) return 0;
  return (annualizedReturnDecimal - riskFreeRate) / annualizedVolatilityDecimal;
}

// 计算胜率
export function calculateWinRate(
  domains: DomainWithTags[],
  transactions: TransactionWithRequiredFields[] = []
): number {
  const soldDomains = domains.filter(d => d.status === 'sold');
  if (soldDomains.length === 0) return 0;
  
  const profitableDomains = soldDomains.filter(d => {
    const totalCost = totalHoldingCostForDomain(d, transactions);
    return (d.sale_price || 0) > totalCost;
  });
  
  return (profitableDomains.length / soldDomains.length) * 100;
}

// 计算平均持有期
export function calculateAvgHoldingPeriod(domains: DomainWithTags[]): number {
  const soldDomains = domains.filter(d => d.status === 'sold');
  if (soldDomains.length === 0) return 0;
  
  const totalDays = soldDomains.reduce((sum, domain) => {
    const purchaseDate = new Date(domain.purchase_date || '');
    const saleDate = new Date(domain.sale_date || domain.purchase_date || '');
    return sum + (saleDate.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24);
  }, 0);
  
  return totalDays / soldDomains.length;
}

// 计算高级财务指标
export function calculateAdvancedFinancialMetrics(
  domains: DomainWithTags[],
  transactions: TransactionWithRequiredFields[]
): AdvancedFinancialMetrics {
  const basicMetrics = calculateBasicFinancialMetrics(domains, transactions);
  const years = calculateInvestmentYears(domains);
  const annualizedReturn = calculateAnnualizedReturn(
    basicMetrics.totalInvestment,
    basicMetrics.totalRevenue,
    years
  );
  
  const monthlyReturnPct = calculateMonthlyReturns(domains, transactions);
  const volMonthlyPct = calculateVolatility(monthlyReturnPct);
  const volAnnualDecimal = (volMonthlyPct / 100) * Math.sqrt(12);
  const maxDrawdown = calculateMaxDrawdown(monthlyReturnPct);
  const sharpeRatio = calculateSharpeRatio(annualizedReturn, 0.02, volAnnualDecimal);
  
  const winRate = calculateWinRate(domains, transactions);
  const avgHoldingPeriod = calculateAvgHoldingPeriod(domains);
  
  const domainPerformance = calculateDomainPerformance(domains, transactions);
  const soldPerformance = domainPerformance.filter(p => p.domain.status === 'sold');
  const fallback = { domain: { domain_name: 'N/A' }, roi: 0 };
  const bestDomain = soldPerformance.length > 0
    ? soldPerformance.reduce((best, current) => (current.roi > best.roi ? current : best), soldPerformance[0])
    : fallback;
  const worstDomain = soldPerformance.length > 0
    ? soldPerformance.reduce((worst, current) => (current.roi < worst.roi ? current : worst), soldPerformance[0])
    : fallback;

  return {
    ...basicMetrics,
    annualizedReturn: annualizedReturn * 100,
    sharpeRatio,
    maxDrawdown: maxDrawdown * 100,
    volatility: volAnnualDecimal * 100,
    winRate,
    avgHoldingPeriod,
    bestPerformingDomain: bestDomain.domain.domain_name,
    worstPerformingDomain: worstDomain.domain.domain_name
  };
}

/** 风险等级：volatility 为年化波动率（小数），maxDrawdown 为小数 */
export function calculateRiskLevel(
  volatilityDecimal: number,
  maxDrawdownDecimal: number
): 'Low' | 'Medium' | 'High' {
  if (volatilityDecimal > 0.3 || maxDrawdownDecimal > 0.5) return 'High';
  if (volatilityDecimal > 0.15 || maxDrawdownDecimal > 0.2) return 'Medium';
  return 'Low';
}

/** 单笔现金到账事件，用于把分期销售按时间维度展开。 */
export interface CashReceiptEvent {
  monthKey: string; // 'YYYY-MM'
  netAmount: number;
}

/** 把一笔 sell 交易展开成实际现金到账的月度事件序列。
 *
 * - 一次性付款 (lump_sum)：原样返回单条 (t.date, sellNetUSD)
 * - 分期 (installment)：
 *   · 首付计入 t.date 当月（downpayment_amount > 0 时）
 *   · 已付期分布在月份上：
 *       - 若 installment_first_payment_date 已填，第 1 期 = 该日，
 *         第 2 期 = +1 月，… 以此类推
 *       - 否则回退到 "t.date + i 个月"（i ∈ [1, paid_periods]）的近似
 *   · 平台费按比例分摊到每条事件，保证 sum(netAmount) === sellNetUSD(t)
 *   · 未付期不展开（还没到账）
 *
 * 用于 Monthly Cash Flow / 累计 Revenue 等"按月"展示，原实现把整笔 sell
 * 都归到 t.date 那一个月，3 个月分期的收入会一起 spike 在销售当月，1-2
 * 月间隔的柱子全是 0。
 */
export function expandSellToCashReceipts(t: TransactionWithRequiredFields): CashReceiptEvent[] {
  if (t.type !== 'sell') return [];
  // monthKey 与 InvestmentAnalytics.timeSeriesData 现有写法对齐：
  // ISO 字符串前 7 位 'YYYY-MM'。两边 key 格式必须一致，否则 map 取不出。
  const monthKeyOf = (d: Date) => d.toISOString().slice(0, 7);
  const txDate = new Date(t.date);
  if (Number.isNaN(txDate.getTime())) return [];

  const isInstallment = t.payment_plan === 'installment';
  if (!isInstallment) {
    return [{ monthKey: monthKeyOf(txDate), netAmount: sellNetUSD(t) }];
  }

  const down = t.downpayment_amount ?? 0;
  const perPeriod = t.installment_amount ?? 0;
  const paidPeriods = t.paid_periods ?? 0;
  const totalGrossPaid = down + paidPeriods * perPeriod;
  if (totalGrossPaid <= 0) {
    // 数据缺失或还没付任何一期：保底回到原口径，避免直接消失
    return [{ monthKey: monthKeyOf(txDate), netAmount: sellNetUSD(t) }];
  }

  // 已付总额对应的净额（transactionsForMetrics 已按比例缩放过 net_amount）
  const totalNetPaid = sellNetUSD(t);
  const feeRate = totalGrossPaid > 0 ? 1 - totalNetPaid / totalGrossPaid : 0;
  const events: CashReceiptEvent[] = [];

  if (down > 0) {
    events.push({
      monthKey: monthKeyOf(txDate),
      netAmount: down * (1 - feeRate),
    });
  }

  // 第一期付款日：优先用 installment_first_payment_date，没填回退到 t.date + 1 月
  let firstPayment: Date | null = null;
  if (t.installment_first_payment_date) {
    const d = new Date(t.installment_first_payment_date);
    if (!Number.isNaN(d.getTime())) firstPayment = d;
  }
  if (!firstPayment) {
    firstPayment = new Date(txDate);
    firstPayment.setMonth(firstPayment.getMonth() + 1);
  }

  for (let i = 0; i < paidPeriods; i++) {
    const d = new Date(firstPayment);
    d.setMonth(d.getMonth() + i);
    events.push({
      monthKey: monthKeyOf(d),
      netAmount: perPeriod * (1 - feeRate),
    });
  }
  return events;
}

/** 按自然年汇总：续费支出、其他流出（购入/费用/转移/营销等）、售出净收入与年度净现金流 */
export interface YearlyRenewalProfitRow {
  year: number;
  renewalSpend: number;
  otherOutflow: number;
  saleNet: number;
  /** 售出净收入 − 续费 − 其他流出 */
  netCashflow: number;
  /** 续费 / (续费 + 其他流出)，0–100 */
  renewalShareOfOutflowsPercent: number;
  /** 续费 / 售出净收入；无售出时为 null */
  renewalToSalePercent: number | null;
}

const OUTFLOW_TYPES: TransactionWithRequiredFields['type'][] = [
  'buy',
  'fee',
  'transfer',
  'marketing',
  'advertising',
];

function txCalendarYear(t: TransactionWithRequiredFields): number {
  const y = new Date(t.date).getFullYear();
  return Number.isFinite(y) ? y : NaN;
}

function calendarYearFromIso(dateStr: string | null | undefined, fallback: number): number {
  if (dateStr == null || dateStr === '') return fallback;
  const y = new Date(dateStr).getFullYear();
  return Number.isFinite(y) ? y : fallback;
}

/**
 * 按自然年汇总续费、购入类流出与售出净收入。
 * - 优先使用交易记录（renew / buy / sell 等）。
 * - 若某域名在购入年无任何 buy 交易，则将档案中的 purchase_cost 计入该年「购入与费用」。
 * - 若某次续费年份无 renew 交易，则按 renewal_count、renewal_cost、renewal_cycle 从购入日起推算并计入续费（避免与已有 renew 同年重复）。
 */
export function calculateYearlyRenewalVsProfit(
  transactions: TransactionWithRequiredFields[],
  domains: DomainWithTags[],
  referenceDate: Date = new Date()
): YearlyRenewalProfitRow[] {
  const refYear = referenceDate.getFullYear();

  const byYear = new Map<
    number,
    { renewalSpend: number; otherOutflow: number; saleNet: number }
  >();

  const ensureYear = (y: number) => {
    if (!byYear.has(y)) {
      byYear.set(y, { renewalSpend: 0, otherOutflow: 0, saleNet: 0 });
    }
    return byYear.get(y)!;
  };

  for (const t of transactions) {
    const y = txCalendarYear(t);
    if (!Number.isFinite(y)) continue;

    const row = ensureYear(y);
    const amt = amountUSD(t);

    if (t.type === 'sell') {
      row.saleNet += amt;
    } else if (t.type === 'renew') {
      const dom = domains.find((d) => d.id === t.domain_id);
      const bk = dom?.baseline_renewal_as_of
        ? String(dom.baseline_renewal_as_of).slice(0, 10)
        : null;
      const td = String(t.date).slice(0, 10);
      if (bk && td.length >= 10 && td < bk) {
        // 基线日之前的 renew 视为已反映在 renewal_count×renewal_cost 中，避免按年与增量双算
      } else {
        row.renewalSpend += amt;
      }
    } else if (OUTFLOW_TYPES.includes(t.type)) {
      row.otherOutflow += amt;
    }
  }

  const renewByDomainYear = new Set<string>();
  for (const t of transactions) {
    if (t.type !== 'renew') continue;
    const y = txCalendarYear(t);
    if (!Number.isFinite(y)) continue;
    renewByDomainYear.add(`${t.domain_id}-${y}`);
  }

  for (const d of domains) {
    if (d.baseline_renewal_as_of) {
      // 已启用续费基线：不按 renewal_count 推算按年续费，仅依赖交易中的 renew
      continue;
    }

    const purchaseY = calendarYearFromIso(d.purchase_date, refYear);
    if (!Number.isFinite(purchaseY)) continue;

    let endY = refYear;
    if (d.status === 'sold' && d.sale_date) {
      endY = calendarYearFromIso(d.sale_date, refYear);
    }

    const buyInPurchaseYear = transactions
      .filter(
        (t) =>
          t.domain_id === d.id &&
          t.type === 'buy' &&
          txCalendarYear(t) === purchaseY
      )
      .reduce((sum, t) => sum + amountUSD(t), 0);

    if (buyInPurchaseYear === 0 && (d.purchase_cost || 0) > 0) {
      ensureYear(purchaseY).otherOutflow += d.purchase_cost || 0;
    }

    const unitRenew = d.renewal_cost || 0;
    const nRenewals = Math.max(0, d.renewal_count ?? 0);
    const cycleYears = Math.max(1, Math.floor(d.renewal_cycle || 1));

    let y = purchaseY;
    for (let i = 0; i < nRenewals; i++) {
      y += cycleYears;
      if (y > endY) break;
      if (renewByDomainYear.has(`${d.id}-${y}`)) continue;
      ensureYear(y).renewalSpend += unitRenew;
    }
  }

  const years = [...byYear.keys()].sort((a, b) => a - b);

  return years
    .map((year) => {
      const { renewalSpend, otherOutflow, saleNet } = byYear.get(year)!;
      const totalOut = renewalSpend + otherOutflow;
      const netCashflow = saleNet - totalOut;
      const renewalShareOfOutflowsPercent =
        totalOut > 0 ? (renewalSpend / totalOut) * 100 : 0;
      const renewalToSalePercent =
        saleNet > 0 ? (renewalSpend / saleNet) * 100 : null;

      return {
        year,
        renewalSpend,
        otherOutflow,
        saleNet,
        netCashflow,
        renewalShareOfOutflowsPercent,
        renewalToSalePercent,
      };
    })
    .filter(
      (r) =>
        r.renewalSpend > 0 || r.otherOutflow > 0 || r.saleNet > 0
    );
}

// 计算成功率
export function calculateSuccessRate(domains: DomainWithTags[]): number {
  const soldDomains = domains.filter(d => d.status === 'sold');
  return domains.length > 0 ? (soldDomains.length / domains.length) * 100 : 0;
}
