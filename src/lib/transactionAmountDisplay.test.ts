/**
 * 「一笔交易显示多少钱」的三处调用方（交易列表行 / 域名表格展开行 / 周报
 * 最近动态）必须给出同一个答案。合并前三份各有各的毛病。
 */
import { describe, it, expect } from 'vitest';
import { transactionAmountDisplay } from './transactionAmountDisplay';
import type { TransactionWithRequiredFields } from '../types/transaction';

const tx = (over: Partial<TransactionWithRequiredFields> = {}) =>
  ({
    id: 't1',
    domain_id: 'd1',
    type: 'sell',
    amount: 50000,
    net_amount: 50000,
    platform_fee: 0,
    currency: 'USD',
    date: '2026-03-01',
    payment_plan: 'lump_sum',
    ...over,
  }) as unknown as TransactionWithRequiredFields;

describe('transactionAmountDisplay', () => {
  it('出售带 +，支出类带 −', () => {
    expect(transactionAmountDisplay(tx()).sign).toBe('+');
    expect(transactionAmountDisplay(tx({ type: 'buy', amount: 1200 })).sign).toBe('-');
    expect(transactionAmountDisplay(tx({ type: 'renew', amount: 12 })).sign).toBe('-');
  });

  it('金额为 0 时不标方向 —— 免费 transfer 不该写成「−$0.00」', () => {
    expect(transactionAmountDisplay(tx({ type: 'transfer', amount: 0 })).sign).toBe('');
    expect(transactionAmountDisplay(tx({ type: 'transfer', amount: 0 })).amount).toBe(0);
  });

  it('传了折算副本时用已收额，并把合同金额作为「标价」带出来', () => {
    const raw = tx({ payment_plan: 'installment' });
    const adjusted = tx({ payment_plan: 'installment', amount: 10000, net_amount: 10000 });
    const d = transactionAmountDisplay(raw, adjusted);
    expect(d.amount).toBe(10000);
    expect(d.listed).toBe(50000);
    expect(d.sign).toBe('+');
  });

  it('不传折算副本时退回账面金额，listed 为 null（合并前的行为）', () => {
    const d = transactionAmountDisplay(tx({ payment_plan: 'installment' }));
    expect(d.amount).toBe(50000);
    expect(d.listed).toBeNull();
  });

  it('折算后和账面一致时不摆「标价」小字', () => {
    const raw = tx();
    const same = tx();
    expect(transactionAmountDisplay(raw, same).listed).toBeNull();
  });

  it('非出售类型不做折算拆分，即使副本金额不同', () => {
    const raw = tx({ type: 'buy', amount: 1200 });
    const other = tx({ type: 'buy', amount: 999 });
    const d = transactionAmountDisplay(raw, other);
    expect(d.amount).toBe(1200);
    expect(d.listed).toBeNull();
  });
});
