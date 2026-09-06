import { describe, it, expect } from 'vitest';
import { computeAdvancedRenewalPanelData } from './renewalCostService';
import { expandRenewalEvents } from './expandRenewalEvents';
import type { TransactionWithRequiredFields } from '../types/transaction';

type Domain = Parameters<typeof computeAdvancedRenewalPanelData>[0][number];

function domain(over: Partial<Domain> & { id: string }): Domain {
  return {
    status: 'active',
    domain_name: `${over.id}.com`,
    purchase_date: '2024-01-10',
    expiry_date: '2027-01-10',
    renewal_cycle: 1,
    renewal_count: 0,
    renewal_cost: 12,
    registrar: 'Namecheap',
    ...over,
  };
}

const NO_TX: TransactionWithRequiredFields[] = [];

function renewTx(
  domainId: string,
  date: string,
  amount: number,
  years?: number
): TransactionWithRequiredFields {
  return {
    id: `tx-${domainId}-${date}`,
    domain_id: domainId,
    type: 'renew',
    amount,
    currency: 'USD',
    date,
    ...(years === undefined ? {} : { renewal_period_years: years }),
    created_at: '',
    updated_at: '',
  } as TransactionWithRequiredFields;
}

describe('computeAdvancedRenewalPanelData — year window', () => {
  // 回归：窗口曾经以 selectedYear 为锚，每选一次年份整个下拉就平移一格，
  // 选到 +3 年之后今年就从列表里消失了，回不去。
  it('anchors the year window on anchorYear, not on the selection', () => {
    const domains = [domain({ id: 'd1' })];

    const atCurrent = computeAdvancedRenewalPanelData(domains, NO_TX, 2026, {
      pastYears: 2,
      futureYears: 3,
      anchorYear: 2026,
    });
    const atFuture = computeAdvancedRenewalPanelData(domains, NO_TX, 2029, {
      pastYears: 2,
      futureYears: 3,
      anchorYear: 2026,
    });

    const years = (r: typeof atCurrent) => r.yearSummaries.map((s) => s.year);
    expect(years(atCurrent)).toEqual([2024, 2025, 2026, 2027, 2028, 2029]);
    // 选到窗口末端后，窗口不动，今年仍然在列表里
    expect(years(atFuture)).toEqual(years(atCurrent));
    expect(years(atFuture)).toContain(2026);
  });

  it('still includes selectedYear when it falls outside the anchored window', () => {
    // 跨年边界的兜底：value 必须能在 <option> 里找到，否则 select 显示空白
    const { yearSummaries } = computeAdvancedRenewalPanelData([domain({ id: 'd1' })], NO_TX, 2035, {
      pastYears: 2,
      futureYears: 3,
      anchorYear: 2026,
    });
    expect(yearSummaries.map((s) => s.year)).toContain(2035);
    expect(yearSummaries.map((s) => s.year)).toEqual([...yearSummaries.map((s) => s.year)].sort((a, b) => a - b));
  });

  it('an empty selected year still returns the full window, so the picker survives', () => {
    // 面板的空状态判定要看整个窗口，不能只看选中年份——否则选到空年份会把
    // 年份选择器一起干掉，而子 tab 是 hidden 保持挂载的，用户出不来。
    const { analysis, yearSummaries } = computeAdvancedRenewalPanelData(
      [domain({ id: 'd1', purchase_date: '2026-01-10', expiry_date: '2027-01-10' })],
      NO_TX,
      2024,
      { pastYears: 2, futureYears: 3, anchorYear: 2026 }
    );

    expect(analysis.total_estimated_cost).toBe(0);
    expect(yearSummaries).toHaveLength(6);
    expect(yearSummaries.some((s) => s.total_estimated_cost > 0)).toBe(true);
  });
});

