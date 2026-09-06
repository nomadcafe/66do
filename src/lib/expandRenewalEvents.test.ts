import { describe, it, expect } from 'vitest';
import { expandRenewalEvents } from './expandRenewalEvents';
import type { TransactionWithRequiredFields } from '../types/transaction';
import { localCalendarDateISO } from './localCalendarDate';

// Convenience for building a minimally-typed renew transaction in tests.
function tx(domainId: string, date: string, amount: number): TransactionWithRequiredFields {
  return {
    id: `tx-${domainId}-${date}`,
    domain_id: domainId,
    type: 'renew',
    amount,
    currency: 'USD',
    date,
    created_at: '',
    updated_at: '',
  };
}

describe('expandRenewalEvents', () => {
  it("user's canonical case (no expiry_date): 2022 purchase, 3 archive renewals → fallback to purchase + i × cycle", () => {
    // Without expiry_date, the function can only assume initial registration =
    // one cycle, so first renewal lands at purchase + cycle. This is the rough
    // fallback path; the more accurate one (with expiry_date) is below.
    const events = expandRenewalEvents({
      id: 'd1',
      purchase_date: '2022-01-15',
      renewal_count: 3,
      renewal_cycle: 1,
      renewal_cost: 10,
      baseline_renewal_as_of: '2026-04-28',
    }, []);
    expect(events).toHaveLength(3);
    expect(events.map(e => localCalendarDateISO(e.date))).toEqual([
      '2023-01-15', '2024-01-15', '2025-01-15',
    ]);
    expect(events.every(e => e.amount === 10)).toBe(true);
    expect(events.every(e => e.source === 'archive')).toBe(true);
    expect(events.every(e => e.years === 1)).toBe(true);
  });

  it("user's tricky case: bought 2022-01-15 but expires 2022-02-15 (short initial term)", () => {
    // The whole reason this regression test exists. With expiry_date set,
    // we walk back from 2025-02-15 (3 renewals × 1yr later than original
    // 2022-02-15 expiry) and recover 2022-02 / 2023-02 / 2024-02 — the
    // first renewal lands in 2022, NOT 2023 as a purchase-anchored estimate
    // would imply. The user explicitly flagged this case as broken.
    const events = expandRenewalEvents({
      id: 'd1b',
      purchase_date: '2022-01-15',
      expiry_date: '2025-02-15',
      renewal_count: 3,
      renewal_cycle: 1,
      renewal_cost: 10,
      baseline_renewal_as_of: '2026-04-28',
    }, []);
    expect(events).toHaveLength(3);
    expect(events.map(e => localCalendarDateISO(e.date))).toEqual([
      '2022-02-15', '2023-02-15', '2024-02-15',
    ]);
    expect(events.every(e => e.source === 'archive')).toBe(true);
    expect(events.every(e => e.years === 1)).toBe(true);
  });

  it('multi-year cycle (.ai 2yr) with expiry_date set: renewals walked back from current expiry', () => {
    // Bought 2020-03-01, currently expires 2026-03-01, count=2, cycle=2.
    // Original first expiry = 2026-03 − 2×2 = 2022-03.
    // Renewal 1 at 2022-03; renewal 2 at 2024-03.
    const events = expandRenewalEvents({
      id: 'd2',
      purchase_date: '2020-03-01',
      expiry_date: '2026-03-01',
      renewal_count: 2,
      renewal_cycle: 2,
      renewal_cost: 80,
      baseline_renewal_as_of: '2026-01-01',
    }, []);
    expect(events.map(e => localCalendarDateISO(e.date))).toEqual([
      '2022-03-01', '2024-03-01',
    ]);
    expect(events.map(e => e.amount)).toEqual([80, 80]);
  });

  it('multi-year cycle without expiry_date: falls back to purchase + i × cycle', () => {
    const events = expandRenewalEvents({
      id: 'd2b',
      purchase_date: '2020-03-01',
      renewal_count: 2,
      renewal_cycle: 2,
      renewal_cost: 80,
      baseline_renewal_as_of: '2026-01-01',
    }, []);
    expect(events.map(e => localCalendarDateISO(e.date))).toEqual([
      '2022-03-01', '2024-03-01',
    ]);
  });

  it('post-baseline tx is emitted verbatim AND not double-counted in archive', () => {
    // 4 renewals total: baseline 2024-06-01, one post-baseline tx on 2024-12-01.
    // archive_count = 4 - 1 = 3.
    // expiry_date = 2025-12-01; the latest 1yr renewal (post-baseline tx) brought
    // expiry to 2025-12-01, so original-expiry-before-archive = 2025-12-01 − 1yr (post-baseline)
    //                                                                    − 3yr (archive) = 2021-12-01.
    // Archive renewals at 2021-12-01, 2022-12-01, 2023-12-01.
    const events = expandRenewalEvents({
      id: 'd3',
      purchase_date: '2020-12-01',
      expiry_date: '2025-12-01',
      renewal_count: 4,
      renewal_cycle: 1,
      renewal_cost: 10,
      baseline_renewal_as_of: '2024-06-01',
    }, [{ ...tx('d3', '2024-12-01', 12), renewal_period_years: 1 }]);
    expect(events).toHaveLength(4);
    const archive = events.filter(e => e.source === 'archive');
    const txs = events.filter(e => e.source === 'transaction');
    expect(archive).toHaveLength(3);
    expect(archive.map(e => localCalendarDateISO(e.date))).toEqual([
      '2021-12-01', '2022-12-01', '2023-12-01',
    ]);
    expect(txs).toHaveLength(1);
    expect(localCalendarDateISO(txs[0].date)).toBe('2024-12-01');
    expect(txs[0].amount).toBe(12);
  });

  it('no baseline: every renew transaction counts, the rest of renewal_count is archive', () => {
    const events = expandRenewalEvents({
      id: 'd4',
      purchase_date: '2020-01-01',
      renewal_count: 2,
      renewal_cycle: 1,
      renewal_cost: 10,
      baseline_renewal_as_of: null,
    }, [tx('d4', '2021-06-01', 99)]);
    // Without a baseline every renew tx has a known amount, so 2 renewals =
    // 1 archive estimate ($10) + 1 real transaction ($99). Same complement rule
    // as with a baseline; matches renewalCostBasis.
    expect(events).toHaveLength(2);
    expect(events.filter(e => e.source === 'archive').map(e => e.amount)).toEqual([10]);
    expect(events.filter(e => e.source === 'transaction').map(e => e.amount)).toEqual([99]);
  });

  it('no baseline: renew transactions alone (renewal_count matches) produce no archive estimate', () => {
    const events = expandRenewalEvents({
      id: 'd5',
      purchase_date: '2020-01-01',
      renewal_count: 1,
      renewal_cycle: 1,
      renewal_cost: 10,
      baseline_renewal_as_of: null,
    }, [tx('d5', '2021-06-01', 99)]);
    expect(events).toHaveLength(1);
    expect(events[0].source).toBe('transaction');
    expect(events[0].amount).toBe(99);
  });

  it('zero renewal_count → no archive events even with cost set', () => {
    const events = expandRenewalEvents({
      id: 'd5',
      purchase_date: '2024-01-01',
      renewal_count: 0,
      renewal_cycle: 1,
      renewal_cost: 10,
      baseline_renewal_as_of: '2024-06-01',
    }, []);
    expect(events).toHaveLength(0);
  });

  it('zero renewal_cost → no archive events (no money to attribute)', () => {
    const events = expandRenewalEvents({
      id: 'd6',
      purchase_date: '2022-01-01',
      renewal_count: 3,
      renewal_cycle: 1,
      renewal_cost: 0,
      baseline_renewal_as_of: '2026-01-01',
    }, []);
    expect(events).toHaveLength(0);
  });

  it('missing purchase_date → no archive events possible', () => {
    const events = expandRenewalEvents({
      id: 'd7',
      renewal_count: 3,
      renewal_cycle: 1,
      renewal_cost: 10,
      baseline_renewal_as_of: '2026-01-01',
    }, []);
    expect(events.filter(e => e.source === 'archive')).toHaveLength(0);
  });

  it('garbage cycle/count clamps to safe defaults', () => {
    const events = expandRenewalEvents({
      id: 'd8',
      purchase_date: '2024-01-01',
      renewal_count: 1,
      renewal_cycle: -3,        // → clamps to 1
      renewal_cost: 10,
      baseline_renewal_as_of: '2026-01-01',
    }, []);
    expect(events).toHaveLength(1);
    expect(localCalendarDateISO(events[0].date)).toBe('2025-01-01');
  });

  // ────────────── Forecast / projection cases ──────────────

  it("forecast: user's case (expiry past today) → projected event at expiry, not next cycle", () => {
    // 2020-02 purchase, 3 archive renewals, expiry 2025-10. Today is 2026-04
    // (per the user's example) — expiry is 6 months past. Projecting through
    // today should emit ONE event right at expiry (2025-10) and stop, since
    // the next would be 2026-10 which is in the future.
    const events = expandRenewalEvents({
      id: 'd-forecast-1',
      status: 'active',
      purchase_date: '2020-02-15',
      expiry_date: '2025-10-15',
      renewal_count: 3,
      renewal_cycle: 1,
      renewal_cost: 10,
      baseline_renewal_as_of: '2026-04-28',
    }, [], { forecastUntil: new Date('2026-04-28T12:00:00Z') });
    const projected = events.filter(e => e.source === 'projected');
    expect(projected).toHaveLength(1);
    expect(localCalendarDateISO(projected[0].date)).toBe('2025-10-15');
    expect(projected[0].amount).toBe(10);
    expect(projected[0].years).toBe(1);
    // archive part still present
    expect(events.filter(e => e.source === 'archive')).toHaveLength(3);
  });

  it('forecast through end of year captures multiple future renewals', () => {
    // expiry 2025-10, horizon end-of-2026 → projects 2025-10 AND 2026-10.
    const events = expandRenewalEvents({
      id: 'd-forecast-2',
      status: 'active',
      purchase_date: '2020-02-15',
      expiry_date: '2025-10-15',
      renewal_count: 3,
      renewal_cycle: 1,
      renewal_cost: 10,
      baseline_renewal_as_of: '2026-04-28',
    }, [], { forecastUntil: new Date('2026-12-31T23:59:59Z') });
    const projected = events.filter(e => e.source === 'projected');
    expect(projected.map(e => localCalendarDateISO(e.date))).toEqual([
      '2025-10-15', '2026-10-15',
    ]);
  });

  it('forecast respects status: sold and expired domains get NO projections', () => {
    for (const status of ['sold', 'expired'] as const) {
      const events = expandRenewalEvents({
        id: `d-forecast-${status}`,
        status,
        purchase_date: '2020-01-01',
        expiry_date: '2025-01-01',
        renewal_count: 3,
        renewal_cycle: 1,
        renewal_cost: 10,
        baseline_renewal_as_of: '2026-01-01',
      }, [], { forecastUntil: new Date('2030-01-01T00:00:00Z') });
      expect(events.filter(e => e.source === 'projected')).toHaveLength(0);
    }
  });

  it('forecast: missing forecastUntil option → no projections emitted', () => {
    const events = expandRenewalEvents({
      id: 'd-forecast-no-opt',
      status: 'active',
      purchase_date: '2020-01-01',
      expiry_date: '2025-01-01',
      renewal_count: 3,
      renewal_cycle: 1,
      renewal_cost: 10,
      baseline_renewal_as_of: '2026-01-01',
    }, []);
    expect(events.filter(e => e.source === 'projected')).toHaveLength(0);
  });

  it('forecast: missing expiry_date → no projections emitted (no anchor)', () => {
    // Even with forecastUntil set, can't project without an expiry to start from.
    const events = expandRenewalEvents({
      id: 'd-forecast-no-expiry',
      status: 'active',
      purchase_date: '2020-01-01',
      renewal_count: 3,
      renewal_cycle: 1,
      renewal_cost: 10,
      baseline_renewal_as_of: '2026-01-01',
    }, [], { forecastUntil: new Date('2030-01-01T00:00:00Z') });
    expect(events.filter(e => e.source === 'projected')).toHaveLength(0);
  });

  it('forecast: multi-year cycle steps forward by `cycle` years per projected event', () => {
    const events = expandRenewalEvents({
      id: 'd-forecast-2y',
      status: 'active',
      purchase_date: '2020-01-01',
      expiry_date: '2024-01-01',
      renewal_count: 2,
      renewal_cycle: 2,
      renewal_cost: 100,
      baseline_renewal_as_of: '2025-01-01',
    }, [], { forecastUntil: new Date('2030-06-30T00:00:00Z') });
    const projected = events.filter(e => e.source === 'projected');
    // Steps: 2024-01-01, 2026-01-01, 2028-01-01, 2030-01-01 (≤ 2030-06-30 ✓)
    expect(projected.map(e => localCalendarDateISO(e.date))).toEqual([
      '2024-01-01', '2026-01-01', '2028-01-01', '2030-01-01',
    ]);
    expect(projected.every(e => e.years === 2)).toBe(true);
  });

  it('post-baseline tx renewal_period_years is preserved on the event (used for amortization)', () => {
    const events = expandRenewalEvents({
      id: 'd-tx-years',
      status: 'active',
      purchase_date: '2020-01-01',
      expiry_date: '2030-01-01',
      renewal_count: 1,
      renewal_cycle: 1,
      renewal_cost: 10,
      baseline_renewal_as_of: '2025-01-01',
    }, [{
      ...tx('d-tx-years', '2025-01-15', 50),
      renewal_period_years: 5,
    }]);
    const txs = events.filter(e => e.source === 'transaction');
    expect(txs).toHaveLength(1);
    expect(txs[0].years).toBe(5);
    expect(txs[0].amount).toBe(50);
  });

  it('post-baseline tx for a different domain is not picked up', () => {
    const events = expandRenewalEvents({
      id: 'd9',
      purchase_date: '2024-01-01',
      renewal_count: 0,
      renewal_cycle: 1,
      renewal_cost: 10,
      baseline_renewal_as_of: '2024-06-01',
    }, [tx('OTHER_DOMAIN', '2024-12-01', 99)]);
    expect(events).toHaveLength(0);
  });
});
