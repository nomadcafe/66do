import type { DomainWithTags, TransactionWithRequiredFields } from '../types/dashboard';
import { parseLocalCalendarDate } from './localCalendarDate';

/** 一个域名当下"还在分期收款"的状态摘要：付了几期 / 共几期 / 下一期预期到账日。
 *  paid 用 receipts.length（含负数 receipt — 退款也算一行，避免预期日永远撞墙）。
 *  下一期日：
 *    - 有 receipts → 最后一笔 received_date + 1 个月
 *    - 无 receipts → installment_first_payment_date（如果填了）
 *    - 都没有 → null（不参与"本周到期"提醒，避免误报） */
export interface ActiveInstallmentSummary {
  domain: DomainWithTags;
  /** 那笔分期 sell 交易（master plan 行）。 */
  transaction: TransactionWithRequiredFields;
  paid: number;
  total: number;
  nextDue: Date | null;
}

function nextDueDate(t: TransactionWithRequiredFields): Date | null {
  const receipts = t.receipts ?? [];
  if (receipts.length > 0) {
    const sorted = [...receipts].sort((a, b) => a.received_date.localeCompare(b.received_date));
    const last = sorted[sorted.length - 1];
    const d = parseLocalCalendarDate(last.received_date);
    if (!d) return null;
    d.setMonth(d.getMonth() + 1);
    return d;
  }
  if (t.installment_first_payment_date) {
    const d = parseLocalCalendarDate(t.installment_first_payment_date);
    if (d) return d;
  }
  return null;
}

/** 找域名当下"还活着"的分期 sell。同一域名理论上同一时段只该有一条 active
 *  installment sell（中断后状态置 cancelled / completed）。多于一条时取最新的。 */
export function getActiveInstallmentSummary(
  domain: DomainWithTags,
  transactions: TransactionWithRequiredFields[]
): ActiveInstallmentSummary | null {
  const candidates = transactions
    .filter(
      (t) =>
        t.domain_id === domain.id &&
        t.type === 'sell' &&
        t.payment_plan === 'installment' &&
        t.installment_status !== 'cancelled' &&
        t.installment_status !== 'completed'
    )
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const tx = candidates[0];
  if (!tx) return null;
  const total = tx.installment_period ?? 0;
  const paid = tx.receipts?.length ?? 0;
  if (total > 0 && paid >= total) return null; // 已收满，UI 上其实应该被切到 completed
  return { domain, transaction: tx, paid, total, nextDue: nextDueDate(tx) };
}

/** 全表扫一遍，返回所有在 [now-graceDays, now+windowDays] 之间到期的分期收款。
 *  graceDays（默认 3 天）覆盖"前两天没来得及记的逾期"——也是"本周该做"语义。 */
export function getReceiptsDueSoon(
  domains: DomainWithTags[],
  transactions: TransactionWithRequiredFields[],
  now: Date = new Date(),
  windowDays = 7,
  graceDays = 3
): ActiveInstallmentSummary[] {
  const winStart = new Date(now);
  winStart.setDate(winStart.getDate() - graceDays);
  winStart.setHours(0, 0, 0, 0);
  const winEnd = new Date(now);
  winEnd.setDate(winEnd.getDate() + windowDays);
  winEnd.setHours(23, 59, 59, 999);

  const results: ActiveInstallmentSummary[] = [];
  for (const d of domains) {
    const summary = getActiveInstallmentSummary(d, transactions);
    if (!summary || !summary.nextDue) continue;
    const t = summary.nextDue.getTime();
    if (t < winStart.getTime() || t > winEnd.getTime()) continue;
    results.push(summary);
  }
  // 最近到期的排前面，逾期最严重的更靠上
  results.sort((a, b) => (a.nextDue!.getTime() - b.nextDue!.getTime()));
  return results;
}
