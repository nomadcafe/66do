// import { Domain, DomainTransaction as Transaction } from '../types/domain';
import { DomainWithTags, TransactionWithRequiredFields } from '../types/dashboard';
import { sellGrossUSD, sellNetUSD } from './sellProceeds';
import { totalHoldingCostForDomain } from './renewalCostBasis';
import { expandRenewalEvents } from './expandRenewalEvents';

export type { SellProceedsFields } from './sellProceeds';
export { sellGrossUSD, sellNetUSD } from './sellProceeds';

/** 年度汇总用的 USD 金额：sell 走 sellNetUSD（与 saleNet 字段语义一致），其他类型走 amount */
function amountUSD(t: TransactionWithRequiredFields): number {
  return t.type === 'sell' ? sellNetUSD(t) : t.amount;
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

// 高级财务指标接口。annualizedReturn / sharpeRatio 都砍了——域名销售样本
// 稀疏 + cost basis 偶见极小（免费/$1 抢注），让指数年化和波动率两个数学
// 体系都失效。同文件原本就因为这个理由刻意没引入 max-drawdown / volatility。
// 长期收益由 Performance hero 上的 lifetime Net Profit / Realized ROI 表达。
export interface AdvancedFinancialMetrics {
  avgHoldingPeriod: number;
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

// 高级财务指标。Sharpe / 年化都已经搬走或砍掉，目前只剩 avgHoldingPeriod。
// 暂时保留 basic 参数和 transactions 参数让函数签名稳定（其他 hook 调用点），
// 未来可考虑 inline 到 useComprehensiveFinancialAnalysis 简化。
export function calculateAdvancedFinancialMetrics(
  domains: DomainWithTags[],
  _transactions: TransactionWithRequiredFields[],
  _basic: BasicFinancialMetrics
): AdvancedFinancialMetrics {
  return {
    avgHoldingPeriod: calculateAvgHoldingPeriod(domains),
  };
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

  // feeRate 直接从 tx 自身算（自洽）：fee/gross 比例与 transactionsForMetrics
  // 是否缩放都无关 —— 缩放时 fee 和 gross 都按同比例缩，比例不变；不缩放
  // 时也是 tx 上的真实比例。
  // 旧公式 1 - sellNetUSD/totalGrossPaid 的隐含假设是"二者尺度一致"，在
  // 部分付清但 transactionsForMetrics 因数据缺失没缩放（hasInstallmentData
  // = false）的边界 case 上会失败：分母是 partial gross，分子是 full net，
  // feeRate 算出来可能是负数甚至 > 1。
  const grossOnTx = sellGrossUSD(t);
  const fee = Math.max(0, grossOnTx - sellNetUSD(t));
  const feeRate = grossOnTx > 0 ? fee / grossOnTx : 0;
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
 *
 * 续费走 expandRenewalEvents（archive + transaction 两类，不含 projected）：
 * 与 Portfolio Performance 紫线、YTD tile、Annual Outlook 共享同一事件流。
 * archiveCount 在事件流内部已经做了 `renewal_count − postBaselineTxCount`
 * 的去重，所以 archive 与显式 renew tx 不会重复计入。
 *
 * buy / fee / 等流出仍然按交易日落到自然年；某域名的购入年若无 buy 交易，
 * 用档案上的 purchase_cost 兜底到 otherOutflow。
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
      // renew 交易由下面的 expandRenewalEvents 走全量统计；这里跳过，
      // 不在此循环里直接累加，避免与事件流重复。
      continue;
    } else if (OUTFLOW_TYPES.includes(t.type)) {
      row.otherOutflow += amt;
    }
  }

  for (const d of domains) {
    // 续费：走事件流，archive + 显式 renew tx 全归这里
    for (const ev of expandRenewalEvents(d, transactions)) {
      if (ev.source === 'projected') continue;
      const y = ev.date.getFullYear();
      if (!Number.isFinite(y)) continue;
      ensureYear(y).renewalSpend += ev.amount;
    }

    // 购入：本年没 buy tx 时用档案 purchase_cost 兜底
    const purchaseY = calendarYearFromIso(d.purchase_date, refYear);
    if (!Number.isFinite(purchaseY)) continue;

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

