import { describe, it, expect } from 'vitest';
import { getEffectiveExpiry, daysUntilEffectiveExpiry } from './effectiveExpiry';

describe('getEffectiveExpiry', () => {
  it('returns explicit expiry_date when present', () => {
    const r = getEffectiveExpiry({
      expiry_date: '2027-06-15',
      next_renewal_date: '2099-01-01',  // ignored
      purchase_date: '2020-01-01',      // ignored
      renewal_count: 3,
      renewal_cycle: 1,
    });
    expect(r.source).toBe('explicit');
    expect(r.date?.toISOString().slice(0, 10)).toBe('2027-06-15');
  });

  it('falls back to next_renewal_date when expiry_date is empty', () => {
    const r = getEffectiveExpiry({
      expiry_date: null,
      next_renewal_date: '2026-09-01',
      purchase_date: '2020-01-01',
      renewal_count: 3,
      renewal_cycle: 1,
    });
    expect(r.source).toBe('next_renewal_date');
    expect(r.date?.toISOString().slice(0, 10)).toBe('2026-09-01');
  });

  it('estimates from purchase + (renewal_count+1)*cycle when both fields are missing', () => {
    // Purchased 2020-01-01, renewed 2 times on a 1-yr cycle → next expiry = 2023-01-01.
    const r = getEffectiveExpiry({
      purchase_date: '2020-01-01',
      renewal_count: 2,
      renewal_cycle: 1,
    });
    expect(r.source).toBe('estimated');
    expect(r.date?.getFullYear()).toBe(2023);
    expect(r.date?.getMonth()).toBe(0);
    expect(r.date?.getDate()).toBe(1);
  });

  it('estimates with a multi-year cycle (e.g. .ai 2yr)', () => {
    // Purchase 2022-03-15, never renewed, 2-yr cycle → next expiry 2024-03-15.
    const r = getEffectiveExpiry({
      purchase_date: '2022-03-15',
      renewal_count: 0,
      renewal_cycle: 2,
    });
    expect(r.source).toBe('estimated');
    expect(r.date?.toISOString().slice(0, 10)).toBe('2024-03-15');
  });

  it('treats missing/zero renewal_count as 0 in the estimate', () => {
    // No renewals yet → expiry one cycle after purchase
    const r = getEffectiveExpiry({
      purchase_date: '2024-01-01',
      renewal_cycle: 1,
    });
    expect(r.source).toBe('estimated');
    expect(r.date?.getFullYear()).toBe(2025);
  });

  it('clamps negative or non-integer renewal_cycle to >= 1', () => {
    // Bad data shouldn't crash — just default to 1 yr cycle.
    const r = getEffectiveExpiry({
      purchase_date: '2020-01-01',
      renewal_count: 0,
      renewal_cycle: -5,
    });
    expect(r.source).toBe('estimated');
    expect(r.date?.getFullYear()).toBe(2021);
  });

  it('returns unknown when neither expiry fields nor purchase_date are usable', () => {
    expect(getEffectiveExpiry({}).source).toBe('unknown');
    expect(getEffectiveExpiry({ purchase_date: 'garbage' }).source).toBe('unknown');
    expect(getEffectiveExpiry({ purchase_date: null }).source).toBe('unknown');
  });

  it('skips an invalid expiry_date and falls through to next_renewal_date', () => {
    const r = getEffectiveExpiry({
      expiry_date: 'not-a-date',
      next_renewal_date: '2026-12-31',
    });
    expect(r.source).toBe('next_renewal_date');
  });

  it('skips invalid expiry + next_renewal_date and falls through to estimate', () => {
    const r = getEffectiveExpiry({
      expiry_date: 'not-a-date',
      next_renewal_date: 'also-bad',
      purchase_date: '2024-06-01',
      renewal_cycle: 1,
    });
    expect(r.source).toBe('estimated');
  });
});

describe('daysUntilEffectiveExpiry', () => {
  it('returns null when expiry is unknown', () => {
    expect(daysUntilEffectiveExpiry({})).toBeNull();
  });

  it('returns days from `now` to the effective expiry (positive in future)', () => {
    const now = new Date('2026-01-01T00:00:00Z');
    const days = daysUntilEffectiveExpiry({ expiry_date: '2026-04-01' }, now);
    // 31 (Jan) + 28 (Feb 2026 not leap) + 31 (Mar) = 90 days.
    expect(days).toBe(90);
  });

  it('returns negative days when expiry is past', () => {
    const now = new Date('2026-04-28T00:00:00Z');
    const days = daysUntilEffectiveExpiry({ expiry_date: '2026-04-01' }, now);
    expect(days).toBe(-27);
  });
});
