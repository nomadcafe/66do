import { describe, it, expect } from 'vitest';
import { salesByPlatform, platformOfSale } from './salesByPlatform';
import { totalRealizedPnL } from './realizedPnL';
import type { DomainWithTags } from '../types/dashboard';
import type { TransactionWithRequiredFields } from '../types/transaction';

const domain = (id: string, cost: number) =>
  ({
    id, domain_name: `${id}.com`, registrar: 'NC',
    purchase_cost: cost, renewal_cost: 0, renewal_count: 0, baseline_renewal_as_of: null,
    purchase_date: '2025-01-01', expiry_date: '2027-01-01', status: 'sold',
    estimated_value: 0, tags: [],
  }) as unknown as DomainWithTags;

const buy = (id: string, amount: number) =>
  ({
    id: `b-${id}`, domain_id: id, type: 'buy', amount,
    currency: 'USD', date: '2025-01-01',
  }) as unknown as TransactionWithRequiredFields;

const sell = (
  id: string,
  gross: number,
  net: number,
  over: Record<string, unknown> = {}
) =>
  ({
    id: `s-${id}`, domain_id: id, type: 'sell', amount: gross, net_amount: net,
    platform_fee: gross - net, currency: 'USD', date: '2026-05-01',
    payment_plan: 'lump_sum', ...over,
  }) as unknown as TransactionWithRequiredFields;

describe('platformOfSale', () => {
  it('优先用 platform 自由文本', () => {
    expect(platformOfSale(sell('d1', 100, 90, { platform: 'Dan' }))).toBe('Dan');
  });

  it('大小写归一到规范写法', () => {
    expect(platformOfSale(sell('d1', 100, 90, { platform: 'sedo' }))).toBe('Sedo');
    expect(platformOfSale(sell('d1', 100, 90, { platform: 'SEDO' }))).toBe('Sedo');
    expect(platformOfSale(sell('d1', 100, 90, { platform: '  aftERnic ' }))).toBe('Afternic');
  });

  it('用户自造的名字保留他自己的大小写', () => {
    expect(platformOfSale(sell('d1', 100, 90, { platform: 'myBroker.io' }))).toBe('myBroker.io');
  });

  it('platform 为空时退回 platform_fee_type', () => {
    // platform 这一列是后加的，老交易全是 NULL；但选过分期费率模型的
    // 交易，平台其实已经结构化地记下来了
    expect(platformOfSale(sell('d1', 100, 90, { platform_fee_type: 'afternic_installment' }))).toBe('Afternic');
    expect(platformOfSale(sell('d1', 100, 90, { platform_fee_type: 'spaceship_installment' }))).toBe('Spaceship');
    expect(platformOfSale(sell('d1', 100, 90, { platform_fee_type: 'escrow_installment' }))).toBe('Escrow.com');
  });

  it("'standard' 不含平台信息，不当作平台", () => {
    expect(platformOfSale(sell('d1', 100, 90, { platform_fee_type: 'standard' }))).toBeNull();
  });

  it('两者都没有 → null', () => {
    expect(platformOfSale(sell('d1', 100, 90))).toBeNull();
  });
});

