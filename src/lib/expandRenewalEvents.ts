/**
 * Expands a domain's renewal history into a flat list of dated events,
 * for use by time-series charts that want renewal cost spread across the
 * months they actually happened in (or our best estimate thereof) rather
 * than lumped on a single baseline date.
 *
 * Estimation strategy for archive renewals (count × cost summarised on
 * the domain record, no individual transaction rows):
 *
 *   - If we have current expiry_date, walk BACKWARDS from there, by
 *     (post-baseline tx years) + (archiveCount − i + 1) × cycle years.
 *     Each renew adds `cycle` years to expiry, so this reconstructs each
 *     archive renewal's date from the latest known expiry. Handles the
 *     "bought in Jan, expires in Feb" case correctly: a 2022-01 purchase
 *     with current expiry 2025-02 and 3 archive renewals lands at
 *     2022-02 / 2023-02 / 2024-02 — not 2023-01 / 2024-01 / 2025-01,
 *     which is what a naive `purchase + i × cycle` would say (and what
 *     this function used to do).
 *
 *   - Without expiry_date we fall back to `purchase + i × cycle`, which
 *     implicitly assumes the initial registration term equalled one
 *     cycle. That's the typical default-1yr .com case but wrong when
 *     the user bought a domain mid-term or registered for fewer/more
 *     years up front. There's no way to recover the truth without
 *     more data — fill expiry_date for accuracy.
 *
 * archiveCount = renewal_count − count of post-baseline renew transactions,
 * so we never double-count when a domain has both archive history and
 * explicit transactions.
 *
 * Without baseline, holdingCostAsOf reads only renewal_count and ignores
 * renew transactions; we mirror that here so cost basis and chart never
 * disagree on the *total* renewal spend.
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
  expiry_date?: string | null;
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
  const expiry = parseLocalDate(domain.expiry_date);
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
  let postBaselineTotalYears = 0;
  if (baseline) {
    for (const t of transactions) {
      if (t.domain_id !== domain.id || t.type !== 'renew') continue;
      const d = String(t.date).slice(0, 10);
      if (d.length < 10) continue;
      if (d >= baseline) {
        postBaselineTxCount++;
        // tx.renewal_period_years is the years that tx added to expiry.
        // Falls back to domain.renewal_cycle if missing/null.
        postBaselineTotalYears += Math.max(1, Math.floor(t.renewal_period_years ?? cycle) || cycle);
      }
    }
  }

  // Archive renewals: total count − explicit post-baseline = pre-baseline implicit.
  // (Without baseline, all renewals are "archive" by construction; tx are ignored.)
  const archiveCount = baseline
    ? Math.max(0, renewalCount - postBaselineTxCount)
    : renewalCount;

  if (archiveCount > 0 && perRenewal > 0) {
    if (expiry) {
      // Preferred: walk backwards from current expiry. Each archive renewal i
      // (i=1..archiveCount) happened at `original_expiry + (i-1) × cycle`,
      // which equals `current_expiry − postBaselineTotalYears − (archiveCount − i + 1) × cycle`.
      for (let i = 1; i <= archiveCount; i++) {
        const d = new Date(expiry);
        const yearsBack = postBaselineTotalYears + (archiveCount - i + 1) * cycle;
        d.setFullYear(d.getFullYear() - yearsBack);
        events.push({ date: d, amount: perRenewal, source: 'archive' });
      }
    } else if (purchase) {
      // Fallback when expiry_date is missing: assume initial registration
      // covered one cycle, so first renewal happens at purchase + cycle.
      for (let i = 1; i <= archiveCount; i++) {
        const d = new Date(purchase);
        d.setFullYear(d.getFullYear() + i * cycle);
        events.push({ date: d, amount: perRenewal, source: 'archive' });
      }
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
