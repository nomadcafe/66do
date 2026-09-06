/**
 * 按月的现金流出，全站唯一口径。
 *
 * 起因和 transactionTypeGroups 一样，只是换个粒度：Performance 板块里，
 * 「购入」曾经有三套口径同屏——Total Investment KPI 走 acquisitionCostForDomain
 * （有 buy 交易用交易、否则 purchase_cost），投资趋势图永远只读 purchase_cost、
 * 完全无视 buy 交易，月度净现金流图反过来只认 buy 交易。「续费」也有两套：
 * 趋势图走事件流（含档案续费），现金流图只认 renew 交易。用交易记账而
 * purchase_cost 留 0 的域名，KPI 有钱、趋势线是 0；只用 renewal_count 记账的
 * 域名，趋势线有续费、现金流图那个月却没有任何流出。
 *
 * 这里按 calculateYearlyRenewalVsProfit 的同一套规则做月粒度聚合，两者由
 * monthlyOutflow.test.ts 对拍，保证年表和月图不会再各说各话。
 */

import type { DomainWithTags } from '../types/dashboard';
import type { TransactionWithRequiredFields } from '../types/transaction';
import { expandRenewalEvents } from './expandRenewalEvents';
import { NON_RENEW_OUTFLOW_TYPES } from './transactionTypeGroups';
import { buyTxsForDomain } from './txIndex';
import { localMonthKey, parseLocalCalendarDate } from './localCalendarDate';

export interface MonthlyOutflow {
  /** 购入：有 buy 交易按交易月落账，一笔都没有才用 purchase_cost 兜底到购入月 */
  purchaseByMonth: Map<string, number>;
  /** 续费：expandRenewalEvents 的 archive + transaction 两类，不含 projected */
  renewalByMonth: Map<string, number>;
  /** 其余流出：转移、平台费、营销、广告（buy 和 renew 已由上面两项承担） */
  otherByMonth: Map<string, number>;
}

function add(map: Map<string, number>, key: string, amount: number): void {
  map.set(key, (map.get(key) ?? 0) + amount);
}

/**
 * @param until 只统计这个时刻之前的流出。图表只画 ≤ now 的月份，未来的
 *   projected/误录事件不该进桶。传 null 表示不设上限。
 */
export function computeMonthlyOutflow(
  domains: DomainWithTags[],
  transactions: TransactionWithRequiredFields[],
  until: Date | null = new Date()
): MonthlyOutflow {
  const purchaseByMonth = new Map<string, number>();
  const renewalByMonth = new Map<string, number>();
  const otherByMonth = new Map<string, number>();
  const withinRange = (d: Date) => until === null || d <= until;

  for (const d of domains) {
    // 续费走事件流：archive 与显式 renew tx 在事件流内部已经去重
    // （archiveCount = renewal_count − 已知金额的 renew tx 条数），不会重复。
    for (const ev of expandRenewalEvents(d, transactions)) {
      if (ev.source === 'projected') continue;
      if (!withinRange(ev.date)) continue;
      add(renewalByMonth, localMonthKey(ev.date), ev.amount);
    }

    // 购入：判据是「有没有 buy 交易」而不是「购入月有没有」——后者会让一笔记
    // 在别的月份的 buy 交易和 purchase_cost 同时进账，同一次购入算两次。
    // 与 acquisitionCostForDomain / calculateYearlyRenewalVsProfit 同口径。
    const buys = buyTxsForDomain(transactions, d.id);
    if (buys.length > 0) {
      for (const t of buys) {
        const td = parseLocalCalendarDate(t.date);
        if (!td || !withinRange(td)) continue;
        add(purchaseByMonth, localMonthKey(td), Number(t.amount) || 0);
      }
      continue;
    }
    const pd = parseLocalCalendarDate(d.purchase_date);
    if (!pd || !withinRange(pd)) continue;
    add(purchaseByMonth, localMonthKey(pd), Number(d.purchase_cost) || 0);
  }

  // renew 必须排除：续费已由事件流承担，按交易类型再加一次就是双算——
  // NON_RENEW_OUTFLOW_TYPES 就是为这个存在的。buy 由上面的 canonical 口径承担。
  for (const t of transactions) {
    if (t.type === 'buy') continue;
    if (!NON_RENEW_OUTFLOW_TYPES.includes(t.type)) continue;
    const td = parseLocalCalendarDate(t.date);
    if (!td || !withinRange(td)) continue;
    add(otherByMonth, localMonthKey(td), Number(t.amount) || 0);
  }

  return { purchaseByMonth, renewalByMonth, otherByMonth };
}