describe('salesByPlatform', () => {
  it('按平台聚合，算得出有效费率和已实现盈亏', () => {
    const domains = [domain('d1', 1000), domain('d2', 500)];
    const txs = [
      buy('d1', 1000), sell('d1', 10000, 8500, { platform: 'Afternic' }), // 费率 15%
      buy('d2', 500), sell('d2', 2000, 1800, { platform: 'Sedo' }),       // 费率 10%
    ];
    const { rows } = salesByPlatform(domains, txs);

    const afternic = rows.find((r) => r.platform === 'Afternic')!;
    expect(afternic.salesCount).toBe(1);
    expect(afternic.grossSales).toBe(10000);
    expect(afternic.platformFees).toBe(1500);
    expect(afternic.netProceeds).toBe(8500);
    expect(afternic.feeRatePercent).toBeCloseTo(15, 6);
    expect(afternic.realizedPnL).toBe(7500); // 8500 − 1000

    const sedo = rows.find((r) => r.platform === 'Sedo')!;
    expect(sedo.feeRatePercent).toBeCloseTo(10, 6);
    expect(sedo.realizedPnL).toBe(1300); // 1800 − 500
  });

  it('大小写分叉的历史数据聚成一行——不需要专门写迁移去洗库', () => {
    const domains = [domain('d1', 100), domain('d2', 100), domain('d3', 100)];
    const txs = [
      buy('d1', 100), sell('d1', 1000, 900, { platform: 'Sedo' }),
      buy('d2', 100), sell('d2', 1000, 900, { platform: 'sedo' }),
      buy('d3', 100), sell('d3', 1000, 900, { platform: ' SEDO ' }),
    ];
    const { rows } = salesByPlatform(domains, txs);
    const sedoRows = rows.filter((r) => r.platform.toLowerCase().trim() === 'sedo');
    expect(sedoRows).toHaveLength(1);
    expect(sedoRows[0].platform).toBe('Sedo'); // 规范写法
    expect(sedoRows[0].salesCount).toBe(3);
    expect(sedoRows[0].grossSales).toBe(3000);
  });

  it('没有平台信息的成交进 Unknown 桶并沉到最后', () => {
    const domains = [domain('d1', 100), domain('d2', 100)];
    const txs = [
      buy('d1', 100), sell('d1', 100, 90),                         // 无平台
      buy('d2', 100), sell('d2', 9000, 8000, { platform: 'Dan' }),
    ];
    const { rows, unknownCount } = salesByPlatform(domains, txs);
    expect(unknownCount).toBe(1);
    expect(rows[rows.length - 1].isUnknown).toBe(true);
    expect(rows[0].platform).toBe('Dan');
  });

  it('按实收降序，Unknown 不参与排序竞争', () => {
    const domains = [domain('d1', 0), domain('d2', 0), domain('d3', 0)];
    const txs = [
      buy('d1', 0), sell('d1', 100, 100, { platform: 'Sedo' }),
      buy('d2', 0), sell('d2', 5000, 5000, { platform: 'Dan' }),
      buy('d3', 0), sell('d3', 99999, 99999),  // 无平台但金额最大
    ];
    const { rows } = salesByPlatform(domains, txs);
    expect(rows.map((r) => r.platform)).toEqual(['Dan', 'Sedo', '']);
  });

  it('吃的是 transactionsForMetrics —— 分期已折算过，这里不再缩一次', () => {
    // 折算发生在 dashboard 的 transactionsForMetrics：一笔签了 $12,000、
    // 只收到 $2,000 的分期，传进来时 amount/net_amount 已经是已收口径。
    // 这条钉住"这一层不重复折算"——重复缩会让金额平方级缩水。
    const domains = [domain('d1', 1000)];
    const scaled = sell('d1', 2000, 1800, {
      payment_plan: 'installment',
      installment_period: 12,
    });
    const { rows } = salesByPlatform(domains, [buy('d1', 1000), scaled]);
    const r = rows[0];
    expect(r.grossSales).toBeCloseTo(2000, 6);
    expect(r.netProceeds).toBeCloseTo(1800, 6);
    expect(r.platformFees).toBeCloseTo(200, 6);
    expect(r.feeRatePercent).toBeCloseTo(10, 6);
    // 已收 1800，成本 1000 → 已实现 800（不是按合同全额算的 9800）
    expect(r.realizedPnL).toBeCloseTo(800, 6);
  });

  it('成交额为 0 时费率是 null，不是 0%', () => {
    const domains = [domain('d1', 100)];
    const txs = [buy('d1', 100), sell('d1', 0, 0, { platform: 'Dan' })];
    expect(salesByPlatform(domains, txs).rows[0].feeRatePercent).toBeNull();
  });

  it('没有任何成交时返回空表，合计全为 0', () => {
    const { rows, totals, unknownCount } = salesByPlatform([domain('d1', 100)], [buy('d1', 100)]);
    expect(rows).toEqual([]);
    expect(totals.salesCount).toBe(0);
    expect(totals.realizedPnL).toBe(0);
    expect(unknownCount).toBe(0);
  });
});