describe('computeAdvancedRenewalPanelData — forecast coverage', () => {
  it('counts domains that can never be forecast, by reason', () => {
    const { coverage } = computeAdvancedRenewalPanelData(
      [
        domain({ id: 'ok' }),
        domain({ id: 'no-cost', renewal_cost: 0 }),
        domain({ id: 'null-cost', renewal_cost: null }),
        domain({ id: 'no-expiry', expiry_date: null }),
        domain({ id: 'neither', renewal_cost: 0, expiry_date: null }),
      ],
      NO_TX,
      2026,
      { anchorYear: 2026 }
    );

    expect(coverage.total_active).toBe(5);
    expect(coverage.excluded).toBe(4); // 去重后的并集
    expect(coverage.missing_cost).toBe(3); // no-cost, null-cost, neither
    expect(coverage.missing_expiry).toBe(2); // no-expiry, neither
  });

  it('treats next_renewal_date as a usable anchor, matching expandRenewalEvents', () => {
    // coverage 的判据必须和 projected 分支同步：那边接受 next_renewal_date 之后，
    // 这边再把它算作「缺到期日」，报出来的「未计入」数量就是错的。
    const { coverage, yearSummaries } = computeAdvancedRenewalPanelData(
      [domain({ id: 'd1', expiry_date: null, next_renewal_date: '2027-04-01' })],
      NO_TX,
      2026,
      { anchorYear: 2026 }
    );

    expect(coverage.missing_expiry).toBe(0);
    expect(coverage.excluded).toBe(0);
    expect(yearSummaries.find((y) => y.year === 2027)?.total_estimated_cost).toBeGreaterThan(0);
  });

  it('excludes sold/expired domains from the coverage denominator', () => {
    const { coverage } = computeAdvancedRenewalPanelData(
      [
        domain({ id: 'a' }),
        domain({ id: 'sold', status: 'sold', renewal_cost: 0 }),
        domain({ id: 'expired', status: 'expired', renewal_cost: 0 }),
        domain({ id: 'for-sale', status: 'for_sale' }),
      ],
      NO_TX,
      2026,
      { anchorYear: 2026 }
    );

    expect(coverage.total_active).toBe(2);
    expect(coverage.excluded).toBe(0);
  });

  it('an unconfigured portfolio reports coverage even though every year is empty', () => {
    // 这是「暂无续费数据」最常见的真实成因：有域名，只是没填续费价。
    const { yearSummaries, coverage } = computeAdvancedRenewalPanelData(
      [domain({ id: 'd1', renewal_cost: 0 }), domain({ id: 'd2', renewal_cost: null })],
      NO_TX,
      2026,
      { anchorYear: 2026 }
    );

    expect(yearSummaries.every((s) => s.total_estimated_cost === 0)).toBe(true);
    expect(coverage.excluded).toBe(2);
  });

  it('returns zeroed coverage when there are no active domains at all', () => {
    const { coverage, yearSummaries } = computeAdvancedRenewalPanelData(
      [domain({ id: 'sold', status: 'sold' })],
      NO_TX,
      2026,
      { anchorYear: 2026 }
    );

    expect(coverage).toEqual({ total_active: 0, excluded: 0, missing_cost: 0, missing_expiry: 0 });
    expect(yearSummaries).toEqual([]);
  });
});

describe('computeAdvancedRenewalPanelData — spent / remaining', () => {
  // 回归：服务层原本算了个 cost_accuracy，公式是 1 − |est − actual| / actual，
  // 注释却说它表示「已发生比例」。est=1000 / actual=400 时它给出 −50%，夹紧后是 0，
  // 完全不是进度。而且这个字段从来没有任何消费方。
  it('current year: spent_ratio is actual / estimated, remaining is the rest', () => {
    // 到期日在年中，今年已经续过一次（$40），年内不再有 projected
    const domains = [
      domain({
        id: 'd1',
        purchase_date: '2023-06-01',
        expiry_date: '2027-06-01',
        renewal_count: 1,
        renewal_cost: 40,
      }),
    ];
    const txs = [renewTx('d1', '2026-06-01', 40, 1)];

    const { analysis } = computeAdvancedRenewalPanelData(domains, txs, 2026, { anchorYear: 2026 });

    expect(analysis.total_actual_cost).toBe(40);
    expect(analysis.total_estimated_cost).toBe(40);
    expect(analysis.spent_ratio).toBe(1);
    expect(analysis.remaining_estimated_cost).toBe(0);
  });

  it('future year: nothing has happened yet', () => {
    const { analysis } = computeAdvancedRenewalPanelData([domain({ id: 'd1' })], NO_TX, 2028, {
      anchorYear: 2026,
    });

    expect(analysis.total_estimated_cost).toBeGreaterThan(0);
    expect(analysis.total_actual_cost).toBe(0);
    expect(analysis.spent_ratio).toBe(0);
    expect(analysis.remaining_estimated_cost).toBe(analysis.total_estimated_cost);
  });

  it('spent_ratio stays inside [0, 1] even when actual overshoots estimated', () => {
    // renewal_count 手填偏小 → archive 估算少算，actual 反超
    const { analysis } = computeAdvancedRenewalPanelData(
      [domain({ id: 'd1', renewal_cost: 1 })],
      [renewTx('d1', '2026-03-01', 500, 1)],
      2026,
      { anchorYear: 2026 }
    );

    expect(analysis.spent_ratio).toBeLessThanOrEqual(1);
    expect(analysis.spent_ratio).toBeGreaterThanOrEqual(0);
    expect(analysis.remaining_estimated_cost).toBeGreaterThanOrEqual(0);
  });
});

