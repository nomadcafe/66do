/**
 * 年度支出表。
 *
 * 最要紧的一条是跟 computeMonthlyOutflow 对拍：月度净现金流图和这张年表读的
 * 是同一批钱，两边漂了就是"同一批数据两个总额"——这个 codebase 因为这个吃过
 * 好几次亏（transactionTypeGroups 的注释里记着：同一个"支出"概念曾经在三个
 * 地方各写了一套 filter，三张图给出三个不同的总额）。
 */
import { describe, it, expect } from 'vitest';
import { annualExpenses, EXPENSE_CATEGORIES } from './annualExpenses';
import { computeMonthlyOutflow } from './monthlyOutflow';
import type { DomainWithTags } from '../types/dashboard';
import type { TransactionWithRequiredFields } from '../types/transaction';

const UNTIL = new Date(2026, 11, 31);

const dom = (over: Record<string, unknown> = {}) =>
  ({
    id: 'd1', domain_name: 'x.com', registrar: 'NC',
    purchase_date: '2025-03-01', purchase_cost: 100,
    renewal_cost: 12, renewal_cycle: 1, renewal_count: 0,
    baseline_renewal_as_of: null, expiry_date: '2027-03-01',
    status: 'active', estimated_value: 0, tags: [], ...over,
  }) as unknown as DomainWithTags;

const tx = (over: Record<string, unknown>) =>
  ({
    id: `t${Math.random()}`, domain_id: 'd1', type: 'fee', amount: 10,
    currency: 'USD', date: '2025-06-01', ...over,
  }) as unknown as TransactionWithRequiredFields;

describe('按年按科目拆分', () => {
  it('各类支出落到自己的科目和年份', () => {
    const { rows } = annualExpenses(
      [dom({ purchase_cost: 0 })],
      [
        tx({ type: 'buy', amount: 500, date: '2025-02-01' }),
        tx({ type: 'transfer', amount: 9, date: '2025-05-01' }),
        tx({ type: 'fee', amount: 20, date: '2025-07-01' }),
        tx({ type: 'marketing', amount: 30, date: '2026-01-01' }),
        tx({ type: 'advertising', amount: 40, date: '2026-02-01' }),
      ],
      UNTIL
    );
    expect(rows.map((r) => r.year)).toEqual([2025, 2026]);
    expect(rows[0].byCategory.purchase).toBe(500);
    expect(rows[0].byCategory.transfer).toBe(9);
    expect(rows[0].byCategory.fee).toBe(20);
    expect(rows[1].byCategory.marketing).toBe(30);
    expect(rows[1].byCategory.advertising).toBe(40);
  });

  it('sell 不是支出，不出现在表里', () => {
    const { totals } = annualExpenses(
      [dom({ purchase_cost: 0 })],
      [tx({ type: 'sell', amount: 99999, date: '2025-06-01' })],
      UNTIL
    );
    expect(totals.total).toBe(0);
  });

  it('total 等于各科目之和；合计行等于各年之和', () => {
    const { rows, totals } = annualExpenses(
      [dom({ purchase_cost: 0 })],
      [
        tx({ type: 'buy', amount: 500, date: '2025-02-01' }),
        tx({ type: 'fee', amount: 20, date: '2026-07-01' }),
      ],
      UNTIL
    );
    for (const r of rows) {
      expect(r.total).toBe(EXPENSE_CATEGORIES.reduce((s, c) => s + r.byCategory[c], 0));
    }
    expect(totals.total).toBe(rows.reduce((s, r) => s + r.total, 0));
  });
});

describe('购入的双算防护', () => {
  it('有 buy 交易时不再用 purchase_cost 兜底', () => {
    // 判据是「有没有 buy 交易」而不是「当年有没有」——否则记在别的年份的 buy
    // 和 purchase_cost 会同时进账，同一次购入算两次
    const { totals } = annualExpenses(
      [dom({ purchase_cost: 100, purchase_date: '2025-03-01' })],
      [tx({ type: 'buy', amount: 500, date: '2024-12-01' })],
      UNTIL
    );
    expect(totals.byCategory.purchase).toBe(500);
  });

  it('没有 buy 交易时用 purchase_cost，落在购入年', () => {
    const { rows } = annualExpenses([dom({ purchase_cost: 100 })], [], UNTIL);
    expect(rows[0].year).toBe(2025);
    expect(rows[0].byCategory.purchase).toBe(100);
    expect(rows[0].hasArchiveDerived).toBe(true);
  });
});

