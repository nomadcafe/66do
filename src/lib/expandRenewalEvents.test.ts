import { describe, it, expect } from 'vitest';
import { expandRenewalEvents } from './expandRenewalEvents';
import type { TransactionWithRequiredFields } from '../types/transaction';

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
  it("user's canonical case: 2022 purchase, 3 archive renewals, default baseline today, no tx", () => {
    // baseline = today means archive_count = renewal_count - 0 = 3.
    // Should spread 3 events at purchase + 1/2/3 years × $10.
    const events = expandRenewalEvents({
      id: 'd1',
      purchase_date: '2022-01-15',
      renewal_count: 3,
      renewal_cycle: 1,
      renewal_cost: 10,
      baseline_renewal_as_of: '2026-04-28',
    }, []);
    expect(events).toHaveLength(3);
    expect(events.map(e => e.date.toISOString().slice(0, 10))).toEqual([
      '2023-01-15', '2024-01-15', '2025-01-15',
    ]);
    expect(events.every(e => e.amount === 10)).toBe(true);
    expect(events.every(e => e.source === 'archive')).toBe(true);
  });

  it('multi-year cycle (.ai 2yr): renewals spaced by 2 years', () => {
    const events = expandRenewalEvents({
      id: 'd2',
      purchase_date: '2020-03-01',
      renewal_count: 2,
      renewal_cycle: 2,
      renewal_cost: 80,
      baseline_renewal_as_of: '2026-01-01',
    }, []);
    expect(events.map(e => e.date.toISOString().slice(0, 10))).toEqual([
      '2022-03-01', '2024-03-01',
    ]);
    expect(events.map(e => e.amount)).toEqual([80, 80]);
  });

  it('post-baseline tx is emitted verbatim AND not double-counted in archive', () => {
    // 4 renewals total: baseline 2024-06-01, one post-baseline tx on 2024-12-01.
    // archive_count = 4 - 1 = 3 → estimated at 2023, 2024, 2025 (purchase + i years).
    // Plus the explicit tx at 2024-12-01.
    const events = expandRenewalEvents({
      id: 'd3',
      purchase_date: '2022-01-01',
      renewal_count: 4,
      renewal_cycle: 1,
      renewal_cost: 10,
      baseline_renewal_as_of: '2024-06-01',
    }, [tx('d3', '2024-12-01', 12)]);
    expect(events).toHaveLength(4);
    const archive = events.filter(e => e.source === 'archive');
    const txs = events.filter(e => e.source === 'transaction');
    expect(archive).toHaveLength(3);
    expect(archive.map(e => e.date.toISOString().slice(0, 10))).toEqual([
      '2023-01-01', '2024-01-01', '2025-01-01',
    ]);
    expect(txs).toHaveLength(1);
    expect(txs[0].date.toISOString().slice(0, 10)).toBe('2024-12-01');
    expect(txs[0].amount).toBe(12);
  });

  it('no baseline: all renewals are archive, transactions are ignored (matches holdingCostAsOf)', () => {
    const events = expandRenewalEvents({
      id: 'd4',
      purchase_date: '2020-01-01',
      renewal_count: 2,
      renewal_cycle: 1,
      renewal_cost: 10,
      baseline_renewal_as_of: null,
    }, [tx('d4', '2021-06-01', 99)]);
    // Without baseline, the cost-basis path in holdingCostAsOf only reads
    // renewal_count, so we mirror that here. Tx is ignored.
    expect(events).toHaveLength(2);
    expect(events.every(e => e.source === 'archive')).toBe(true);
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
    expect(events[0].date.toISOString().slice(0, 10)).toBe('2025-01-01');
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
