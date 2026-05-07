import { describe, it, expect } from 'vitest';
import { handleDomainRenewal } from './domainExpiryManager';
import type { Domain } from '../types/domain';

function makeDomain(overrides: Partial<Domain> = {}): Domain {
  return {
    id: 'd1',
    domain_name: 'foo.com',
    registrar: '',
    purchase_date: '2024-01-15',
    purchase_cost: 0,
    renewal_cost: 0,
    renewal_cycle: 1,
    renewal_count: 0,
    expiry_date: '2025-01-15',
    status: 'active',
    estimated_value: 0,
    tags: [],
    ...overrides,
  };
}

describe('handleDomainRenewal — when expiry_date is set (the common path)', () => {
  it('+2 years extends explicit expiry_date by exactly 2 years', () => {
    const out = handleDomainRenewal(makeDomain({ expiry_date: '2025-01-15' }), 2);
    expect(out.expiry_date).toBe('2027-01-15');
    expect(out.renewal_count).toBe(1);
  });

  it('renewalYears defaults to renewal_cycle when omitted', () => {
    const out = handleDomainRenewal(makeDomain({ expiry_date: '2025-01-15', renewal_cycle: 2 }));
    expect(out.expiry_date).toBe('2027-01-15');
  });
});

describe('handleDomainRenewal — fallback when expiry_date is missing', () => {
  it('first renewal (renewal_count=0) on a 1-year-cycle domain: +2 years lands at purchase + 2', () => {
    // Pre-renewal effective expiry = purchase + 1y (first cycle).
    // After +2y renewal, expected: purchase + 1y + 2y = 2027-01-15.
    // Old formula returned purchase + 2y = 2026-01-15 — that's the off-by-one
    // year users hit when their domain has no explicit expiry_date.
    const out = handleDomainRenewal(
      makeDomain({ expiry_date: undefined, renewal_cycle: 1, renewal_count: 0 }),
      2
    );
    expect(out.expiry_date).toBe('2027-01-15');
    expect(out.renewal_count).toBe(1);
  });

  it('subsequent renewal (renewal_count=2) at 1y cycle, +2y: extends from existing expiry, not from purchase × cycle', () => {
    // renewal_count=2 means the domain has been renewed twice (2 cycles elapsed).
    // Effective expiry before this call = purchase + (2+1)*1 = 2027-01-15.
    // After +2y: 2029-01-15.
    const out = handleDomainRenewal(
      makeDomain({ expiry_date: undefined, renewal_cycle: 1, renewal_count: 2 }),
      2
    );
    expect(out.expiry_date).toBe('2029-01-15');
  });

  it('renewing for same length as cycle still respects renewal_cycle for prior renewals', () => {
    // renewal_cycle=2, renewal_count=1 → effective expiry = purchase + 2*2 = 2028-01-15.
    // +2y → 2030-01-15.
    const out = handleDomainRenewal(
      makeDomain({ expiry_date: undefined, renewal_cycle: 2, renewal_count: 1 }),
      2
    );
    expect(out.expiry_date).toBe('2030-01-15');
  });
});
