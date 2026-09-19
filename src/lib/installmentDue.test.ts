import { describe, it, expect } from 'vitest';
import { getActiveInstallmentSummary, getReceiptsDueSoon } from './installmentDue';
import type { DomainWithTags, TransactionWithRequiredFields } from '../types/dashboard';
import type { InstallmentReceipt } from '../types/transaction';
import { localCalendarDateISO } from './localCalendarDate';

function makeDomain(id: string, name: string): DomainWithTags {
  return {
    id,
    user_id: 'u1',
    domain_name: name,
    status: 'sold',
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
  } as DomainWithTags;
}

function makeInstallmentSell(overrides: Partial<TransactionWithRequiredFields> = {}): TransactionWithRequiredFields {
  return {
    id: 'tx-1',
    domain_id: 'd1',
    type: 'sell',
    amount: 12000,
    currency: 'USD',
    date: '2025-01-15',
    payment_plan: 'installment',
    installment_period: 12,
    installment_amount: 1000,
    installment_status: 'active',
    installment_first_payment_date: '2025-02-15',
    receipts: [],
    created_at: '',
    updated_at: '',
    ...overrides,
  };
}

function receipt(date: string): InstallmentReceipt {
  return {
    id: `r-${date}`,
    transaction_id: 'tx-1',
    received_date: date,
    amount: 1000,
  };
}

describe('getActiveInstallmentSummary', () => {
  it('returns null when no installment sell exists', () => {
    expect(getActiveInstallmentSummary(makeDomain('d1', 'foo.com'), [])).toBeNull();
  });

  it('returns null when status is cancelled', () => {
    const summary = getActiveInstallmentSummary(makeDomain('d1', 'foo.com'), [
      makeInstallmentSell({ installment_status: 'cancelled' }),
    ]);
    expect(summary).toBeNull();
  });

  it('returns null when receipts == period (silently completed)', () => {
    const tx = makeInstallmentSell({
      installment_period: 3,
      receipts: [receipt('2025-02-15'), receipt('2025-03-15'), receipt('2025-04-15')],
    });
    expect(getActiveInstallmentSummary(makeDomain('d1', 'foo.com'), [tx])).toBeNull();
  });

  it('next due = last receipt + 1 month when receipts present', () => {
    const tx = makeInstallmentSell({
      receipts: [receipt('2025-02-15'), receipt('2025-03-15')],
    });
    const summary = getActiveInstallmentSummary(makeDomain('d1', 'foo.com'), [tx]);
    expect(summary).not.toBeNull();
    expect(summary!.paid).toBe(2);
    expect(summary!.total).toBe(12);
    expect(summary!.nextDue ? localCalendarDateISO(summary!.nextDue) : null).toBe('2025-04-15');
  });

  it('next due = installment_first_payment_date when no receipts yet', () => {
    const tx = makeInstallmentSell({ receipts: [], installment_first_payment_date: '2025-02-15' });
    const summary = getActiveInstallmentSummary(makeDomain('d1', 'foo.com'), [tx]);
    expect(summary!.nextDue ? localCalendarDateISO(summary!.nextDue) : null).toBe('2025-02-15');
  });

  it('next due = null when receipts empty and first_payment_date not set', () => {
    const tx = makeInstallmentSell({ receipts: [], installment_first_payment_date: null });
    const summary = getActiveInstallmentSummary(makeDomain('d1', 'foo.com'), [tx]);
    expect(summary!.nextDue).toBeNull();
  });
});

