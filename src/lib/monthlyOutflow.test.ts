import { describe, it, expect } from 'vitest';
import { computeMonthlyOutflow } from './monthlyOutflow';
import { calculateYearlyRenewalVsProfit } from './coreCalculations';
import type { DomainWithTags } from '../types/dashboard';
import type { TransactionWithRequiredFields } from '../types/transaction';

function domain(over: Partial<DomainWithTags> & { id: string }): DomainWithTags {
  return {
    domain_name: `${over.id}.com`,
    registrar: 'Namecheap',
    purchase_date: '2024-03-10',
    purchase_cost: 100,
    renewal_cost: 12,
    renewal_cycle: 1,
    renewal_count: 0,
    expiry_date: '2026-03-10',
    status: 'active',
    estimated_value: 0,
    tags: [],
    ...over,
  } as DomainWithTags;
}

function tx(
  over: Partial<TransactionWithRequiredFields> & {
    id: string;
    domain_id: string;
    type: TransactionWithRequiredFields['type'];
    amount: number;
    date: string;
  }
): TransactionWithRequiredFields {
  return { currency: 'USD', created_at: '', updated_at: '', ...over } as TransactionWithRequiredFields;
}

const sum = (m: Map<string, number>) => [...m.values()].reduce((s, v) => s + v, 0);

describe('computeMonthlyOutflow — 购入口径', () => {
  it('有 buy 交易时按交易走，忽略 purchase_cost', () => {
    // 回归：投资趋势图曾经永远只读 purchase_cost，用交易记账而 purchase_cost
    // 留 0 的域名，上方 Total Investment KPI 有钱、趋势线却是 0。
    const { purchaseByMonth } = computeMonthlyOutflow(
      [domain({ id: 'd1', purchase_cost: 0, purchase_date: '2024-03-10' })],
      [tx({ id: 't1', domain_id: 'd1', type: 'buy', amount: 500, date: '2024-03-10' })],
      new Date(2026, 8, 6)
    );

    expect(purchaseByMonth.get('2024-03')).toBe(500);
    expect(sum(purchaseByMonth)).toBe(500);
  });

  it('一笔 buy 交易都没有时才用 purchase_cost 兜底', () => {
    const { purchaseByMonth } = computeMonthlyOutflow(
      [domain({ id: 'd1', purchase_cost: 100 })],
      [],
      new Date(2026, 8, 6)
    );
    expect(purchaseByMonth.get('2024-03')).toBe(100);
  });

  it('buy 交易记在别的月份时，purchase_cost 不会同时进账', () => {
    // 判据是「有没有 buy 交易」而不是「购入月有没有」，否则同一次购入算两次
    const { purchaseByMonth } = computeMonthlyOutflow(
      [domain({ id: 'd1', purchase_cost: 100, purchase_date: '2024-03-10' })],
      [tx({ id: 't1', domain_id: 'd1', type: 'buy', amount: 500, date: '2024-07-01' })],
      new Date(2026, 8, 6)
    );

    expect(sum(purchaseByMonth)).toBe(500);
    expect(purchaseByMonth.has('2024-03')).toBe(false);
    expect(purchaseByMonth.get('2024-07')).toBe(500);
  });
});

describe('computeMonthlyOutflow — 续费口径', () => {
  it('档案续费（只填 renewal_count）也计入流出', () => {
    // 回归：月度净现金流图曾经只认 renew 交易，只用 renewal_count 记账的域名
    // 在趋势线上有续费、在现金流图那个月却没有任何流出。
    const { renewalByMonth, otherByMonth } = computeMonthlyOutflow(
      [domain({ id: 'd1', renewal_count: 2, renewal_cost: 12, expiry_date: '2026-03-10' })],
      [],
      new Date(2026, 8, 6)
    );

    expect(sum(renewalByMonth)).toBe(24);
    expect(sum(otherByMonth)).toBe(0);
  });

  it('renew 交易不会被 otherByMonth 再加一遍', () => {
    const { renewalByMonth, otherByMonth } = computeMonthlyOutflow(
      [domain({ id: 'd1', renewal_count: 1, renewal_cost: 12 })],
      [tx({ id: 't1', domain_id: 'd1', type: 'renew', amount: 15, date: '2025-03-10' })],
      new Date(2026, 8, 6)
    );

    // archiveCount = renewal_count − 已知金额的 renew tx 条数 = 0，只剩交易那笔
    expect(sum(renewalByMonth)).toBe(15);
    expect(sum(otherByMonth)).toBe(0);
  });
});

