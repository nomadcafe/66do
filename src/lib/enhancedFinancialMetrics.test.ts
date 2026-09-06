import { describe, it, expect } from 'vitest';
import { calculateDomainROI as roiFromSales } from './enhancedFinancialMetrics';
import { calculateDomainROI as roiFromDomainState } from './financialCalculations';

/**
 * 这里锁两件事。
 *
 * 一、成本基准必须看得见这个域名的全部交易。
 *     TransactionList 曾经只把当前这一行的 sell 交易传进来
 *     （`calculateDomainROI(domain, [transaction])`），于是 acquisitionCost /
 *     totalRenewalCostForHolding 一笔 buy / renew 都看不到，成本静默退回域名行
 *     上的存档字段。同一个域名，Activity 列表显示 400%、Portfolio 表格显示
 *     257%。
 *
 * 二、项目里**故意**保留两份 calculateDomainROI，别合并：
 *       financialCalculations 版 — 按域名"资产状态"算（sold 用 sale_price、
 *         持有中用 estimated_value、判定为损失则 -100%）
 *       enhancedFinancialMetrics 版（本文件）— 按"实际卖出交易"算
 *     喂同样的完整交易列表时，两者在所有已售场景下逐位一致；只有在"有 sell
 *     交易但 status 还没改成 sold"这种数据不同步的情况下才分岔，而那时各自的
 *     答案对各自的问题都是对的。下面的测试把这个边界也钉住。
 */

const domain = (over: Record<string, unknown> = {}) =>
  ({
    id: 'd1',
    domain_name: 'example.com',
    status: 'sold',
    purchase_cost: 100,
    purchase_date: '2020-01-01',
    renewal_cost: 12,
    renewal_count: 2,
    baseline_renewal_as_of: null,
    expiry_date: null,
    sale_price: 500,
    platform_fee: 0,
    estimated_value: null,
    ...over,
  }) as never;

const buy = { domain_id: 'd1', type: 'buy', amount: 100, date: '2020-01-01' };
const renew1 = { domain_id: 'd1', type: 'renew', amount: 20, date: '2021-01-01' };
const renew2 = { domain_id: 'd1', type: 'renew', amount: 20, date: '2022-01-01' };
const sell = {
  domain_id: 'd1', type: 'sell', amount: 500, net_amount: 500, platform_fee: 0, date: '2023-01-01',
};

describe('calculateDomainROI 的成本基准', () => {
  it('真实的 buy / renew 交易要计入成本，不能退回存档字段', () => {
    // 成本 = 100 + 20 + 20 = 140，收入 500 → (500-140)/140 = 257.1%
    const full = roiFromSales(domain(), [buy, renew1, renew2, sell]);
    expect(full.totalInvestment).toBe(140);
    expect(full.roi).toBeCloseTo(257.1, 1);
  });

  it('只喂当前这一笔 sell 会让成本退化 —— 记录这就是当初的 bug', () => {
    // 看不到 buy/renew：成本退回 purchase_cost + renewal_count × renewal_cost
    // = 100 + 2×12 = 124，ROI 虚高到 303%。这条不是"期望行为"，是把退化路径
    // 钉下来，说明为什么调用方必须传完整列表。
    const degraded = roiFromSales(domain(), [sell]);
    expect(degraded.totalInvestment).toBe(124);
    expect(degraded.roi).toBeGreaterThan(roiFromSales(domain(), [buy, renew1, renew2, sell]).roi);
  });

  it('用户没维护 renewal_count、只记了续费交易时，续费成本照样算得到', () => {
    const d = domain({ renewal_count: 0 });
    const full = roiFromSales(d, [buy, renew1, renew2, sell]);
    expect(full.totalInvestment).toBe(140);
  });
});

describe('两份 calculateDomainROI 的关系', () => {
  const cases: Array<[string, ReturnType<typeof domain>, unknown[]]> = [
    ['成本全记成交易', domain(), [buy, renew1, renew2, sell]],
    ['带平台费', domain({ sale_price: 1000, platform_fee: 150, renewal_count: 0 }),
      [buy, { ...sell, amount: 1000, net_amount: 850, platform_fee: 150 }]],
    ['成本只在存档字段上', domain({ renewal_count: 3 }), [sell]],
  ];

  it.each(cases)('已售场景下两者一致：%s', (_name, d, txs) => {
    const a = roiFromDomainState(d, txs as never);
    const b = roiFromSales(d, txs as never).roi;
    expect(b).toBeCloseTo(a, 6);
  });

  it('有 sell 交易但 status 未改成 sold 时，两者故意给不同答案', () => {
    const d = domain({ status: 'active', sale_price: null, platform_fee: null, renewal_count: 0 });
    const txs = [buy, sell];
    // 资产状态口径：还没标记成已售、也没填估值 → 0%
    expect(roiFromDomainState(d, txs as never)).toBe(0);
    // 实际交易口径：确实卖了 500、成本 100 → 400%
    expect(roiFromSales(d, txs as never).roi).toBeCloseTo(400, 6);
  });
});
