import { describe, it, expect } from 'vitest';
import {
  transferCostForDomain,
  totalHoldingCostForDomain,
  holdingCostAsOf,
  archiveRenewalCount,
  totalRenewalCostForHolding,
  acquisitionCostForDomain,
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

// baseline 之后的 renew 交易既会让 mergeRenewTransactionDomainUpdates 把
// renewal_count +1，又会被 incrementalRenewalFromTransactions 按金额累加。
// archiveRenewalCount 负责把那部分计数扣掉，避免同一笔续费算两次。
describe('archiveRenewalCount — post-baseline renew 不重复计入档案', () => {
  const withBaseline = {
    id: 'd1',
    renewal_count: 3,
    renewal_cost: 12,
    baseline_renewal_as_of: '2026-01-01',
  };
  const renews = [
    { domain_id: 'd1', type: 'renew', date: '2025-06-01', amount: 10 }, // 基线前
    { domain_id: 'd1', type: 'renew', date: '2026-06-01', amount: 30 }, // 基线后
  ];

  it('扣掉基线及之后的 renew 交易条数', () => {
    expect(archiveRenewalCount(withBaseline, renews)).toBe(2);
  });

  it('没有 baseline 时全部算档案', () => {
    expect(
      archiveRenewalCount({ ...withBaseline, baseline_renewal_as_of: null }, renews)
    ).toBe(3);
  });

  it('交易条数多于 renewal_count 时不会变负', () => {
    expect(archiveRenewalCount({ ...withBaseline, renewal_count: 0 }, renews)).toBe(0);
  });

  it('totalRenewalCostForHolding 不再把同一笔续费算两次', () => {
    // 档案 2 次 × $12 + 基线后那笔真实金额 $30 = $54
    // （修复前是 3 × 12 + 30 = $66）
    expect(totalRenewalCostForHolding(withBaseline, renews)).toBe(54);
  });

  it('holdingCostAsOf 同样只算一次', () => {
    const d = { ...withBaseline, purchase_cost: 100, purchase_date: '2024-01-01', renewal_cycle: 1 };
    expect(holdingCostAsOf(d, renews, new Date('2026-12-31'))).toBe(154);
  });
});

// purchase_cost（DomainForm）和 buy 交易（Add Transaction）记的是同一件事，
// 相加会双算。规则：有交易就以交易为准，一笔都没有才回落到档案。
describe('acquisitionCostForDomain', () => {
  const d = { id: 'd1', purchase_cost: 100 };

  it('没有 buy 交易时用 purchase_cost', () => {
    expect(acquisitionCostForDomain(d, [])).toBe(100);
    expect(
      acquisitionCostForDomain(d, [{ domain_id: 'd1', type: 'renew', date: '2024-01-01', amount: 12 }])
    ).toBe(100);
  });

  it('有 buy 交易时以交易之和为准，不再叠加 purchase_cost', () => {
    const buys = [
      { domain_id: 'd1', type: 'buy', date: '2024-01-01', amount: 60 },
      { domain_id: 'd1', type: 'buy', date: '2024-02-01', amount: 15 },
    ];
    expect(acquisitionCostForDomain(d, buys)).toBe(75);
  });

  it('只认本域名的 buy 交易', () => {
    const buys = [{ domain_id: 'd2', type: 'buy', date: '2024-01-01', amount: 60 }];
    expect(acquisitionCostForDomain(d, buys)).toBe(100);
  });

  it('totalHoldingCostForDomain 用交易口径的取得成本', () => {
    const domainWithRenewals = {
      id: 'd1',
      purchase_cost: 100,
      renewal_cost: 12,
      renewal_count: 1,
      baseline_renewal_as_of: null,
    };
    const txs = [
      { domain_id: 'd1', type: 'buy', date: '2024-01-01', amount: 60 },
      { domain_id: 'd1', type: 'transfer', date: '2024-03-01', amount: 9 },
    ];
    // 60 buy（不是 100）+ 12 档案续费 + 9 转移
    expect(totalHoldingCostForDomain(domainWithRenewals, txs)).toBe(81);
  });

  it('holdingCostAsOf 按 buy 交易各自的日期截断', () => {
    const domainWithRenewals = {
      id: 'd1',
      purchase_cost: 100,
      purchase_date: '2024-01-01',
      renewal_cost: 0,
      renewal_count: 0,
      renewal_cycle: 1,
      baseline_renewal_as_of: null,
    };
    const txs = [
      { domain_id: 'd1', type: 'buy', date: '2024-01-01', amount: 60 },
      { domain_id: 'd1', type: 'buy', date: '2024-09-01', amount: 15 },
    ];
    expect(holdingCostAsOf(domainWithRenewals, txs, new Date('2024-06-01'))).toBe(60);
    expect(holdingCostAsOf(domainWithRenewals, txs, new Date('2024-12-01'))).toBe(75);
  });
});
