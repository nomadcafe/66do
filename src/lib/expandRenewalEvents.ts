/**
 * Expands a domain's renewal history into a flat list of dated events,
 * for use by time-series charts that want renewal cost spread across the
 * months they actually happened in (or our best estimate thereof) rather
 * than lumped on a single baseline date.
 *
 * Two kinds of events come out:
 *
 *   1. Archive renewals — the count×cost summary on the domain record.
 *      Each one estimated at `purchase_date + i × renewal_cycle (years)`
 *      for i = 1..archiveCount. archiveCount is renewal_count minus the
 *      number of explicit post-baseline renew transactions for this
 *      domain (if a baseline is set), so we never double-count.
 *
 *   2. Explicit renew transactions — used verbatim. When baseline is set,
 *      only the post-baseline ones are emitted; pre-baseline ones (if any
 *      somehow exist) are assumed to be folded into archiveCount and
 *      skipped to avoid double-counting. When no baseline is set, the
 *      cost-basis path in holdingCostAsOf doesn't read transactions at
 *      all, so we mirror that here and trust renewal_count alone.
 *
 * Why not just use holdingCostAsOf deltas like the rest of the chart's
 * Investment line? Because holdingCostAsOf books the entire archive lump
 * on `baseline_renewal_as_of` (which now defaults to "today" for newly
 * added domains). That's correct for bookkeeping but visually wrong on a
 * monthly chart — every freshly-imported domain looks like it had a one-
 * time renewal spike on the day you added it, instead of the actual
 * yearly renewal cadence the user lived through.
 */

import type { TransactionWithRequiredFields } from '../types/transaction';

export interface RenewalEvent {
  date: Date;
  amount: number;
  source: 'archive' | 'transaction';
}

interface DomainLike {
  id: string;
  purchase_date?: string | null;
  renewal_count?: number | null;
  renewal_cycle?: number | null;
  renewal_cost?: number | null;
  baseline_renewal_as_of?: string | null;
}

function parseLocalDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function expandRenewalEvents(
  domain: DomainLike,
  transactions: TransactionWithRequiredFields[],
): RenewalEvent[] {
  const events: RenewalEvent[] = [];
  const purchase = parseLocalDate(domain.purchase_date);
  const renewalCount = Math.max(0, Math.floor(domain.renewal_count ?? 0));
  const cycle = Math.max(1, Math.floor(domain.renewal_cycle ?? 1) || 1);
  const perRenewal = Number(domain.renewal_cost) || 0;

  const baseline = domain.baseline_renewal_as_of
    ? domain.baseline_renewal_as_of.slice(0, 10)
    : null;

  // Count how many post-baseline renew transactions belong to this domain.
  // We treat dates as YYYY-MM-DD lexicographic for the boundary check, matching
  // holdingCostAsOf's behaviour in renewalCostBasis.ts.
  let postBaselineTxCount = 0;
  if (baseline) {
    for (const t of transactions) {
      if (t.domain_id !== domain.id || t.type !== 'renew') continue;
      const d = String(t.date).slice(0, 10);
      if (d.length < 10) continue;
      if (d >= baseline) postBaselineTxCount++;
    }
  }

  // Archive renewals: total count − explicit post-baseline = pre-baseline implicit.
  // (Without baseline, all renewals are "archive" by construction; tx are ignored.)
  const archiveCount = baseline
    ? Math.max(0, renewalCount - postBaselineTxCount)
    : renewalCount;

  if (purchase && archiveCount > 0 && perRenewal > 0) {
    for (let i = 1; i <= archiveCount; i++) {
      const d = new Date(purchase);
      d.setFullYear(d.getFullYear() + i * cycle);
      events.push({ date: d, amount: perRenewal, source: 'archive' });
    }
  }

  // Explicit post-baseline renew transactions.
  // Without baseline, the no-baseline branch of holdingCostAsOf ignores
  // transactions entirely; we mirror that to stay consistent with the cost
  // basis books — otherwise this chart could show more renewal spend than
  // the cost basis ever recorded.
  if (baseline) {
    for (const t of transactions) {
      if (t.domain_id !== domain.id || t.type !== 'renew') continue;
      const d = String(t.date).slice(0, 10);
      if (d.length < 10 || d < baseline) continue;
      const txDate = parseLocalDate(t.date);
      if (!txDate) continue;
      events.push({
        date: txDate,
        amount: Number(t.amount) || 0,
        source: 'transaction',
      });
    }
  }

  return events;
}
