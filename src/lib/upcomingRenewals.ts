/**
 * 「即将到期」清单 —— Insights → Renewals 板块最可操作的那一屏。
 *
 * 和同目录的 renewalCostService 是互补关系，两者刻意用不同的口径：
 *   - renewalCostService 回答「哪一个自然年要花多少钱」，走 expandRenewalEvents，
 *     锚点只认精确日期：expiry_date，其次 next_renewal_date。
 *   - 这里回答「接下来 90 天该续哪些域名」，走 getEffectiveExpiry 的完整兜底链，
 *     所以还多收一档 `purchase + (count+1) × cycle` 推算出来的域名。
 *
 * 两边**只差这一档**，而且是刻意的：清单里多列一行的代价是用户瞟一眼去核对，
 * 预估里多加一笔的代价是仪表盘上一个被悄悄抬高的金额，容错标准不一样。
 * 置信度用 expiry_source 透传给 UI：'estimated' 的行会标出来，别让用户以为
 * 那是注册商给的确切日期。
 */

import { getEffectiveExpiry, type ExpirySource } from './effectiveExpiry';

/** 注册商缺失时的占位键。UI 负责翻译，不要直接渲染这个字面量。 */
export const UNKNOWN_REGISTRAR = 'Unknown';

export type UpcomingBucketKey = 'overdue' | 'd30' | 'd60' | 'd90';

/** 桶的上界（天）。overdue 单独处理，不在这里。 */
const BUCKET_BOUNDS: ReadonlyArray<{ key: Exclude<UpcomingBucketKey, 'overdue'>; maxDays: number }> = [
  { key: 'd30', maxDays: 30 },
  { key: 'd60', maxDays: 60 },
  { key: 'd90', maxDays: 90 },
];

export const DEFAULT_HORIZON_DAYS = BUCKET_BOUNDS[BUCKET_BOUNDS.length - 1].maxDays;

export interface UpcomingRenewalRow {
  domain_id: string;
  domain_name: string;
  /** 已归一：缺失时为 UNKNOWN_REGISTRAR */
  registrar: string;
  due_date: Date;
  /** 距今整日数，负数 = 已过期未处理 */
  days_until: number;
  /** 该次续费的预计花费；cost_known 为 false 时是 0，不要当真 */
  cost: number;
  cost_known: boolean;
  expiry_source: ExpirySource;
  bucket: UpcomingBucketKey;
}

export interface UpcomingRenewalsSummary {
  /** 按到期日升序；已过期的排最前 */
  rows: UpcomingRenewalRow[];
  buckets: Record<UpcomingBucketKey, { count: number; cost: number }>;
  /** 窗口内没有续费价的域名数 —— 有它在，合计就是偏低的 */
  unknown_cost_count: number;
  /** 活跃但连兜底链都算不出到期日的域名数，完全没法进清单 */
  unknown_expiry_count: number;
  /** 窗口内的合计（不含已过期，那是另一回事） */
  total_cost: number;
  horizon_days: number;
}

interface DomainLike {
  id: string;
  status: string;
  domain_name?: string;
  registrar?: string | null;
  renewal_cost?: number | null;
  renewal_cycle?: number | null;
  renewal_count?: number | null;
  purchase_date?: string | null;
  expiry_date?: string | null;
  next_renewal_date?: string | null;
}

/** 本地日历日零点。与 daysUntilEffectiveExpiry 同一套归一，避免时分秒抖动。 */
function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function bucketFor(daysUntil: number): UpcomingBucketKey | null {
  if (daysUntil < 0) return 'overdue';
  for (const b of BUCKET_BOUNDS) {
    if (daysUntil <= b.maxDays) return b.key;
  }
  return null; // 超出窗口
}

function emptyBuckets(): Record<UpcomingBucketKey, { count: number; cost: number }> {
  return {
    overdue: { count: 0, cost: 0 },
    d30: { count: 0, cost: 0 },
    d60: { count: 0, cost: 0 },
    d90: { count: 0, cost: 0 },
  };
}

export function computeUpcomingRenewals(
  domains: DomainLike[],
  options?: { now?: Date; horizonDays?: number }
): UpcomingRenewalsSummary {
  const now = options?.now ?? new Date();
  const horizonDays = options?.horizonDays ?? DEFAULT_HORIZON_DAYS;
  const today = startOfDay(now);

  // 与 renewalCostService 同口径：只剔除明确退出生命周期的，for_sale 仍需续费。
  const active = domains.filter((d) => d.status !== 'sold' && d.status !== 'expired');

  const rows: UpcomingRenewalRow[] = [];
  const buckets = emptyBuckets();
  let unknown_cost_count = 0;
  let unknown_expiry_count = 0;

  for (const d of active) {
    const { date, source } = getEffectiveExpiry(d);
    if (!date) {
      unknown_expiry_count++;
      continue;
    }

    const days_until = Math.round((startOfDay(date) - today) / 86_400_000);
    if (days_until > horizonDays) continue;

    const bucket = bucketFor(days_until);
    if (!bucket) continue;

    const rawCost = Number(d.renewal_cost);
    const cost_known = Number.isFinite(rawCost) && rawCost > 0;
    if (!cost_known) unknown_cost_count++;

    rows.push({
      domain_id: d.id,
      domain_name: d.domain_name || '',
      registrar: d.registrar || UNKNOWN_REGISTRAR,
      due_date: date,
      days_until,
      cost: cost_known ? rawCost : 0,
      cost_known,
      expiry_source: source,
      bucket,
    });

    buckets[bucket].count++;
    buckets[bucket].cost += cost_known ? rawCost : 0;
  }

  // 到期日升序；同一天的按域名名排，保证渲染顺序稳定。
  rows.sort((a, b) => a.days_until - b.days_until || a.domain_name.localeCompare(b.domain_name));

  const total_cost = buckets.d30.cost + buckets.d60.cost + buckets.d90.cost;

  return {
    rows,
    buckets,
    unknown_cost_count,
    unknown_expiry_count,
    total_cost,
    horizon_days: horizonDays,
  };
}
