import { describe, it, expect } from 'vitest';
import {
  transferCostForDomain,
  totalHoldingCostForDomain,
  holdingCostAsOf,
} from './renewalCostBasis';

const domain = {
  id: 'd1',
  purchase_cost: 100,
  purchase_date: '2023-01-01',
  renewal_cost: 12,
  renewal_count: 1,
  renewal_cycle: 1,
  baseline_renewal_as_of: null,
};

const txs = [
  { domain_id: 'd1', type: 'transfer', date: '2024-03-01', amount: 9 },
  { domain_id: 'd1', type: 'transfer', date: '2025-03-01', amount: 11 },
  { domain_id: 'd1', type: 'fee', date: '2024-03-01', amount: 50 },
  { domain_id: 'd2', type: 'transfer', date: '2024-03-01', amount: 99 },
];

describe('transferCostForDomain', () => {
  it('sums only this domain’s transfer transactions', () => {
    expect(transferCostForDomain('d1', txs)).toBe(20);
    expect(transferCostForDomain('d2', txs)).toBe(99);
    expect(transferCostForDomain('nope', txs)).toBe(0);
  });
});

describe('totalHoldingCostForDomain', () => {
  it('includes transfer fees on top of purchase + renewals', () => {
    // 100 purchase + 1 × 12 archive renewal + 20 transfer
    expect(totalHoldingCostForDomain(domain, txs)).toBe(132);
  });

  it('still excludes fee / marketing / advertising', () => {
    const feeOnly = [{ domain_id: 'd1', type: 'fee', date: '2024-03-01', amount: 50 }];
    expect(totalHoldingCostForDomain(domain, feeOnly)).toBe(112);
  });
});

describe('holdingCostAsOf', () => {
  it('only counts transfers dated on or before asOf', () => {
    // 2024-06-01: purchase 100 + 1 archive renewal 12 (2024-01-01) + first transfer 9
    expect(holdingCostAsOf(domain, txs, new Date('2024-06-01'))).toBe(121);
    // 2025-06-01: both transfers counted
    expect(holdingCostAsOf(domain, txs, new Date('2025-06-01'))).toBe(132);
  });
});
