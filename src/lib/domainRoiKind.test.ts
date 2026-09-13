/**
 * ROI 这个数是怎么来的。
 *
 * calculateDomainROI 只返回一个 number，四种完全不同的情况被压成同一个数字，
 * 其中「持有中但没填估值」返回 0 —— 在域名表格里被渲染成绿色的 +0.0%，
 * 读起来是"打平"，实际意思是"不知道"。
 */
import { describe, it, expect } from 'vitest';
import { domainRoiWithKind, calculateDomainROI } from './financialCalculations';

const d = (over: Record<string, unknown> = {}) => ({
  id: 'd1',
  purchase_cost: 1000,
  renewal_cost: 0,
  renewal_count: 0,
  baseline_renewal_as_of: null,
  status: 'active',
  expiry_date: '2030-01-01',
  ...over,
});

const sellTx = {
  domain_id: 'd1',
  type: 'sell',
  amount: 5000,
  net_amount: 5000,
  platform_fee: 0,
  date: '2026-04-01',
};

describe('domainRoiWithKind', () => {
  it('持有中且没填估值 → roi 为 null，而不是 0', () => {
    const r = domainRoiWithKind(d(), []);
    expect(r.kind).toBe('unknown');
    expect(r.roi).toBeNull();
    // 旧接口仍然返回 0，这正是表格上那个绿色 +0.0% 的来源
    expect(calculateDomainROI(d(), [])).toBe(0);
  });

  it('持有中且填了估值 → unrealized，数值与旧接口一致', () => {
    const dom = d({ estimated_value: 4000 });
    const r = domainRoiWithKind(dom, []);
    expect(r.kind).toBe('unrealized');
    expect(r.roi).toBeCloseTo(300, 6);
    expect(r.roi).toBeCloseTo(calculateDomainROI(dom, []), 9);
  });

  it('已成交 → realized，走交易口径', () => {
    const dom = d({ status: 'sold' });
    const r = domainRoiWithKind(dom, [sellTx]);
    expect(r.kind).toBe('realized');
    expect(r.roi).toBeCloseTo(400, 6);
  });

  it('放弃续费 / 过期未续 → lost，−100%', () => {
    const r = domainRoiWithKind(d({ status: 'expired' }), []);
    expect(r.kind).toBe('lost');
    expect(r.roi).toBe(-100);
  });

  it('估值填 0 视同没填，不是「跌到 0」', () => {
    expect(domainRoiWithKind(d({ estimated_value: 0 }), []).kind).toBe('unknown');
  });

  it('已成交优先于估值 —— 卖掉之后就不看估值了', () => {
    const dom = d({ status: 'sold', estimated_value: 99999 });
    const r = domainRoiWithKind(dom, [sellTx]);
    expect(r.kind).toBe('realized');
    expect(r.roi).toBeCloseTo(400, 6);
  });
});
