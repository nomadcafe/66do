import { describe, it, expect } from 'vitest';
import { calculateExpiredDomainLoss } from './financialCalculations';

type Domain = Parameters<typeof calculateExpiredDomainLoss>[0][number];

function domain(over: Partial<Domain> & { id: string }): Domain {
  return {
    domain_name: `${over.id}.com`,
    purchase_cost: 100,
    renewal_cost: 0,
    renewal_count: 0,
    baseline_renewal_as_of: null,
    status: 'expired',
    expiry_date: '2025-04-01',
    purchase_date: '2023-04-01',
    ...over,
  } as Domain;
}

describe('calculateExpiredDomainLoss — 没填成本的过期域名', () => {
  // 回归：以前 `if (totalInvestment <= 0) return` 把它们整个丢弃。全部过期域名
  // 都没填成本时 expiredDomains 会是空的，界面于是弹出「恭喜！您没有因域名过期
  // 造成的损失」，而同一张卡下方的状态统计里明写着「已过期: N」。
  it('照样计入个数，只是不贡献金额', () => {
    const r = calculateExpiredDomainLoss(
      [
        domain({ id: 'priced', purchase_cost: 120 }),
        domain({ id: 'free', purchase_cost: 0 }),
        domain({ id: 'nullcost', purchase_cost: null }),
      ],
      []
    );

    expect(r.expiredDomains).toHaveLength(3);
    expect(r.totalLoss).toBe(120);
    expect(r.unknownCostCount).toBe(2);
  });

  it('全部没填成本时也不会被当成「没有过期域名」', () => {
    const r = calculateExpiredDomainLoss(
      [domain({ id: 'a', purchase_cost: 0 }), domain({ id: 'b', purchase_cost: null })],
      []
    );

    // 组件的空状态判据就是这个长度——它不能是 0，否则会弹出庆祝文案
    expect(r.expiredDomains).toHaveLength(2);
    expect(r.totalLoss).toBe(0);
    expect(r.unknownCostCount).toBe(2);
  });

  it('真的没有过期域名时才是空的', () => {
    const r = calculateExpiredDomainLoss(
      [domain({ id: 'held', status: 'active', expiry_date: '2099-01-01' })],
      []
    );
    expect(r.expiredDomains).toHaveLength(0);
    expect(r.unknownCostCount).toBe(0);
  });

  it('年度汇总里也在，金额为 0 但个数算上', () => {
    const r = calculateExpiredDomainLoss(
      [
        domain({ id: 'a', purchase_cost: 50, expiry_date: '2024-06-01' }),
        domain({ id: 'b', purchase_cost: 0, expiry_date: '2024-09-01' }),
      ],
      []
    );

    const y2024 = r.lossByYear.find((row) => row.year === '2024');
    expect(y2024?.loss).toBe(50);
    expect(y2024?.domainCount).toBe(2);
  });

  it('sold 的域名不算损失', () => {
    const r = calculateExpiredDomainLoss([domain({ id: 'gone', status: 'sold' })], []);
    expect(r.expiredDomains).toHaveLength(0);
  });

  it('均值的分母应排除没成本的（由调用方按 unknownCostCount 算）', () => {
    const r = calculateExpiredDomainLoss(
      [
        domain({ id: 'a', purchase_cost: 100 }),
        domain({ id: 'b', purchase_cost: 200 }),
        domain({ id: 'c', purchase_cost: 0 }),
      ],
      []
    );

    const priced = r.expiredDomains.length - r.unknownCostCount;
    expect(priced).toBe(2);
    expect(r.totalLoss / priced).toBe(150); // 而不是 300/3 = 100
  });
});
