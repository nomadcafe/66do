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
import { renewTxsForDomain, transferTxsForDomain } from './txIndex';
import { archiveRenewalCount } from './renewalCostBasis';

export type RenewalEventSource = 'archive' | 'transaction' | 'projected';

export interface RenewalEvent {
  date: Date;
  amount: number;
  /** Number of years this renewal extends the registration. Used for
   *  amortization across calendar years on the dashboard YTD tile. */
  years: number;
  source: RenewalEventSource;
}

interface DomainLike {
  id: string;
  status?: string | null;
  purchase_date?: string | null;
  expiry_date?: string | null;
  renewal_count?: number | null;
  renewal_cycle?: number | null;
  renewal_cost?: number | null;
  baseline_renewal_as_of?: string | null;
}

export interface ExpandRenewalEventsOptions {
  /** When set, also emit forecasted renewals for still-active / for-sale
   *  domains, starting at current expiry_date and stepping by `cycle` years
   *  until > forecastUntil. Sold or expired domains never get projections.
   *  Without expiry_date, no projection is possible (we have no anchor). */
  forecastUntil?: Date;
}

function parseLocalDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function expandRenewalEvents(
  domain: DomainLike,
  transactions: TransactionWithRequiredFields[],
  options?: ExpandRenewalEventsOptions,
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

  // Total years the post-baseline renew transactions added to expiry — the
  // backwards walk below needs it. Their *count* comes from archiveRenewalCount,
  // which renewalCostBasis owns so the chart and the cost basis can't drift.
  // Dates are compared as YYYY-MM-DD lexicographically, matching that module.
  let postBaselineTotalYears = 0;
  if (baseline) {
    // 走索引：这个函数按域名循环调用，全扫交易就是 O(域名 × 交易)
    for (const t of renewTxsForDomain(transactions, domain.id)) {
      const d = String(t.date).slice(0, 10);
      if (d.length < 10) continue;
      if (d >= baseline) {
        // tx.renewal_period_years is the years that tx added to expiry.
        // Falls back to domain.renewal_cycle if missing/null.
        postBaselineTotalYears += Math.max(1, Math.floor(t.renewal_period_years ?? cycle) || cycle);
      }
    }
  }

  // Registrar transfers can also push expiry out (a transfer-in usually adds a
  // year). Those years sit on top of expiry_date just like renewals do, so the
  // backwards walk below has to discount them too — otherwise every archive
  // renewal gets dated `transferYears` too late.
  let transferTotalYears = 0;
  for (const t of transferTxsForDomain(transactions, domain.id)) {
    const y = Math.floor(Number(t.renewal_period_years) || 0);
    if (y > 0) transferTotalYears += y;
  }

  // Archive renewals: total count − explicit post-baseline = pre-baseline implicit.
  // (Without baseline, all renewals are "archive" by construction; tx are ignored.)
  const archiveCount = archiveRenewalCount(
    {
      id: domain.id,
      renewal_count: renewalCount,
      renewal_cost: domain.renewal_cost,
      baseline_renewal_as_of: domain.baseline_renewal_as_of,
    },
    transactions
  );

  if (archiveCount > 0 && perRenewal > 0) {
    if (expiry) {
      // Preferred: walk backwards from current expiry. Each archive renewal i
      // (i=1..archiveCount) happened at `original_expiry + (i-1) × cycle`,
      // which equals `current_expiry − postBaselineTotalYears − (archiveCount − i + 1) × cycle`.
      for (let i = 1; i <= archiveCount; i++) {
        const d = new Date(expiry);
        const yearsBack =
          postBaselineTotalYears + transferTotalYears + (archiveCount - i + 1) * cycle;
        d.setFullYear(d.getFullYear() - yearsBack);
        events.push({ date: d, amount: perRenewal, years: cycle, source: 'archive' });
      }
    } else if (purchase) {
      // Fallback when expiry_date is missing: assume initial registration
      // covered one cycle, so first renewal happens at purchase + cycle.
      for (let i = 1; i <= archiveCount; i++) {
        const d = new Date(purchase);
        d.setFullYear(d.getFullYear() + i * cycle);
        events.push({ date: d, amount: perRenewal, years: cycle, source: 'archive' });
      }
    }
  }

  // Explicit post-baseline renew transactions.
  // Without baseline, the no-baseline branch of holdingCostAsOf ignores
  // transactions entirely; we mirror that to stay consistent with the cost
  // basis books — otherwise this chart could show more renewal spend than
  // the cost basis ever recorded.
  if (baseline) {
    for (const t of renewTxsForDomain(transactions, domain.id)) {
      const d = String(t.date).slice(0, 10);
      if (d.length < 10 || d < baseline) continue;
      const txDate = parseLocalDate(t.date);
      if (!txDate) continue;
      const txYears = Math.max(1, Math.floor(t.renewal_period_years ?? cycle) || cycle);
      events.push({
        date: txDate,
        amount: Number(t.amount) || 0,
        years: txYears,
        source: 'transaction',
      });
    }
  }

  // Forecasted future renewals.
  // Only for active / for_sale domains (sold and expired ones aren't being kept
  // alive). Anchor is current expiry: the next renewal happens AT expiry, the
  // one after at expiry + cycle, etc. Step forward until past forecastUntil.
  // Without expiry_date there's no anchor, so we don't try to forecast.
  if (options?.forecastUntil && expiry && perRenewal > 0) {
    const status = domain.status ?? 'active';
    if (status === 'active' || status === 'for_sale') {
      const horizonMs = options.forecastUntil.getTime();
      // Bump forward step by step from expiry. Cap iterations as a defensive
      // measure against pathological cycle/horizon combos.
      const next = new Date(expiry);
      let safety = 100;
      while (next.getTime() <= horizonMs && safety-- > 0) {
        events.push({
          date: new Date(next),
          amount: perRenewal,
          years: cycle,
          source: 'projected',
        });
        next.setFullYear(next.getFullYear() + cycle);
      }
    }
  }

  return events;
}