describe('computeAdvancedRenewalPanelData — cost trends', () => {
  it('normalises multi-year renewals to a per-year price', () => {
    // $36 / 3 年 与 $12 / 1 年 是同一个价：不该读成涨了 200%
    const { analysis } = computeAdvancedRenewalPanelData(
      [domain({ id: 'd1' })],
      [renewTx('d1', '2024-01-10', 36, 3), renewTx('d1', '2025-01-10', 12, 1)],
      2026,
      { anchorYear: 2026 }
    );

    expect(analysis.cost_trends.trend_sample_size).toBe(1);
    expect(analysis.cost_trends.average_cost_change).toBeCloseTo(0, 6);
    expect(analysis.cost_trends.most_expensive_domains).toEqual([
      { name: 'd1.com', cost_per_year: 12 },
    ]);
  });

  it('average_cost_change can be negative — it averages every sampled domain', () => {
    // 旧口径只对「上涨」的域名求均值，所以永远给不出负数。
    const { analysis } = computeAdvancedRenewalPanelData(
      [domain({ id: 'up' }), domain({ id: 'down' })],
      [
        renewTx('up', '2024-01-10', 10, 1),
        renewTx('up', '2025-01-10', 12, 1), // +20%
        renewTx('down', '2024-01-10', 10, 1),
        renewTx('down', '2025-01-10', 5, 1), // −50%
      ],
      2026,
      { anchorYear: 2026 }
    );

    expect(analysis.cost_trends.trend_sample_size).toBe(2);
    expect(analysis.cost_trends.average_cost_change).toBeCloseTo((20 + -50) / 2, 6);
  });

  it('reports no sample when nobody has two logged renewals', () => {
    // 只用 renewal_count + renewal_cost 记账的用户 —— UI 据此显示「—」而不是 0.0%
    const { analysis } = computeAdvancedRenewalPanelData(
      [domain({ id: 'd1', renewal_count: 4 }), domain({ id: 'd2' })],
      [renewTx('d2', '2025-01-10', 12, 1)],
      2026,
      { anchorYear: 2026 }
    );

    expect(analysis.cost_trends.trend_sample_size).toBe(0);
    expect(analysis.cost_trends.average_cost_change).toBe(0);
  });

  it('keeps zero-cost and unnamed domains off the most-expensive list', () => {
    const { analysis } = computeAdvancedRenewalPanelData(
      [
        domain({ id: 'priced', renewal_cost: 30 }),
        domain({ id: 'free', renewal_cost: 0 }),
        domain({ id: 'anon', domain_name: '', renewal_cost: 99 }),
      ],
      NO_TX,
      2026,
      { anchorYear: 2026 }
    );

    expect(analysis.cost_trends.most_expensive_domains).toEqual([
      { name: 'priced.com', cost_per_year: 30 },
    ]);
  });

  it('divides a domain renewal_cost by its cycle for the per-year ranking', () => {
    // 2 年 $30 的域名，每年 $15，排在 1 年 $20 的后面
    const { analysis } = computeAdvancedRenewalPanelData(
      [
        domain({ id: 'biennial', renewal_cycle: 2, renewal_cost: 30 }),
        domain({ id: 'annual', renewal_cycle: 1, renewal_cost: 20 }),
      ],
      NO_TX,
      2026,
      { anchorYear: 2026 }
    );

    expect(analysis.cost_trends.most_expensive_domains).toEqual([
      { name: 'annual.com', cost_per_year: 20 },
      { name: 'biennial.com', cost_per_year: 15 },
    ]);
  });

  it('flags only domains whose latest price is >10% above their earlier average', () => {
    const { analysis } = computeAdvancedRenewalPanelData(
      [domain({ id: 'spiked' }), domain({ id: 'flat' })],
      [
        renewTx('spiked', '2024-01-10', 10, 1),
        renewTx('spiked', '2025-01-10', 20, 1), // +100%
        renewTx('flat', '2024-01-10', 10, 1),
        renewTx('flat', '2025-01-10', 10.5, 1), // +5%，低于阈值
      ],
      2026,
      { anchorYear: 2026 }
    );

    const opps = analysis.cost_trends.cost_optimization_opportunities;
    expect(opps).toHaveLength(1);
    expect(opps[0].name).toBe('spiked.com');
    expect(opps[0].variance).toBeCloseTo(100, 6);
  });
});

