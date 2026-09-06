import { describe, it, expect } from 'vitest';
import {
  computeUpcomingRenewals,
  DEFAULT_HORIZON_DAYS,
  UNKNOWN_REGISTRAR,
} from './upcomingRenewals';

type Domain = Parameters<typeof computeUpcomingRenewals>[0][number];

// 固定「今天」，否则用例会随运行日期漂
const NOW = new Date(2026, 8, 6); // 2026-09-06 本地时

/** 相对 NOW 的第 n 天，返回 YYYY-MM-DD */
function inDays(n: number): string {
  const d = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() + n);
  const pad = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function domain(over: Partial<Domain> & { id: string }): Domain {
  return {
    status: 'active',
    domain_name: `${over.id}.com`,
    registrar: 'Namecheap',
    renewal_cost: 12,
    renewal_cycle: 1,
    renewal_count: 0,
    purchase_date: '2024-01-10',
    expiry_date: inDays(10),
    ...over,
  };
}

const run = (domains: Domain[], horizonDays?: number) =>
  computeUpcomingRenewals(domains, { now: NOW, horizonDays });

describe('computeUpcomingRenewals', () => {
  it('buckets by urgency and keeps anything past the horizon out', () => {
    const { buckets, rows } = run([
      domain({ id: 'late', expiry_date: inDays(-5) }),
      domain({ id: 'soon', expiry_date: inDays(3) }),
      domain({ id: 'today', expiry_date: inDays(0) }),
      domain({ id: 'mid', expiry_date: inDays(45) }),
      domain({ id: 'far', expiry_date: inDays(80) }),
      domain({ id: 'beyond', expiry_date: inDays(200) }),
    ]);

    expect(rows.map((r) => r.domain_id)).toEqual(['late', 'today', 'soon', 'mid', 'far']);
    expect(buckets.overdue.count).toBe(1);
    expect(buckets.d30.count).toBe(2); // today + soon
    expect(buckets.d60.count).toBe(1);
    expect(buckets.d90.count).toBe(1);
  });

  it('boundary days land in the lower bucket', () => {
    const { rows } = run([
      domain({ id: 'a', expiry_date: inDays(30) }),
      domain({ id: 'b', expiry_date: inDays(31) }),
      domain({ id: 'c', expiry_date: inDays(60) }),
      domain({ id: 'd', expiry_date: inDays(61) }),
      domain({ id: 'e', expiry_date: inDays(90) }),
      domain({ id: 'f', expiry_date: inDays(91) }),
    ]);

    const bucketOf = (id: string) => rows.find((r) => r.domain_id === id)?.bucket;
    expect(bucketOf('a')).toBe('d30');
    expect(bucketOf('b')).toBe('d60');
    expect(bucketOf('c')).toBe('d60');
    expect(bucketOf('d')).toBe('d90');
    expect(bucketOf('e')).toBe('d90');
    expect(bucketOf('f')).toBeUndefined(); // 超出 90 天窗口
  });

  it('excludes sold and expired domains, keeps for_sale', () => {
    const { rows } = run([
      domain({ id: 'held' }),
      domain({ id: 'listed', status: 'for_sale' }),
      domain({ id: 'gone', status: 'sold' }),
      domain({ id: 'dropped', status: 'expired' }),
    ]);

    expect(rows.map((r) => r.domain_id).sort()).toEqual(['held', 'listed']);
  });

  it('reports domains with no renewal cost instead of pretending they cost nothing', () => {
    const { buckets, total_cost, unknown_cost_count, rows } = run([
      domain({ id: 'priced', expiry_date: inDays(5), renewal_cost: 20 }),
      domain({ id: 'unpriced', expiry_date: inDays(6), renewal_cost: null }),
      domain({ id: 'zero', expiry_date: inDays(7), renewal_cost: 0 }),
    ]);

    expect(buckets.d30.count).toBe(3);
    expect(buckets.d30.cost).toBe(20);
    expect(total_cost).toBe(20);
    expect(unknown_cost_count).toBe(2);
    expect(rows.find((r) => r.domain_id === 'unpriced')?.cost_known).toBe(false);
  });

  it('counts domains with no usable expiry date separately — they cannot be listed at all', () => {
    const { rows, unknown_expiry_count } = run([
      domain({ id: 'ok' }),
      domain({ id: 'blind', expiry_date: null, purchase_date: null, next_renewal_date: null }),
    ]);

    expect(rows).toHaveLength(1);
    expect(unknown_expiry_count).toBe(1);
  });

  it('falls back through next_renewal_date and the purchase estimate', () => {
    // 年度面板只认 expiry_date，这里走 getEffectiveExpiry 的兜底链，
    // 所以这两类域名照样能被催到，只是置信度标为 estimated / next_renewal_date。
    const { rows } = run([
      domain({ id: 'viaNext', expiry_date: null, next_renewal_date: inDays(12) }),
      domain({
        id: 'viaPurchase',
        expiry_date: null,
        next_renewal_date: null,
        purchase_date: inDays(20 - 365),
        renewal_cycle: 1,
        renewal_count: 0,
      }),
    ]);

    expect(rows.find((r) => r.domain_id === 'viaNext')?.expiry_source).toBe('next_renewal_date');
    expect(rows.find((r) => r.domain_id === 'viaPurchase')?.expiry_source).toBe('estimated');
  });

  it('normalises a missing registrar to the shared sentinel', () => {
    const { rows } = run([domain({ id: 'a', registrar: null })]);
    expect(rows[0].registrar).toBe(UNKNOWN_REGISTRAR);
  });

  it('sorts by due date, then by name for a stable render order', () => {
    const { rows } = run([
      domain({ id: 'zeta', domain_name: 'zeta.com', expiry_date: inDays(4) }),
      domain({ id: 'alpha', domain_name: 'alpha.com', expiry_date: inDays(4) }),
      domain({ id: 'first', domain_name: 'first.com', expiry_date: inDays(1) }),
    ]);

    expect(rows.map((r) => r.domain_name)).toEqual(['first.com', 'alpha.com', 'zeta.com']);
  });

  it('honours a custom horizon', () => {
    const { rows, horizon_days } = run([domain({ id: 'a', expiry_date: inDays(20) })], 14);
    expect(rows).toHaveLength(0);
    expect(horizon_days).toBe(14);
    expect(DEFAULT_HORIZON_DAYS).toBe(90);
  });

  it('is empty, not broken, with no domains at all', () => {
    const s = run([]);
    expect(s.rows).toEqual([]);
    expect(s.total_cost).toBe(0);
    expect(s.buckets.overdue).toEqual({ count: 0, cost: 0 });
  });
});