describe('与 Insights 其它数字对拍', () => {
  it('各行 realizedPnL 之和 = totalRealizedPnL（同一批事实，不能各说各话）', () => {
    const domains = [domain('d1', 1000), domain('d2', 500), domain('d3', 200)];
    const txs = [
      buy('d1', 1000), sell('d1', 10000, 8500, { platform: 'Afternic' }),
      buy('d2', 500), sell('d2', 2000, 1800, { platform: 'sedo' }),
      buy('d3', 200), sell('d3', 100, 80),   // 亏损，且无平台
    ];
    const { rows, totals } = salesByPlatform(domains, txs);
    const sum = rows.reduce((s, r) => s + r.realizedPnL, 0);
    expect(sum).toBeCloseTo(totalRealizedPnL(domains, txs), 6);
    expect(totals.realizedPnL).toBeCloseTo(sum, 6);
  });

  it('合计的笔数 / 金额等于各行相加', () => {
    const domains = [domain('d1', 100), domain('d2', 100)];
    const txs = [
      buy('d1', 100), sell('d1', 1000, 900, { platform: 'Dan' }),
      buy('d2', 100), sell('d2', 3000, 2700, { platform: 'Sedo' }),
    ];
    const { rows, totals } = salesByPlatform(domains, txs);
    expect(totals.salesCount).toBe(2);
    expect(totals.grossSales).toBe(4000);
    expect(totals.netProceeds).toBe(3600);
    expect(totals.platformFees).toBe(400);
    expect(totals.feeRatePercent).toBeCloseTo(10, 6);
    expect(totals.grossSales).toBe(rows.reduce((s, r) => s + r.grossSales, 0));
  });
});

describe('时间窗口', () => {
  const domains = [domain('old', 1000), domain('recent', 500)];
  const txs = [
    buy('old', 1000), sell('old', 10000, 9000, { platform: 'Sedo' }),      // 2026-05-01
    buy('recent', 500), sell('recent', 3000, 2700, { platform: 'Dan' }),   // 2026-05-01
  ];

  it('null = 全部', () => {
    expect(salesByPlatform(domains, txs, null).totals.salesCount).toBe(2);
  });

  it('按成交日筛，窗口外的整笔不计', () => {
    const old = [
      ...domains,
      domain('ancient', 200),
    ];
    const oldTxs = [
      ...txs,
      buy('ancient', 200),
      { ...sell('ancient', 800, 700, { platform: 'Sedo' }), date: '2020-01-01' } as never,
    ];
    // 2020 那笔在任何有限窗口之外
    const windowed = salesByPlatform(old, oldTxs, 36);
    expect(windowed.totals.salesCount).toBe(2);
    // 全量则三笔都在
    expect(salesByPlatform(old, oldTxs, null).totals.salesCount).toBe(3);
  });

  it('窗口外买入的成本依然全额扣掉', () => {
    // 这是 ShareModal 当初踩的坑：按购入日截数据，成本凭空消失、利润虚高
    const d = [domain('old', 1000)];
    const t = [buy('old', 1000), sell('old', 10000, 9000, { platform: 'Sedo' })];
    // purchase_date 是 2025-01-01，用 6 个月窗口时购入日早已在窗口外
    const row = salesByPlatform(d, t, 6).rows[0];
    expect(row.costBasis).toBe(1000);
    expect(row.realizedPnL).toBe(8000); // 9000 − 1000，不是 9000
  });
});

describe('逐笔明细', () => {
  it('每个平台带上自己的成交明细，按成交日倒序', () => {
    const d = [domain('a', 100), domain('b', 100)];
    const t = [
      buy('a', 100), { ...sell('a', 1000, 900, { platform: 'Sedo' }), date: '2026-03-01' } as never,
      buy('b', 100), { ...sell('b', 2000, 1800, { platform: 'Sedo' }), date: '2026-07-01' } as never,
    ];
    const row = salesByPlatform(d, t).rows[0];
    expect(row.sales.map((x) => x.saleDate)).toEqual(['2026-07-01', '2026-03-01']);
    expect(row.sales.map((x) => x.domainName)).toEqual(['b.com', 'a.com']);
  });

  it('明细加起来等于汇总行', () => {
    const d = [domain('a', 100), domain('b', 200)];
    const t = [
      buy('a', 100), sell('a', 1000, 900, { platform: 'Dan' }),
      buy('b', 200), sell('b', 2000, 1800, { platform: 'Dan' }),
    ];
    const row = salesByPlatform(d, t).rows[0];
    expect(row.sales.reduce((s, x) => s + x.grossSales, 0)).toBe(row.grossSales);
    expect(row.sales.reduce((s, x) => s + x.netProceeds, 0)).toBe(row.netProceeds);
    expect(row.sales.reduce((s, x) => s + x.realizedPnL, 0)).toBeCloseTo(row.realizedPnL, 6);
    expect(row.sales).toHaveLength(row.salesCount);
  });

  it('免费域名的单笔 ROI 是 null，不是 0', () => {
    const d = [domain('free', 0)];
    const t = [sell('free', 5000, 4500, { platform: 'Dan' })];
    expect(salesByPlatform(d, t).rows[0].sales[0].roi).toBeNull();
  });
});
