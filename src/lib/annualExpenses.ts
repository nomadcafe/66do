/**
 * 按自然年、按类型拆开的支出表。
 *
 * 用途是报税季那句话：「这一年花了多少、分别是什么、凭证在哪」。现有的
 * YearlyCashflowTable 回答的是**现金流方向**（这一年净流入还是净流出），
 * 它把购入 / 转移 / 平台费 / 营销 / 广告 全揉进一列 otherOutflow —— 拿去给
 * 会计是不够的，对方要按科目看。
 *
 * 口径必须跟月度那张图完全一致，否则又是"同一批数据两个总额"。所以这里不
 * 另起炉灶，用的是同一批 primitive：
 *
 *   购入  有 buy 交易就按交易走，一笔都没有才用域名档案上的 purchase_cost
 *         兜底（判据是「有没有 buy 交易」而不是「当年有没有」——后者会让记在
 *         别的年份的 buy 和 purchase_cost 同时进账，同一次购入算两次）
 *   续费  走 expandRenewalEvents，含域名档案上的存量续费，不含 projected
 *   其余  按交易类型分（transfer / fee / marketing / advertising）
 *
 * renew 交易**不能**再按类型加一遍：它已经在事件流里算过了。这正是
 * NON_RENEW_OUTFLOW_TYPES 存在的理由。annualExpenses.test.ts 里有一条跟
 * computeMonthlyOutflow 逐年对拍，两边漂了就让 CI 失败。
 *
 * 只看支出。收入侧有 Sales by Platform 和 YearlyCashflowTable 的 saleNet。
 */

import { expandRenewalEvents } from './expandRenewalEvents';
import { buyTxsForDomain } from './txIndex';
import { parseLocalCalendarDate } from './localCalendarDate';
import type { DomainWithTags } from '../types/dashboard';
import type { TransactionWithRequiredFields } from '../types/transaction';

/** 支出科目。顺序就是表格里的列序：先取得、再保有、最后运营。 */
export const EXPENSE_CATEGORIES = [
  'purchase',
  'renewal',
  'transfer',
  'fee',
  'marketing',
  'advertising',
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export interface AnnualExpenseRow {
  year: number;
  byCategory: Record<ExpenseCategory, number>;
  total: number;
  /** 这一年计入的支出**交易**笔数。档案续费没有交易行，不计入。 */
  transactionCount: number;
  /**
   * 其中填了凭证链接的笔数。报税时「凭证在哪」就看这个——
   * withReceiptCount < transactionCount 就说明有笔支出还没挂凭证。
   */
  withReceiptCount: number;
  /**
   * 这一年有没有金额来自域名档案而不是交易行（purchase_cost 兜底、档案续费）。
   * 这类金额没有凭证可言，UI 据此说明为什么凭证数对不上笔数。
   */
  hasArchiveDerived: boolean;
}

export interface AnnualExpensesSummary {
  /** 按年份升序 */
  rows: AnnualExpenseRow[];
  totals: { byCategory: Record<ExpenseCategory, number>; total: number };
  grandTransactionCount: number;
  grandWithReceiptCount: number;
}

function emptyByCategory(): Record<ExpenseCategory, number> {
  return {
    purchase: 0, renewal: 0, transfer: 0, fee: 0, marketing: 0, advertising: 0,
  };
}

/** 交易类型 → 支出科目。不是支出的返回 null。renew 刻意不在表里：它走事件流。 */
const CATEGORY_BY_TX_TYPE: Record<string, ExpenseCategory | undefined> = {
  buy: 'purchase',
  transfer: 'transfer',
  fee: 'fee',
  marketing: 'marketing',
  advertising: 'advertising',
};

function hasReceipt(t: TransactionWithRequiredFields): boolean {
  return typeof t.receipt_url === 'string' && t.receipt_url.trim().length > 0;
}

/**
 * @param domains / @param transactions 全量数据。
 * @param until 只统计这个时刻之前的支出；null = 不设上限。默认当下——
 *   未来日期的 projected 续费不该出现在"已经花了多少"里。
 */
export function annualExpenses(
  domains: DomainWithTags[],
  transactions: TransactionWithRequiredFields[],
  until: Date | null = new Date()
): AnnualExpensesSummary {
  const byYear = new Map<number, AnnualExpenseRow>();
  const withinRange = (d: Date) => until === null || d <= until;

  const ensure = (year: number): AnnualExpenseRow => {
    let row = byYear.get(year);
    if (!row) {
      row = {
        year,
        byCategory: emptyByCategory(),
        total: 0,
        transactionCount: 0,
        withReceiptCount: 0,
        hasArchiveDerived: false,
      };
      byYear.set(year, row);
    }
    return row;
  };

  for (const d of domains) {
    // 续费：事件流，含档案续费；projected 是"还没发生"，不计。
    for (const ev of expandRenewalEvents(d, transactions)) {
      if (ev.source === 'projected') continue;
      if (!withinRange(ev.date)) continue;
      const row = ensure(ev.date.getFullYear());
      row.byCategory.renewal += ev.amount;
      // archive 来源没有交易行，因此也没有凭证可挂。
      if (ev.source === 'archive') row.hasArchiveDerived = true;
    }

    // 购入的兜底分支：一笔 buy 交易都没有时才用 purchase_cost。
    // 有 buy 交易的走下面的交易循环，避免同一次购入算两次。
    if (buyTxsForDomain(transactions, d.id).length > 0) continue;
    const cost = Number(d.purchase_cost) || 0;
    if (cost <= 0) continue;
    const pd = parseLocalCalendarDate(d.purchase_date);
    if (!pd || !withinRange(pd)) continue;
    const row = ensure(pd.getFullYear());
    row.byCategory.purchase += cost;
    row.hasArchiveDerived = true;
  }

  for (const t of transactions) {
    const category = CATEGORY_BY_TX_TYPE[t.type];
    if (!category) continue; // sell 是流入；renew 已由事件流承担
    const td = parseLocalCalendarDate(t.date);
    if (!td || !withinRange(td)) continue;
    const row = ensure(td.getFullYear());
    row.byCategory[category] += Number(t.amount) || 0;
    row.transactionCount += 1;
    if (hasReceipt(t)) row.withReceiptCount += 1;
  }

  const rows = [...byYear.values()].sort((a, b) => a.year - b.year);
  for (const row of rows) {
    row.total = EXPENSE_CATEGORIES.reduce((sum, c) => sum + row.byCategory[c], 0);
  }

  const totals = { byCategory: emptyByCategory(), total: 0 };
  for (const row of rows) {
    for (const c of EXPENSE_CATEGORIES) totals.byCategory[c] += row.byCategory[c];
  }
  totals.total = EXPENSE_CATEGORIES.reduce((sum, c) => sum + totals.byCategory[c], 0);

  return {
    rows,
    totals,
    grandTransactionCount: rows.reduce((s, r) => s + r.transactionCount, 0),
    grandWithReceiptCount: rows.reduce((s, r) => s + r.withReceiptCount, 0),
  };
}
