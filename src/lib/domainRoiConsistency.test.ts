/**
 * 同一个域名，域名表格 / 卡片和交易列表显示的 ROI 必须一致。
 *
 * 两处调的是两个**同名不同实现**的函数：
 *   financialCalculations.calculateDomainROI   ← DomainTable / DomainCard
 *   enhancedFinancialMetrics.calculateDomainROI ← TransactionList
 * 成本口径一样（都走 renewalCostBasis），收入口径不一样：前者读域名行上的
 * sale_price / platform_fee 存档字段，后者按 sell 交易算。
 */
import { describe, it, expect } from 'vitest';
import { calculateDomainROI as roiFromArchive } from './financialCalculations';
import { calculateDomainROI as roiFromTransactions } from './enhancedFinancialMetrics';

const base = {
  id: 'd1',
  domain_name: 'example.com',
  purchase_cost: 1000,
  renewal_cost: 0,
  renewal_count: 0,
  baseline_renewal_as_of: null,
  purchase_date: '2025-01-10',
  status: 'sold',
  expiry_date: '2027-01-10',
};

const sellTx = {
  domain_id: 'd1',
  type: 'sell',
  amount: 5000,
  net_amount: 5000,
  platform_fee: 0,
  date: '2026-04-01',
};

describe('域名 ROI 的两处实现', () => {
  it('存档字段齐全时两者一致', () => {
    const domain = { ...base, sale_price: 5000, platform_fee: 0 };
    const a = roiFromArchive(domain, [sellTx]);
    const b = roiFromTransactions(base, [sellTx]).roi;
    expect(a).toBeCloseTo(400, 6);
    expect(a).toBeCloseTo(b, 6);
  });

  it('sale_price 没回写到域名行时，两者必须仍然一致', () => {
    // 导入的数据 / 补录的 sell 交易：域名行上没有 sale_price
    const domain = { ...base, sale_price: null, platform_fee: null };
    const a = roiFromArchive(domain, [sellTx]);
    const b = roiFromTransactions(base, [sellTx]).roi;
    // 旧实现：netRevenue = 0 → (0 − 1000)/1000 = −100%
    // 一笔赚了 4 倍的成交，在域名表格里显示成 −100%
    expect(b).toBeCloseTo(400, 6);
    expect(a).toBeCloseTo(b, 6);
  });

  it('同一域名卖过两轮时，两者都应算上全部成交', () => {
    const txs = [sellTx, { ...sellTx, amount: 3000, net_amount: 3000, date: '2026-09-01' }];
    const domain = { ...base, sale_price: 3000, platform_fee: 0 };
    const a = roiFromArchive(domain, txs);
    const b = roiFromTransactions(base, txs).roi;
    expect(a).toBeCloseTo(b, 6);
  });
});
