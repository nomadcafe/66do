import { describe, it, expect } from 'vitest';
import { mergeRenewTransactionDomainUpdates } from './renewDomainPatch';
import type { DomainWithTags } from '../types/dashboard';
import type { TransactionWithRequiredFields } from '../types/transaction';

function makeDomain(overrides: Partial<DomainWithTags> = {}): DomainWithTags {
  return {
    id: 'd1',
    domain_name: 'foo.com',
    status: 'active',
    registrar: 'a',
    purchase_date: '2024-01-15',
    purchase_cost: 10,
    renewal_cost: 12,
    renewal_cycle: 1,
    renewal_count: 0,
    expiry_date: '2025-01-15',
    tags: [],
    created_at: '',
    updated_at: '',
    ...overrides,
  };
}

function makeRenewTx(overrides: Partial<TransactionWithRequiredFields> = {}): TransactionWithRequiredFields {
  return {
    id: 'tx-new',
    domain_id: 'd1',
    type: 'renew',
    amount: 24,
    currency: 'USD',
    date: '2025-01-10',
    renewal_period_years: 2,
    created_at: '',
    updated_at: '',
    ...overrides,
  };
}

describe('mergeRenewTransactionDomainUpdates — multi-year renewal', () => {
  it('renewal_period_years=2 against an existing expiry_date extends by 2 years', () => {
    const result = mergeRenewTransactionDomainUpdates([makeDomain()], [makeRenewTx()], []);
    expect(result[0].expiry_date).toBe('2027-01-15');
    expect(result[0].renewal_count).toBe(1);
  });

  it('renewal_period_years=3 against an existing expiry_date extends by 3 years', () => {
    const result = mergeRenewTransactionDomainUpdates(
      [makeDomain()],
      [makeRenewTx({ renewal_period_years: 3 })],
      []
    );
    expect(result[0].expiry_date).toBe('2028-01-15');
  });

  it('falls back to renewal_cycle when renewal_period_years is missing', () => {
    const result = mergeRenewTransactionDomainUpdates(
      [makeDomain({ renewal_cycle: 1 })],
      [makeRenewTx({ renewal_period_years: undefined })],
      []
    );
    expect(result[0].expiry_date).toBe('2026-01-15');
  });

  it('skips when the same renew tx already existed (avoids double-extending)', () => {
    const tx = makeRenewTx();
    const result = mergeRenewTransactionDomainUpdates([makeDomain()], [tx], [tx]);
    expect(result[0].expiry_date).toBe('2025-01-15');
    expect(result[0].renewal_count).toBe(0);
  });

  it('extend_domain_expiry_on_renew=false suppresses extension', () => {
    const result = mergeRenewTransactionDomainUpdates(
      [makeDomain()],
      [makeRenewTx({ extend_domain_expiry_on_renew: false })],
      []
    );
    expect(result[0].expiry_date).toBe('2025-01-15');
  });
});