describe('computeAdvancedRenewalPanelData — single-pass bucketing', () => {
  // 性能改动的等价性护栏：原来每个年份各调一次 expandRenewalEvents（每域名每渲染
  // 7 次），现在按最大年份做一次 forecastUntil 再分桶。forecastUntil 只会追加更远
  // 的 projected 事件，所以任一年份的事件集合不变——这里用「逐年参考实现」逐位对拍。
  function referenceYear(
    domains: Parameters<typeof computeAdvancedRenewalPanelData>[0],
    txs: TransactionWithRequiredFields[],
    year: number
  ) {
    const yearEnd = new Date(year, 11, 31, 23, 59, 59, 999);
    let estimated = 0;
    let actual = 0;
    const ids = new Set<string>();

    for (const d of domains) {
      if (d.status === 'sold' || d.status === 'expired') continue;
      let costThisYear = 0;
      for (const ev of expandRenewalEvents(d, txs, { forecastUntil: yearEnd })) {
        if (ev.date.getFullYear() !== year) continue;
        costThisYear += ev.amount;
        if (ev.source !== 'projected') actual += ev.amount;
      }
      if (costThisYear === 0) continue;
      estimated += costThisYear;
      ids.add(d.id);
    }
    return { estimated, actual, domains: ids.size };
  }

  it('matches a per-year reference implementation across the whole window', () => {
    const domains = [
      domain({ id: 'a', expiry_date: '2026-03-01', renewal_count: 2, renewal_cost: 12 }),
      domain({ id: 'b', expiry_date: '2027-11-20', renewal_cycle: 2, renewal_cost: 30 }),
      domain({ id: 'c', status: 'for_sale', expiry_date: '2026-01-05', renewal_cost: 9.99 }),
      domain({ id: 'd', expiry_date: null, renewal_count: 3, renewal_cost: 15 }),
      domain({ id: 'e', renewal_cost: 0 }),
      domain({ id: 'gone', status: 'sold', renewal_cost: 50 }),
    ];
    const txs = [
      renewTx('a', '2025-03-01', 14, 1),
      renewTx('b', '2024-11-20', 55, 2),
      renewTx('c', '2026-01-05', 11, 1),
    ];

    const { yearSummaries } = computeAdvancedRenewalPanelData(domains, txs, 2026, {
      pastYears: 2,
      futureYears: 3,
      anchorYear: 2026,
    });

    expect(yearSummaries).toHaveLength(6);
    for (const row of yearSummaries) {
      const ref = referenceYear(domains, txs, row.year);
      expect(row.total_estimated_cost).toBe(ref.estimated);
      expect(row.domains_needing_renewal).toBe(ref.domains);
      expect(row.total_actual_cost).toBe(ref.actual);
    }
  });

  it('cost_by_registrar for the selected year matches the same reference', () => {
    const domains = [
      domain({ id: 'a', registrar: 'Namecheap', expiry_date: '2026-05-01', renewal_cost: 12 }),
      domain({ id: 'b', registrar: 'Namecheap', expiry_date: '2026-08-01', renewal_cost: 20 }),
      domain({ id: 'c', registrar: null, expiry_date: '2026-09-01', renewal_cost: 7 }),
    ];

    const { analysis } = computeAdvancedRenewalPanelData(domains, NO_TX, 2026, {
      anchorYear: 2026,
    });

    expect(analysis.cost_by_registrar).toEqual({ Namecheap: 32, Unknown: 7 });
    expect(analysis.total_estimated_cost).toBe(referenceYear(domains, NO_TX, 2026).estimated);
  });
})
