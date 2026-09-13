// import { Domain, DomainTransaction as Transaction } from '../types/domain';
import { DomainWithTags, TransactionWithRequiredFields } from '../types/dashboard';
import { sellGrossUSD, sellNetUSD } from './sellProceeds';
import { totalHoldingCostForDomain } from './renewalCostBasis';
import { expandRenewalEvents } from './expandRenewalEvents';
import { buyTxsForDomain } from './txIndex';
import { NON_RENEW_OUTFLOW_TYPES } from './transactionTypeGroups';
import { calendarYearOf, localMonthKey, parseLocalCalendarDate } from './localCalendarDate';

export type { SellProceedsFields } from './sellProceeds';
export { sellGrossUSD, sellNetUSD } from './sellProceeds';

/** 年度汇总里「流出类」交易的 USD 金额。sell 不走这里——它按到账事件展开，
 *  见 calculateYearlyRenewalVsProfit 里的 expandSellToCashReceipts。 */
function outflowAmountUSD(t: TransactionWithRequiredFields): number {
  return t.amount;
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
 *   · 每条 installment_receipts 行 → 一条事件，月份取 r.received_date
 *   · 平台费按 tx 自身的 fee/gross 比例分摊到每条事件
 *   · receipt.amount 可为负数（退款 / 中断分期）→ 当月 netAmount 为负
 *   · 没有任何 receipt 也没有 downpayment 时，保底返回单条 (t.date, sellNetUSD)，
 *     避免数据缺失场景下分期 sell 在报表中直接消失。
 */
export function expandSellToCashReceipts(t: TransactionWithRequiredFields): CashReceiptEvent[] {
  if (t.type !== 'sell') return [];
  // monthKey 与 InvestmentAnalytics.timeSeriesData 现有写法对齐：'YYYY-MM'。
  // 两边 key 格式必须一致，否则 map 取不出。日期列按本地日历日解析 + 本地
  // 取月，两步必须成对——只改一边会在正/负偏移时区各错一个月。
  const monthKeyOf = localMonthKey;
  const txDate = parseLocalCalendarDate(t.date);
  if (!txDate) return [];

  const isInstallment = t.payment_plan === 'installment';
  if (!isInstallment) {
    return [{ monthKey: monthKeyOf(txDate), netAmount: sellNetUSD(t) }];
  }

  const down = t.downpayment_amount ?? 0;
  const receipts = t.receipts ?? [];
  const totalReceiptAmount = receipts.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const totalGrossPaid = down + totalReceiptAmount;
  if (totalGrossPaid <= 0) {
    // 没有 receipts 也没有 downpayment：保底回到原口径，避免直接消失。
    // 也覆盖了"加载顺序问题导致 receipts 暂时为 undefined"的边界情况。
    return [{ monthKey: monthKeyOf(txDate), netAmount: sellNetUSD(t) }];
  }

  // feeRate 直接从 tx 自身算（自洽）：fee/gross 比例与 transactionsForMetrics
  // 是否缩放都无关 —— 缩放时 fee 和 gross 都按同比例缩，比例不变；不缩放
  // 时也是 tx 上的真实比例。
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

  for (const r of receipts) {
    const d = parseLocalCalendarDate(r.received_date);
    if (!d) continue;
    events.push({
      monthKey: monthKeyOf(d),
      netAmount: Number(r.amount) * (1 - feeRate),
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

function txCalendarYear(t: TransactionWithRequiredFields): number {
  return calendarYearOf(t.date);
}

function calendarYearFromIso(dateStr: string | null | undefined, fallback: number): number {
  if (dateStr == null || dateStr === '') return fallback;
  const y = calendarYearOf(dateStr);
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

    if (t.type === 'sell') {
      // 分期销售按**实际到账**的年份归集，而不是整笔压在成交年。
      // 一笔 2025-11 成交、分 24 期收的销售，钱是从 2025-12 起一个月一笔
      // 进来的；以前 saleNet 走 sellNetUSD(t) + 交易自身日期，于是 2025 虚高
      // 一整笔、2026 之后明明在收钱却显示 0。月度净现金流图和 realizedPnL
      // 早就走 expandSellToCashReceipts 了，这张年表是唯一一个没接上的，
      // 结果同一批数据两处对不上。
      //
      // 一次性付款 / 没有任何 receipt 也没有首付的分期，展开器都会回落成
      // 单条 (t.date, sellNetUSD)，行为与改动前一致。
      for (const ev of expandSellToCashReceipts(t)) {
        const evYear = Number(ev.monthKey.slice(0, 4));
        if (!Number.isFinite(evYear)) continue;
        ensureYear(evYear).saleNet += ev.netAmount;
      }
      continue;
    } else if (t.type === 'renew') {
      // renew 交易由下面的 expandRenewalEvents 走全量统计；这里跳过，
      // 不在此循环里直接累加，避免与事件流重复。
      continue;
    } else if (NON_RENEW_OUTFLOW_TYPES.includes(t.type)) {
      ensureYear(y).otherOutflow += outflowAmountUSD(t);
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

    // 购入：一笔 buy 交易都没有时才用档案 purchase_cost 兜底，落到购入年。
    // 判断依据是「有没有 buy 交易」而不是「购入年有没有 buy 交易」——后者会让
    // 一笔记在别的年份的 buy 交易和 purchase_cost 同时进账，同一次购入算两次。
    // 与 acquisitionCostForDomain 同口径。
    const purchaseY = calendarYearFromIso(d.purchase_date, refYear);
    if (!Number.isFinite(purchaseY)) continue;

    // 走索引而不是全扫：这在按域名的循环里，全扫就是 O(域名 × 交易)
    const hasBuyTx = buyTxsForDomain(transactions, d.id).length > 0;

    if (!hasBuyTx && (d.purchase_cost || 0) > 0) {
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