describe('getReceiptsDueSoon', () => {
  // 本地瞬间而不是 'Z'：日期列按本地日历日解析，用 UTC 瞬间当 now 会让
  // 断言在 UTC+14 / UTC-11 这类极端偏移下落到相邻的一天上。
  const now = new Date(2025, 3, 15, 12, 0, 0);

  it('includes receipts due within +7 days', () => {
    const tx = makeInstallmentSell({ receipts: [receipt('2025-03-20')] }); // next = 2025-04-20
    const list = getReceiptsDueSoon([makeDomain('d1', 'foo.com')], [tx], now);
    expect(list).toHaveLength(1);
  });

  it('includes receipts overdue by up to 3 days (grace window)', () => {
    const tx = makeInstallmentSell({ receipts: [receipt('2025-03-12')] }); // next = 2025-04-12 (3 days ago)
    const list = getReceiptsDueSoon([makeDomain('d1', 'foo.com')], [tx], now);
    expect(list).toHaveLength(1);
  });

  it('excludes receipts overdue beyond grace', () => {
    const tx = makeInstallmentSell({ receipts: [receipt('2025-03-01')] }); // next = 2025-04-01 (14 days ago)
    const list = getReceiptsDueSoon([makeDomain('d1', 'foo.com')], [tx], now);
    expect(list).toHaveLength(0);
  });

  it('excludes receipts due far in the future', () => {
    const tx = makeInstallmentSell({ receipts: [receipt('2025-05-15')] }); // next = 2025-06-15
    const list = getReceiptsDueSoon([makeDomain('d1', 'foo.com')], [tx], now);
    expect(list).toHaveLength(0);
  });

  it('sorts results by nearest-due first', () => {
    const tx1 = makeInstallmentSell({ id: 'tx-1', domain_id: 'd1', receipts: [receipt('2025-03-19')] }); // 2025-04-19
    const tx2 = makeInstallmentSell({ id: 'tx-2', domain_id: 'd2', receipts: [receipt('2025-03-16')] }); // 2025-04-16
    const list = getReceiptsDueSoon(
      [makeDomain('d1', 'a.com'), makeDomain('d2', 'b.com')],
      [tx1, tx2],
      now
    );
    expect(list.map((s) => s.domain.id)).toEqual(['d2', 'd1']);
  });
});

/**
 * 下一期到账日的月末溢出。
 *
 * 裸 `d.setMonth(d.getMonth() + 1)`：1 月 31 日 + 1 个月 = 3 月 3 日（2 月没有
 * 31 号，JS 往后顺延）。每月 29–31 号收款的分期会莫名其妙跳过 2 月。
 */
describe('nextDue 的月末处理', () => {
  const soldDomain = { id: 'd1', domain_name: 'x.com', status: 'sold' } as never;

  const txWith = (receivedDate: string) => ([{
    id: 't1', domain_id: 'd1', type: 'sell', payment_plan: 'installment',
    installment_period: 24, installment_status: 'active',
    amount: 24000, net_amount: 24000, platform_fee: 0, date: '2026-01-05',
    receipts: [{ id: 'r1', received_date: receivedDate, amount: 1000 }],
  }] as never);

  const nextDueOf = (receivedDate: string) =>
    getActiveInstallmentSummary(soldDomain, txWith(receivedDate))?.nextDue;

  it('1 月 31 日的下一期落在 2 月 28/29，而不是顺延到 3 月', () => {
    const d = nextDueOf('2026-01-31')!;
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(1); // 2 月
    expect(d.getDate()).toBe(28); // 2026 不是闰年
  });

  it('闰年夹到 2 月 29', () => {
    const d = nextDueOf('2028-01-31')!;
    expect(d.getMonth()).toBe(1);
    expect(d.getDate()).toBe(29);
  });

  it('月份天数够用时日期原样保留', () => {
    const d = nextDueOf('2026-03-31')!;
    expect(d.getMonth()).toBe(3); // 4 月
    expect(d.getDate()).toBe(30); // 4 月只有 30 天
    const e = nextDueOf('2026-05-15')!;
    expect(e.getMonth()).toBe(5);
    expect(e.getDate()).toBe(15);
  });

  it('跨年', () => {
    const d = nextDueOf('2026-12-31')!;
    expect(d.getFullYear()).toBe(2027);
    expect(d.getMonth()).toBe(0);
    expect(d.getDate()).toBe(31);
  });
});
