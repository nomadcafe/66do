/**
 * 分享卡片的利润 / ROI 必须和 Insights 对得上。
 *
 * 原来两个分享弹窗各有一份基于 domain.sale_price 的私有实现（两份代码一模
 * 一样），和 Insights 的 tradeOutcomes 口径不同。分享图是发出去给别人看的，
 * 上面的数字跟自己仪表盘对不上最难解释。
 */
import { describe, it, expect } from 'vitest';
import { domainSaleProfit, domainSaleROI, latestSaleOutcome } from './domainSaleOutcome';
import { tradeOutcomes } from './realizedPnL';
import type { DomainWithTags, TransactionWithRequiredFields } from '../types/dashboard';

const dom = (over: Partial<DomainWithTags> = {}) =>
  ({
    id: 'd1',
    domain_name: 'example.com',
    registrar: 'NC',
    purchase_date: '2025-01-10',
    purchase_cost: 1000,
    renewal_cost: 0,
    renewal_cycle: 1,
    renewal_count: 0,
    expiry_date: '2027-01-10',
    status: 'sold',
    estimated_value: 0,
    tags: [],
    ...over,
  }) as unknown as DomainWithTags;

const sell = (id: string, amount: number, date: string, fee = 0) =>
  ({
    id,
    domain_id: 'd1',
    type: 'sell',
    amount,
    net_amount: amount - fee,
    platform_fee: fee,
    currency: 'USD',
    date,
    payment_plan: 'lump_sum',
  }) as unknown as TransactionWithRequiredFields;

describe('domainSaleOutcome', () => {
  it('和 Insights 用的 tradeOutcomes 逐位一致', () => {
    const d = dom();
    const txs = [sell('t1', 5000, '2026-04-01', 500)];
    const [canonical] = tradeOutcomes([d], txs);
    expect(domainSaleProfit(d, txs)).toBeCloseTo(canonical.profit, 9);
    expect(domainSaleROI(d, txs)).toBeCloseTo(canonical.roi!, 9);
  });

  it('sale_price 没回写到域名行时照样算得出利润（以前返回 $0）', () => {
    // 导入的数据 / 补录的 sell 交易：域名行上没有 sale_price
    const d = dom({ sale_price: undefined, platform_fee: undefined });
    const txs = [sell('t1', 5000, '2026-04-01')];
    // 旧实现：!domain.sale_price → return 0
    expect(domainSaleProfit(d, txs)).toBeCloseTo(4000, 6);
    expect(domainSaleROI(d, txs)).toBeCloseTo(400, 6);
  });

  it('同一个域名卖过两轮时取最近那一次，而不是域名行上残留的那个价', () => {
    const d = dom({ sale_price: 900 });
    const txs = [sell('t1', 3000, '2026-01-01'), sell('t2', 9000, '2026-08-01')];
    expect(latestSaleOutcome(d, txs)?.saleDate).toBe('2026-08-01');
    expect(domainSaleProfit(d, txs)).toBeCloseTo(8000, 6);
  });

  it('没有任何成交记录时利润和 ROI 都是 0，卡片按「还没卖」渲染', () => {
    const d = dom({ status: 'active' });
    expect(latestSaleOutcome(d, [])).toBeNull();
    expect(domainSaleProfit(d, [])).toBe(0);
    expect(domainSaleROI(d, [])).toBe(0);
  });

  it('免费域名（成本基准 0）的 ROI 在卡片上按 0 渲染，而不是 NaN / Infinity', () => {
    const d = dom({ purchase_cost: 0 });
    const txs = [sell('t1', 2000, '2026-04-01')];
    expect(Number.isFinite(domainSaleROI(d, txs))).toBe(true);
    expect(domainSaleROI(d, txs)).toBe(0);
  });
});
