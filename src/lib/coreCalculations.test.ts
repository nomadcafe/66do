import { describe, it, expect } from 'vitest';
import { expandSellToCashReceipts } from './coreCalculations';
import type { TransactionWithRequiredFields, InstallmentReceipt } from '../types/transaction';

function buildSell(overrides: Partial<TransactionWithRequiredFields> = {}): TransactionWithRequiredFields {
  return {
    id: 'tx-1',
    domain_id: 'd1',
    type: 'sell',
    amount: 12000,
    currency: 'USD',
    date: '2025-01-15',
    created_at: '',
    updated_at: '',
    platform_fee: 0,
    net_amount: 12000,
    payment_plan: 'lump_sum',
    ...overrides,
  };
}

function receipt(date: string, amount: number, period_no?: number): InstallmentReceipt {
  return {
    id: `r-${date}-${amount}`,
    transaction_id: 'tx-1',
    received_date: date,
    amount,
    period_no: period_no ?? null,
  };
}

describe('expandSellToCashReceipts', () => {
  it('lump sum: returns a single event at tx.date with full sellNetUSD', () => {
    const events = expandSellToCashReceipts(buildSell());
    expect(events).toHaveLength(1);
    expect(events[0].monthKey).toBe('2025-01');
    expect(events[0].netAmount).toBe(12000);
  });

  it('installment with no receipts and no downpayment: falls back to lump-sum-like single event so reports do not lose the sell', () => {
    const events = expandSellToCashReceipts(buildSell({
      payment_plan: 'installment',
      installment_period: 12,
      installment_amount: 1000,
      receipts: [],
    }));
    expect(events).toHaveLength(1);
    expect(events[0].monthKey).toBe('2025-01');
  });

  it('installment with downpayment + 3 receipts in different months: emits 4 events on the right months', () => {
    const events = expandSellToCashReceipts(buildSell({
      payment_plan: 'installment',
      installment_period: 12,
      installment_amount: 1000,
      downpayment_amount: 2000,
      platform_fee: 0,
      net_amount: 12000,
      receipts: [
        receipt('2025-02-15', 1000, 1),
        receipt('2025-03-20', 1000, 2),
        receipt('2025-04-10', 1000, 3),
      ],
    }));
    expect(events).toHaveLength(4);
    expect(events.map((e) => e.monthKey)).toEqual([
      '2025-01', // downpayment
      '2025-02',
      '2025-03',
      '2025-04',
    ]);
    // No platform fee on this fixture, so net == gross per event.
    expect(events.map((e) => e.netAmount)).toEqual([2000, 1000, 1000, 1000]);
  });

  it('installment with platform fee: scales each event by (1 - feeRate)', () => {
    const events = expandSellToCashReceipts(buildSell({
      payment_plan: 'installment',
      installment_period: 12,
      installment_amount: 1000,
      downpayment_amount: 0,
      platform_fee: 1200,
      net_amount: 10800,
      amount: 12000,
      receipts: [receipt('2025-02-15', 1000)],
    }));
    expect(events).toHaveLength(1);
    expect(events[0].monthKey).toBe('2025-02');
    // feeRate = 1200 / 12000 = 10% → net = 1000 * 0.9 = 900
    expect(events[0].netAmount).toBeCloseTo(900, 6);
  });

  it('negative receipt (refund): emits a negative-net event in that month', () => {
    const events = expandSellToCashReceipts(buildSell({
      payment_plan: 'installment',
      installment_period: 12,
      installment_amount: 1000,
      receipts: [
        receipt('2025-02-15', 1000),
        receipt('2025-04-01', -500),
      ],
    }));
    expect(events).toHaveLength(2);
    expect(events[1].monthKey).toBe('2025-04');
    expect(events[1].netAmount).toBeLessThan(0);
  });

  it('non-sell transaction: returns empty', () => {
    const events = expandSellToCashReceipts(buildSell({ type: 'buy' as 'sell' }));
    expect(events).toEqual([]);
  });
});
