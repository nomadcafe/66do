/**
 * 「按金额排序」必须用行上显示的那个数。
 *
 * 分期出售在这个列表里显示的是按已收折算后的金额（父组件传进来的
 * metricsTransactions），上方 KPI 条也按折算值求和——只有排序漏了，
 * 拿的是库里的原始 amount。
 */
import { describe, it, expect } from 'vitest';
import { sortTransactionsForList } from './TransactionList';
import type { TransactionWithRequiredFields } from '../../types/dashboard';

const tx = (
  id: string,
  amount: number,
  over: Partial<TransactionWithRequiredFields> = {}
): TransactionWithRequiredFields =>
  ({
    id,
    domain_id: `dom-${id}`,
    type: 'sell',
    amount,
    net_amount: amount,
    platform_fee: 0,
    currency: 'USD',
    date: '2026-05-01',
    payment_plan: 'lump_sum',
    ...over,
  }) as unknown as TransactionWithRequiredFields;

const idsOf = (list: TransactionWithRequiredFields[]) => list.map((t) => t.id);

describe('sortTransactionsForList', () => {
  // 标价 $50,000 的分期，实际只收到 $10,000
  const listed = [tx('installment', 50000, { payment_plan: 'installment' }), tx('small', 900), tx('mid', 20000)];
  const metricsById = new Map([
    ['installment', tx('installment', 10000, { payment_plan: 'installment' })],
    ['small', tx('small', 900)],
    ['mid', tx('mid', 20000)],
  ]);

  it('分期按已收折算后的金额参与排序，而不是标价', () => {
    const desc = sortTransactionsForList(listed, { sortField: 'amount', sortDir: 'desc', metricsById });
    // 显示值：mid $20,000 > installment $10,000 > small $900
    expect(idsOf(desc)).toEqual(['mid', 'installment', 'small']);
  });

  it('升序是降序的反向', () => {
    const asc = sortTransactionsForList(listed, { sortField: 'amount', sortDir: 'asc', metricsById });
    expect(idsOf(asc)).toEqual(['small', 'installment', 'mid']);
  });

  it('没有折算数据时回退到原始金额', () => {
    const desc = sortTransactionsForList(listed, {
      sortField: 'amount',
      sortDir: 'desc',
      metricsById: new Map(),
    });
    expect(idsOf(desc)).toEqual(['installment', 'mid', 'small']);
  });

  it('按日期和类型排序不受折算影响', () => {
    const rows = [
      tx('a', 1, { date: '2026-01-01', type: 'sell' }),
      tx('b', 2, { date: '2026-03-01', type: 'buy' }),
      tx('c', 3, { date: '2026-02-01', type: 'renew' }),
    ];
    expect(idsOf(sortTransactionsForList(rows, { sortField: 'date', sortDir: 'asc', metricsById: new Map() })))
      .toEqual(['a', 'c', 'b']);
    expect(idsOf(sortTransactionsForList(rows, { sortField: 'type', sortDir: 'asc', metricsById: new Map() })))
      .toEqual(['b', 'c', 'a']);
  });

  it('不就地改动传入的数组', () => {
    const rows = [tx('x', 1), tx('y', 9)];
    const before = idsOf(rows);
    sortTransactionsForList(rows, { sortField: 'amount', sortDir: 'desc', metricsById: new Map() });
    expect(idsOf(rows)).toEqual(before);
  });
});
