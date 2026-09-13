import { describe, it, expect } from 'vitest';
import { insightsKPISummary } from './realizedPnL';
import type { DomainWithTags, TransactionWithRequiredFields } from '../types/dashboard';

const dom = (id: string, cost: number) =>
  ({
    id, domain_name: `${id}.com`, registrar: 'NC', purchase_date: '2025-01-10',
    purchase_cost: cost, renewal_cost: 0, renewal_cycle: 1, renewal_count: 0,
    expiry_date: '2027-01-10', status: 'active', estimated_value: 0, tags: [],
  }) as unknown as DomainWithTags;

const sell = (id: string, domainId: string, amount: number, date: string) =>
  ({
    id, domain_id: domainId, type: 'sell', amount, net_amount: amount,
    platform_fee: 0, currency: 'USD', date, payment_plan: 'lump_sum',
  }) as unknown as TransactionWithRequiredFields;

describe('insightsKPISummary — success rate', () => {
  it('分母是域名数：买 4 个卖 1 个赚钱 → 25%', () => {
    const domains = [dom('a', 10), dom('b', 10), dom('c', 10), dom('d', 10)];
    const k = insightsKPISummary(domains, [sell('t1', 'a', 500, '2026-02-01')]);
    expect(k.successRate).toEqual({ percent: 25, wins: 1, total: 4 });
  });

  it('同一个域名卖两次都赚钱，也只算一个成功的域名（不能超过 100%）', () => {
    // 分期中断 → 域名回到 active → 重新卖出，两笔 sell 都留在账上
    const domains = [dom('twice', 10)];
    const txs = [
      sell('t1', 'twice', 300, '2026-02-01'),
      sell('t2', 'twice', 400, '2026-08-01'),
    ];
    const k = insightsKPISummary(domains, txs);
    expect(k.successRate?.wins).toBe(1);
    expect(k.successRate?.percent).toBe(100);
    expect(k.successRate!.percent).toBeLessThanOrEqual(100);
  });
});
