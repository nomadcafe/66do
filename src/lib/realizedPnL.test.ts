import { describe, it, expect } from 'vitest';
import {
  tradeOutcomes,
  realizedROI,
  realizedROIFromTrades,
  totalRealizedPnL,
  realizedPnLByMonth,
} from './realizedPnL';
import { calculateBasicFinancialMetrics } from './coreCalculations';
import type { DomainWithTags } from '../types/dashboard';
import type { TransactionWithRequiredFields } from '../types/transaction';

function domain(over: Partial<DomainWithTags> & { id: string }): DomainWithTags {
  return {
    domain_name: `${over.id}.com`,
    registrar: 'Namecheap',
    purchase_date: '2024-01-10',
    purchase_cost: 100,
    renewal_cost: 0,
    renewal_cycle: 1,
    renewal_count: 0,
    status: 'sold',
    estimated_value: 0,
    tags: [],
    ...over,
  } as DomainWithTags;
}

function sell(
  over: Partial<TransactionWithRequiredFields> & { id: string; domain_id: string; date: string }
): TransactionWithRequiredFields {
  return {
    type: 'sell',
    amount: 0,
    currency: 'USD',
    created_at: '',
    updated_at: '',
    ...over,
  } as TransactionWithRequiredFields;
}

const ASOF = new Date(2026, 8, 6);

describe('净额 <= 0 的成交不再被静默丢弃', () => {
  // 回归：这类成交（白送、平台费吃光、记了退款）是真实完成的交易，
  // profit = sellNet − costBasis 是实打实的亏损。以前四个函数一律 continue，
  // 于是 Total Revenue 认这笔、Top Performers / Realized ROI / Realized P&L
  // 都不认，亏得最狠的那笔还永远当不上 worst sale。
  const domains = [domain({ id: 'giveaway', purchase_cost: 250 })];
  const txs = [sell({ id: 's1', domain_id: 'giveaway', date: '2025-05-20', amount: 0 })];

  it('进入 tradeOutcomes，profit 是整笔成本的亏损', () => {
    const trades = tradeOutcomes(domains, txs);
    expect(trades).toHaveLength(1);
    expect(trades[0].sellNet).toBe(0);
    expect(trades[0].profit).toBe(-250);
    expect(trades[0].roi).toBeCloseTo(-100, 9);
  });

  it('拉低 realized ROI，而不是被排除在分母外', () => {
    expect(realizedROI(domains, txs)).toBeCloseTo(-100, 9);
  });

  it('整笔落在成交月，不做到账分摊（share 的分母就是 sellNet）', () => {
    const byMonth = realizedPnLByMonth(domains, txs);
    expect(byMonth.get('2025-05')).toBe(-250);
    expect([...byMonth.values()].every((v) => Number.isFinite(v))).toBe(true);
    expect(totalRealizedPnL(domains, txs, ASOF)).toBe(-250);
  });

  it('asOf 早于成交月时不计入', () => {
    expect(totalRealizedPnL(domains, txs, new Date(2025, 0, 1))).toBe(0);
  });

  it('平台费吃光毛额（净额为负）同样算一笔亏损', () => {
    const d = [domain({ id: 'eaten', purchase_cost: 50 })];
    const t = [
      sell({ id: 's2', domain_id: 'eaten', date: '2025-07-01', amount: 100, platform_fee: 140 }),
    ];
    const trades = tradeOutcomes(d, t);
    expect(trades[0].sellNet).toBe(-40);
    expect(trades[0].profit).toBe(-90);
    expect(realizedPnLByMonth(d, t).get('2025-07')).toBe(-90);
  });

  it('与 totalRevenue 口径一致——两边都认这笔成交', () => {
    // 这是这组改动要守住的不变式：Total Revenue 从来不过滤净额 <= 0 的成交，
    // Realized 那一族以前过滤，同一屏上两个数字对不上。
    const basic = calculateBasicFinancialMetrics(domains, txs);
    const trades = tradeOutcomes(domains, txs);
    expect(basic.totalRevenue).toBe(0);
    expect(trades.map((tr) => tr.sellNet).reduce((s, v) => s + v, 0)).toBe(basic.totalRevenue);
  });
});

describe('正常成交的行为没有变', () => {
  const domains = [domain({ id: 'win', purchase_cost: 100 })];
  const txs = [sell({ id: 's1', domain_id: 'win', date: '2025-06-10', amount: 1100 })];

  it('profit / roi / 按月分摊都不受影响', () => {
    const trades = tradeOutcomes(domains, txs);
    expect(trades[0].profit).toBe(1000);
    expect(trades[0].roi).toBeCloseTo(1000, 9);
    expect(realizedPnLByMonth(domains, txs).get('2025-06')).toBeCloseTo(1000, 9);
    expect(totalRealizedPnL(domains, txs, ASOF)).toBeCloseTo(1000, 9);
  });
});

describe('realizedROIFromTrades', () => {
  it('与 realizedROI 给出同一个数', () => {
    // 两者原本是同一个循环写了两遍，改成后者由前者归约，杜绝各自漂移。
    const domains = [
      domain({ id: 'a', purchase_cost: 100 }),
      domain({ id: 'b', purchase_cost: 200 }),
      domain({ id: 'free', purchase_cost: 0 }),
    ];
    const txs = [
      sell({ id: 's1', domain_id: 'a', date: '2025-02-01', amount: 300 }),
      sell({ id: 's2', domain_id: 'b', date: '2025-03-01', amount: 150 }),
      sell({ id: 's3', domain_id: 'free', date: '2025-04-01', amount: 90 }),
    ];

    const trades = tradeOutcomes(domains, txs);
    expect(realizedROIFromTrades(trades)).toBe(realizedROI(domains, txs));
    // (200 − 50 + 90) / (100 + 200 + 0)
    expect(realizedROIFromTrades(trades)).toBeCloseTo((240 / 300) * 100, 9);
  });

  it('没有任何已售域名时返回 0，不是 NaN', () => {
    expect(realizedROIFromTrades([])).toBe(0);
  });
});