describe('续费只算一次', () => {
  it('renew 交易不会既进事件流又按类型加一遍', () => {
    const { totals } = annualExpenses(
      [dom({ purchase_cost: 0, renewal_count: 1 })],
      [tx({ type: 'renew', amount: 15, date: '2026-03-01' })],
      UNTIL
    );
    // 双算的话会是 30
    expect(totals.byCategory.renewal).toBe(15);
  });

  it('projected 续费不计——那是还没发生的', () => {
    const { totals } = annualExpenses(
      [dom({ purchase_cost: 0, renewal_count: 0, expiry_date: '2027-03-01' })],
      [],
      UNTIL
    );
    expect(totals.byCategory.renewal).toBe(0);
  });
});

describe('凭证覆盖', () => {
  it('数出有多少笔支出挂了凭证', () => {
    const { rows } = annualExpenses(
      [dom({ purchase_cost: 0 })],
      [
        tx({ type: 'fee', amount: 10, date: '2025-06-01', receipt_url: 'https://e.com/a.pdf' }),
        tx({ type: 'fee', amount: 20, date: '2025-07-01' }),
        tx({ type: 'fee', amount: 30, date: '2025-08-01', receipt_url: '   ' }),
      ],
      UNTIL
    );
    expect(rows[0].transactionCount).toBe(3);
    expect(rows[0].withReceiptCount).toBe(1); // 空白不算填了
  });

  it('档案来源的金额没有交易行，不进笔数', () => {
    // purchase_cost 兜底和档案续费都没有凭证可挂，hasArchiveDerived 让 UI
    // 能解释为什么凭证数对不上金额
    const { rows } = annualExpenses([dom({ purchase_cost: 100 })], [], UNTIL);
    expect(rows[0].transactionCount).toBe(0);
    expect(rows[0].byCategory.purchase).toBe(100);
    expect(rows[0].hasArchiveDerived).toBe(true);
  });
});

describe('跟 computeMonthlyOutflow 对拍', () => {
  // 这两个读的是同一批钱。漂了就是"同一批数据两个支出总额"。
  const domains = [
    dom({ id: 'a', purchase_cost: 100, purchase_date: '2025-03-01', renewal_count: 2 }),
    dom({ id: 'b', purchase_cost: 0, purchase_date: '2025-08-01', renewal_count: 0 }),
  ];
  const txs = [
    tx({ domain_id: 'b', type: 'buy', amount: 700, date: '2025-08-01' }),
    tx({ domain_id: 'a', type: 'renew', amount: 15, date: '2026-03-01' }),
    tx({ domain_id: 'a', type: 'transfer', amount: 9, date: '2026-04-01' }),
    tx({ domain_id: 'b', type: 'fee', amount: 25, date: '2026-05-01' }),
    tx({ domain_id: 'b', type: 'marketing', amount: 50, date: '2026-06-01' }),
  ];

  it('总支出一致', () => {
    const { totals } = annualExpenses(domains, txs, UNTIL);
    const { purchaseByMonth, renewalByMonth, otherByMonth } = computeMonthlyOutflow(
      domains, txs, UNTIL
    );
    const sum = (m: Map<string, number>) => [...m.values()].reduce((s, v) => s + v, 0);
    expect(totals.total).toBeCloseTo(sum(purchaseByMonth) + sum(renewalByMonth) + sum(otherByMonth), 6);
  });

  it('购入和续费两个科目分别一致', () => {
    const { totals } = annualExpenses(domains, txs, UNTIL);
    const { purchaseByMonth, renewalByMonth } = computeMonthlyOutflow(domains, txs, UNTIL);
    const sum = (m: Map<string, number>) => [...m.values()].reduce((s, v) => s + v, 0);
    expect(totals.byCategory.purchase).toBeCloseTo(sum(purchaseByMonth), 6);
    expect(totals.byCategory.renewal).toBeCloseTo(sum(renewalByMonth), 6);
  });

  it('其余科目加起来等于 otherByMonth', () => {
    const { totals } = annualExpenses(domains, txs, UNTIL);
    const { otherByMonth } = computeMonthlyOutflow(domains, txs, UNTIL);
    const sum = (m: Map<string, number>) => [...m.values()].reduce((s, v) => s + v, 0);
    const other =
      totals.byCategory.transfer + totals.byCategory.fee +
      totals.byCategory.marketing + totals.byCategory.advertising;
    expect(other).toBeCloseTo(sum(otherByMonth), 6);
  });
});