describe('computeMonthlyOutflow — 与年度现金流表对拍', () => {
  // 这是这个模块存在的理由：年表和月图必须对同一批数据给出同一个支出总额。
  it('按年汇总后与 calculateYearlyRenewalVsProfit 逐位相等', () => {
    const domains = [
      domain({ id: 'a', purchase_date: '2024-02-01', purchase_cost: 120, renewal_count: 2 }),
      domain({ id: 'b', purchase_date: '2024-06-15', purchase_cost: 0, renewal_count: 0 }),
      domain({ id: 'c', purchase_date: '2025-01-20', purchase_cost: 80, renewal_count: 1 }),
    ];
    const txs = [
      tx({ id: 't1', domain_id: 'b', type: 'buy', amount: 900, date: '2024-06-15' }),
      tx({ id: 't2', domain_id: 'a', type: 'transfer', amount: 9, date: '2025-04-02' }),
      tx({ id: 't3', domain_id: 'c', type: 'fee', amount: 25, date: '2025-08-11' }),
      tx({ id: 't4', domain_id: 'a', type: 'marketing', amount: 40, date: '2024-11-05' }),
      tx({ id: 't5', domain_id: 'a', type: 'sell', amount: 3000, date: '2025-09-01' }),
    ];

    const monthly = computeMonthlyOutflow(domains, txs, null);
    const yearly = calculateYearlyRenewalVsProfit(txs, domains, new Date(2026, 8, 6));

    const byYear = (m: Map<string, number>) => {
      const out = new Map<number, number>();
      for (const [key, v] of m) {
        const y = Number(key.slice(0, 4));
        out.set(y, (out.get(y) ?? 0) + v);
      }
      return out;
    };
    const purchases = byYear(monthly.purchaseByMonth);
    const renewals = byYear(monthly.renewalByMonth);
    const others = byYear(monthly.otherByMonth);

    expect(yearly.length).toBeGreaterThan(0);
    for (const row of yearly) {
      expect(renewals.get(row.year) ?? 0).toBeCloseTo(row.renewalSpend, 9);
      // 年表的 otherOutflow = 非续费流出（含 buy）+ purchase_cost 兜底，
      // 月粒度这边拆成了 purchase + other 两桶，合起来必须相等。
      expect((purchases.get(row.year) ?? 0) + (others.get(row.year) ?? 0)).toBeCloseTo(
        row.otherOutflow,
        9
      );
    }
  });
});

describe('computeMonthlyOutflow — until 上限', () => {
  it('不收晚于 until 的事件', () => {
    const { purchaseByMonth } = computeMonthlyOutflow(
      [domain({ id: 'past', purchase_date: '2024-03-10' }), domain({ id: 'future', purchase_date: '2027-01-01' })],
      [],
      new Date(2026, 8, 6)
    );

    expect(purchaseByMonth.has('2024-03')).toBe(true);
    expect(purchaseByMonth.has('2027-01')).toBe(false);
  });

  it('until = null 时不设上限', () => {
    const { purchaseByMonth } = computeMonthlyOutflow(
      [domain({ id: 'future', purchase_date: '2027-01-01' })],
      [],
      null
    );
    expect(purchaseByMonth.has('2027-01')).toBe(true);
  });
});
