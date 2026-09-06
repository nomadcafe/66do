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

describe('handleDomainRenewal — next_renewal_date as the base date', () => {
  it('renews from next_renewal_date instead of the purchase estimate', () => {
    // 回归：这一档以前是漏的。purchase 2024-01-10 / next_renewal_date 2026-03-01
    // / count=0 / cycle=1，续 1 年——旧实现掉到推算档，base = purchase + 1yr
    // = 2025-01-10，得出 2026-01-10，比正确答案早 14 个月，
    // 而且把用户填的确切日期直接丢了。
    const out = handleDomainRenewal(
      makeDomain({
        purchase_date: '2024-01-10',
        expiry_date: undefined,
        next_renewal_date: '2026-03-01',
        renewal_count: 0,
        renewal_cycle: 1,
      }),
      1
    );

    expect(out.expiry_date).toBe('2027-03-01');
    expect(out.renewal_count).toBe(1);
  });

  it('expiry_date still wins over next_renewal_date', () => {
    const out = handleDomainRenewal(
      makeDomain({ expiry_date: '2025-01-15', next_renewal_date: '2030-12-31' }),
      2
    );
    expect(out.expiry_date).toBe('2027-01-15');
  });

  it('still falls back to the purchase estimate when neither date is set', () => {
    const out = handleDomainRenewal(
      makeDomain({
        purchase_date: '2024-01-15',
        expiry_date: undefined,
        next_renewal_date: undefined,
        renewal_count: 0,
        renewal_cycle: 1,
      }),
      2
    );
    // base = purchase + (0+1)×1 = 2025-01-15，再 +2 年
    expect(out.expiry_date).toBe('2027-01-15');
  });

  it('clears next_renewal_date once expiry_date becomes authoritative', () => {
    // 留着那个旧日期只会陈旧：DomainForm 没有对应输入控件，用户看不见也改不掉，
    // 而 getEffectiveExpiry 会在 expiry_date 为空时把它当成真的。
    const out = handleDomainRenewal(
      makeDomain({ expiry_date: undefined, next_renewal_date: '2026-03-01' }),
      1
    );

    expect(out.expiry_date).toBe('2027-03-01');
    expect(out.next_renewal_date).toBeUndefined();
  });

  it('does not write to next_renewal_date when the domain never used it', () => {
    const out = handleDomainRenewal(makeDomain({ expiry_date: '2025-01-15' }), 1);
    expect(out.next_renewal_date).toBeUndefined();
  });

  it('a renew followed by its rollback restores the original date, in expiry_date', () => {
    // 删除 renew 交易时 useTransactionOperations 会把 expiry_date 回退同样年数。
    // 清空 next_renewal_date 不会丢信息：日期原样搬进了主字段。
    const original = '2026-03-01';
    const out = handleDomainRenewal(
      makeDomain({ expiry_date: undefined, next_renewal_date: original }),
      3
    );

    const rolledBack = new Date(2029, 2, 1);
    rolledBack.setFullYear(rolledBack.getFullYear() - 3);
    expect(out.expiry_date).toBe('2029-03-01');
    expect(
      `${rolledBack.getFullYear()}-${String(rolledBack.getMonth() + 1).padStart(2, '0')}-${String(
        rolledBack.getDate()
      ).padStart(2, '0')}`
    ).toBe(original);
  });
});
