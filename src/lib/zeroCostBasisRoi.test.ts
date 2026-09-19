/**
 * cost basis 为 0 的已售域名，ROI 必须是「—」而不是绿色的 +0.0%。
 *
 * 抢注 / 白嫖来的米（purchase_cost = 0 且没有 buy 交易），或者成本压根没录，
 * 卖出后 profit 算得出来，但 profit / 0 这个比值没有定义。三处实现以前都兜底
 * 成 0，于是同一行左边写着赚了 $10,000、右边 ROI 写 0.0%；域名表格那一列更是
 * 渲染成绿色的 +0.0%，读起来是「打平」。
 *
 * 这跟已经修过的「持有中没填估值 → 绿色 +0.0%」是同一个读法错误，只是漏了
 * 「已成交但没有成本基准」这一档。realizedPnL.tradeOutcomes 一直是对的
 * （`costBasis > 0 ? … : null`），另外两处现在对齐它。
 */
import { describe, it, expect } from 'vitest';
import {
  calculateDomainROI,
  domainRoiWithKind,
  soldGrossRevenueOf,
  soldNetRevenueOf,
} from './financialCalculations';
import { calculateDomainROI as roiFromTransactions } from './enhancedFinancialMetrics';
import { tradeOutcomes } from './realizedPnL';
import type { DomainWithTags, TransactionWithRequiredFields } from '../types/dashboard';

const freeDomain = {
  id: 'd1',
  domain_name: 'free.com',
  registrar: 'NC',
  purchase_cost: 0,
  renewal_cost: 0,
  renewal_count: 0,
  baseline_renewal_as_of: null,
  purchase_date: '2025-01-10',
  expiry_date: '2027-01-10',
  status: 'sold',
  estimated_value: 0,
  sale_price: 10000,
  platform_fee: 0,
  tags: [],
};

const sell = {
  id: 't1',
  domain_id: 'd1',
  type: 'sell',
  amount: 10000,
  net_amount: 10000,
  platform_fee: 0,
  currency: 'USD',
  date: '2026-05-04',
  payment_plan: 'lump_sum',
};

describe('cost basis 为 0 的已售域名', () => {
  it('域名表格 / 卡片：roi 为 null，kind 仍然是 realized', () => {
    const r = domainRoiWithKind(freeDomain as never, [sell] as never);
    expect(r.roi).toBeNull();
    // 成交是真的成交了，只是比值算不出来——不能退化成 unknown（那是「没填估值」）
    expect(r.kind).toBe('realized');
  });

  it('交易列表：roi 为 null，但 grossProfit 照样是准的', () => {
    const e = roiFromTransactions(freeDomain as never, [sell] as never);
    expect(e.roi).toBeNull();
    expect(e.grossProfit).toBe(10000);
  });

  it('Insights 一直是对的，三处现在给同一个答案', () => {
    const [tr] = tradeOutcomes(
      [freeDomain] as unknown as DomainWithTags[],
      [sell] as unknown as TransactionWithRequiredFields[]
    );
    expect(tr.roi).toBeNull();
    expect(tr.profit).toBe(10000);
    expect(domainRoiWithKind(freeDomain as never, [sell] as never).roi).toBeNull();
    expect(roiFromTransactions(freeDomain as never, [sell] as never).roi).toBeNull();
  });

  it('有成本时不受影响，仍然算得出百分比', () => {
    const paid = { ...freeDomain, purchase_cost: 1000 };
    expect(domainRoiWithKind(paid as never, [sell] as never).roi).toBeCloseTo(900, 6);
    expect(roiFromTransactions(paid as never, [sell] as never).roi).toBeCloseTo(900, 6);
    expect(calculateDomainROI(paid as never, [sell] as never)).toBeCloseTo(900, 6);
  });
});

describe('soldNetRevenueOf', () => {
  // DomainCard 的 Net Profit 以前直接读 domain.sale_price，而它旁边的 ROI 按
  // sell 交易算。同一域名卖过两轮时 sale_price 只留得住最后一次，持有成本却是
  // 累计的，于是一张卡上并排印着「+$2,000」和「ROI +700.0%」。
  const twice = { ...freeDomain, purchase_cost: 1000, sale_price: 3000 };
  const txs = [
    { ...sell, amount: 5000, net_amount: 5000, date: '2026-04-01' },
    { ...sell, id: 't2', amount: 3000, net_amount: 3000, date: '2026-09-01' },
  ];

  it('把全部 sell 交易加起来，而不是只认域名行上的 sale_price', () => {
    expect(soldNetRevenueOf(twice as never, txs as never)).toBe(8000);
  });

  it('卡片上的 netProfit 与 ROI 现在同源', () => {
    const netProfit = soldNetRevenueOf(twice as never, txs as never) - 1000;
    const roi = domainRoiWithKind(twice as never, txs as never).roi as number;
    expect(netProfit).toBe(7000);
    expect((roi / 100) * 1000).toBeCloseTo(netProfit, 6);
  });

  it('拿不到交易时退回存档字段', () => {
    expect(soldNetRevenueOf({ ...twice, sale_price: 3000, platform_fee: 200 } as never, [])).toBe(2800);
    expect(soldGrossRevenueOf({ ...twice, sale_price: 3000, platform_fee: 200 } as never, [])).toBe(3000);
  });

  it('gross 不扣平台费——卡片上的「成交价」那行用它，利润用 net', () => {
    const withFee = [
      { ...sell, amount: 5000, net_amount: 4500, platform_fee: 500, date: '2026-04-01' },
      { ...sell, id: 't2', amount: 3000, net_amount: 2700, platform_fee: 300, date: '2026-09-01' },
    ];
    expect(soldGrossRevenueOf(twice as never, withFee as never)).toBe(8000);
    expect(soldNetRevenueOf(twice as never, withFee as never)).toBe(7200);
  });
});
