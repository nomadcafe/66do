/**
 * 年度现金流里分期销售的归属年份守卫。
 *
 * 一笔 2025-11 成交、分 24 期收的销售，钱是从 2025-12 起一个月一笔进来的。
 * 年表以前按 sell 交易自己的日期整笔落在 2025，于是 2025 虚高一整笔、
 * 2026 之后明明在收钱却显示 0 —— 同一批数据，月度净现金流图（走
 * expandSellToCashReceipts）和这张年表对不上。
 */
import { describe, it, expect } from 'vitest';
import { calculateYearlyRenewalVsProfit, expandSellToCashReceipts } from './coreCalculations';
import type { DomainWithTags } from '../types/dashboard';
import type { TransactionWithRequiredFields } from '../types/transaction';

const domain = { 
  id: 'd1',
  domain_name: 'example.com',
  registrar: 'Namecheap',
  purchase_date: '2025-01-10',
  purchase_cost: 0,
  renewal_cost: 0,
  renewal_cycle: 1,
  renewal_count: 0,
  expiry_date: '2027-01-10',
  status: 'sold',
  estimated_value: 0,
  tags: [],
} as unknown as DomainWithTags;

/** 2025-11 成交 $24,000，无平台费，无首付，每月 $1,000 —— 2025 收 1 期，2026 收 12 期 */
function installmentSale(receiptMonths: string[]): TransactionWithRequiredFields {
  return {
    id: 't1',
    domain_id: 'd1',
    type: 'sell',
    amount: 24000,
    net_amount: 24000,
    platform_fee: 0,
    currency: 'USD',
    date: '2025-11-20',
    payment_plan: 'installment',
    installment_period: 24,
    downpayment_amount: 0,
    installment_amount: 1000,
    installment_status: 'active',
    receipts: receiptMonths.map((m, i) => ({
      id: `r${i}`,
      received_date: `${m}-15`,
      amount: 1000,
    })),
  } as unknown as TransactionWithRequiredFields;
}

const rowFor = (rows: ReturnType<typeof calculateYearlyRenewalVsProfit>, year: number) =>
  rows.find((r) => r.year === year);

describe('年度现金流 — 分期销售按到账年份归集', () => {
  const tx = installmentSale([
    '2025-12',
    ...Array.from({ length: 12 }, (_, i) => `2026-${String(i + 1).padStart(2, '0')}`),
  ]);

  it('只把当年真正收到的期数算进当年', () => {
    const rows = calculateYearlyRenewalVsProfit([tx], [domain], new Date(2026, 11, 31));
    expect(rowFor(rows, 2025)?.saleNet).toBe(1000);
    expect(rowFor(rows, 2026)?.saleNet).toBe(12000);
  });

  it('与月度现金流用的同一个展开口径逐位相等', () => {
    const byYear = new Map<number, number>();
    for (const ev of expandSellToCashReceipts(tx)) {
      const y = Number(ev.monthKey.slice(0, 4));
      byYear.set(y, (byYear.get(y) ?? 0) + ev.netAmount);
    }
    const rows = calculateYearlyRenewalVsProfit([tx], [domain], new Date(2026, 11, 31));
    for (const [y, expected] of byYear) {
      expect(rowFor(rows, y)?.saleNet).toBeCloseTo(expected, 6);
    }
  });

  it('首付计入成交当月所在的年', () => {
    const withDown = {
      ...installmentSale(['2026-01']),
      downpayment_amount: 5000,
    } as TransactionWithRequiredFields;
    const rows = calculateYearlyRenewalVsProfit([withDown], [domain], new Date(2026, 11, 31));
    expect(rowFor(rows, 2025)?.saleNet).toBe(5000);
    expect(rowFor(rows, 2026)?.saleNet).toBe(1000);
  });

  it('一次性付款不受影响，仍整笔落在成交年', () => {
    const lump = {
      ...installmentSale([]),
      payment_plan: 'lump_sum',
      receipts: [],
      platform_fee: 4000,
      net_amount: 20000,
    } as unknown as TransactionWithRequiredFields;
    const rows = calculateYearlyRenewalVsProfit([lump], [domain], new Date(2026, 11, 31));
    expect(rowFor(rows, 2025)?.saleNet).toBe(20000);
    expect(rowFor(rows, 2026)).toBeUndefined();
  });

  it('平台费按比例摊到每一期，而不是全压在成交年', () => {
    const withFee = {
      ...installmentSale(['2025-12', '2026-01']),
      platform_fee: 2400, // 10%
      net_amount: 21600,
    } as unknown as TransactionWithRequiredFields;
    const rows = calculateYearlyRenewalVsProfit([withFee], [domain], new Date(2026, 11, 31));
    expect(rowFor(rows, 2025)?.saleNet).toBeCloseTo(900, 6);
    expect(rowFor(rows, 2026)?.saleNet).toBeCloseTo(900, 6);
  });
});
