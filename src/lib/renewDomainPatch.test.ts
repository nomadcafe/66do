import { describe, it, expect } from 'vitest';
import { mergeRenewTransactionDomainUpdates, expiryExtensionYears } from './renewDomainPatch';
import type { DomainWithTags } from '../types/dashboard';
import type { TransactionWithRequiredFields } from '../types/transaction';

function makeDomain(overrides: Partial<DomainWithTags> = {}): DomainWithTags {
  return {
    id: 'd1',
    user_id: 'u1',
    domain_name: 'foo.com',
    status: 'active',
    registrar: 'a',
    purchase_date: '2024-01-15',
    purchase_cost: 10,
    renewal_cost: 12,
    renewal_cycle: 1,
    renewal_count: 0,
    expiry_date: '2025-01-15',
    baseline_renewal_as_of: null,
    next_renewal_date: null,
    registration_date: null,
    sale_date: null,
    sale_price: null,
    platform_fee: null,
    estimated_value: null,
    tags: [],
    created_at: '',
    updated_at: '',
    ...overrides,
  } as DomainWithTags;
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

function makeTransferTx(
  overrides: Partial<TransactionWithRequiredFields> = {}
): TransactionWithRequiredFields {
  return {
    id: 'tx-transfer',
    domain_id: 'd1',
    type: 'transfer',
    amount: 9,
    currency: 'USD',
    date: '2024-06-01',
    created_at: '',
    updated_at: '',
    ...overrides,
  };
}

describe('mergeRenewTransactionDomainUpdates — transfer', () => {
  it('does not touch expiry when the transfer has no renewal_period_years', () => {
    const result = mergeRenewTransactionDomainUpdates([makeDomain()], [makeTransferTx()], []);
    expect(result[0].expiry_date).toBe('2025-01-15');
    expect(result[0].renewal_count).toBe(0);
  });

  it('renewal_period_years=0 is treated as "no extension"', () => {
    const result = mergeRenewTransactionDomainUpdates(
      [makeDomain()],
      [makeTransferTx({ renewal_period_years: 0 })],
      []
    );
    expect(result[0].expiry_date).toBe('2025-01-15');
  });

  it('renewal_period_years=1 extends expiry by a year without bumping renewal_count', () => {
    const result = mergeRenewTransactionDomainUpdates(
      [makeDomain()],
      [makeTransferTx({ renewal_period_years: 1 })],
      []
    );
    expect(result[0].expiry_date).toBe('2026-01-15');
    expect(result[0].renewal_count).toBe(0);
  });

  it('skips when the same transfer tx already existed (avoids double-extending)', () => {
    const tx = makeTransferTx({ renewal_period_years: 1 });
    const result = mergeRenewTransactionDomainUpdates([makeDomain()], [tx], [tx]);
    expect(result[0].expiry_date).toBe('2025-01-15');
  });

  it('applies once when an existing non-transfer tx is edited into a transfer', () => {
    const tx = makeTransferTx({ id: 'tx-1', renewal_period_years: 2 });
    const result = mergeRenewTransactionDomainUpdates(
      [makeDomain()],
      [tx],
      [makeTransferTx({ id: 'tx-1', type: 'fee' })]
    );
    expect(result[0].expiry_date).toBe('2027-01-15');
    expect(result[0].renewal_count).toBe(0);
  });
});

describe('expiryExtensionYears', () => {
  it('renew falls back to the domain renewal cycle, transfer falls back to 0', () => {
    expect(expiryExtensionYears({ type: 'renew', renewal_period_years: null }, 2)).toBe(2);
    expect(expiryExtensionYears({ type: 'transfer', renewal_period_years: null }, 2)).toBe(0);
  });

  it('non-extending types are always 0', () => {
    expect(expiryExtensionYears({ type: 'fee', renewal_period_years: 3 }, 1)).toBe(0);
    expect(expiryExtensionYears({ type: 'buy', renewal_period_years: 3 }, 1)).toBe(0);
  });
});
