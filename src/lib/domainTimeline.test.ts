/**
 * 时间线要把「钱花在哪了」说全。
 *
 * 原来只列 renew 交易。而 CSV 导入的域名通常只填了 renewal_count +
 * renewal_cost、一条 renew 交易都没有——这条时间线上「购入 → 出售」中间
 * 一片空白，可那几次续费明明都进了持有成本。
 */
import { describe, it, expect } from 'vitest';
import { buildDomainTimelineEvents } from './domainTimeline';
import type { DomainWithTags } from '../types/dashboard';
import type { TransactionWithRequiredFields } from '../types/transaction';

const domain = (over: Partial<DomainWithTags> = {}) =>
  ({
    id: 'd1',
    domain_name: 'example.com',
    registrar: 'NC',
    purchase_date: '2020-03-01',
    purchase_cost: 100,
    renewal_cost: 12,
    renewal_cycle: 1,
    renewal_count: 0,
    expiry_date: '2026-03-01',
    status: 'active',
    estimated_value: 0,
    tags: [],
    ...over,
  }) as unknown as DomainWithTags;

const renewTx = (id: string, date: string, amount: number) =>
  ({
    id, domain_id: 'd1', type: 'renew', amount, net_amount: amount,
    platform_fee: 0, currency: 'USD', date,
  }) as unknown as TransactionWithRequiredFields;

const renewEvents = (d: DomainWithTags, txs: TransactionWithRequiredFields[]) =>
  buildDomainTimelineEvents(d, txs).filter((e) => e.kind === 'renew');

describe('buildDomainTimelineEvents — 续费', () => {
  it('只填了 renewal_count 的域名也能看到续费事件（以前是空白）', () => {
    const d = domain({ renewal_count: 3 });
    const events = renewEvents(d, []);
    expect(events).toHaveLength(3);
    // 档案续费没有对应交易，点不进去编辑，UI 上标为估算
    expect(events.every((e) => e.transaction === null)).toBe(true);
    expect(events.every((e) => e.amount === 12)).toBe(true);
  });

  it('renew 交易照常可点进去编辑', () => {
    const d = domain({ renewal_count: 1 });
    const tx = renewTx('t1', '2024-03-01', 15);
    const events = renewEvents(d, [tx]);
    expect(events).toHaveLength(1);
    expect(events[0].transaction?.id).toBe('t1');
    expect(events[0].amount).toBe(15);
  });

  it('交易和档案混合时不重复计数：3 次续费里有 1 条交易 → 1 真 + 2 估', () => {
    const d = domain({ renewal_count: 3 });
    const events = renewEvents(d, [renewTx('t1', '2024-03-01', 15)]);
    expect(events).toHaveLength(3);
    expect(events.filter((e) => e.transaction !== null)).toHaveLength(1);
    expect(events.filter((e) => e.transaction === null)).toHaveLength(2);
  });

  it('续费事件按日期插在购入和出售之间', () => {
    const d = domain({ renewal_count: 2 });
    const kinds = buildDomainTimelineEvents(d, []).map((e) => e.kind);
    expect(kinds[0]).toBe('purchase');
    expect(kinds.slice(1)).toEqual(['renew', 'renew']);
  });

  it('虚拟续费事件的 id 唯一，同一天两次也不会撞 key', () => {
    const d = domain({ renewal_count: 4, renewal_cycle: 0 });
    const ids = renewEvents(d, []).map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
