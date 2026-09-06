/**
 * "Effective expiry date" with a fallback chain — used by the dashboard's
 * expiring-soon logic, the renewal calendar feed, and any UI that wants to
 * show a domain's projected next expiry without dropping rows where the
 * user hasn't set the field explicitly.
 *
 * Priority:
 *   1. domain.expiry_date            ('explicit')
 *   2. domain.next_renewal_date      ('next_renewal_date')   – same concept,
 *      different field; legacy import shape uses this.
 *   3. purchase_date + (renewal_count + 1) × renewal_cycle   ('estimated')
 *      Why renewal_count + 1: the *current* expiry is the one renewal_count
 *      cycles after purchase; the *next* expiry is one cycle after that.
 *   4. nothing reliable               ('unknown')
 *
 * Callers should treat 'estimated' with weaker confidence — e.g. fewer
 * lead-time alarms in the calendar feed, an "(estimated)" marker in the
 * UI — and 'unknown' as a hint to nudge the user to fill expiry_date.
 */

import { parseLocalCalendarDate } from './localCalendarDate';

export type ExpirySource = 'explicit' | 'next_renewal_date' | 'estimated' | 'unknown';

export interface EffectiveExpiry {
  /** Local calendar date as Date object, or null when source = 'unknown'. */
  date: Date | null;
  source: ExpirySource;
}

interface DomainLike {
  expiry_date?: string | null;
  next_renewal_date?: string | null;
  purchase_date?: string | null;
  renewal_cycle?: number | null;
  renewal_count?: number | null;
}

/** 日期列按本地日历日解析：返回值会被拿去和 now 比、也会被 localCalendarDateISO
 *  之类的本地取值器读，UTC 解析会在负偏移时区整体偏一天。 */
const parse = parseLocalCalendarDate;

export function getEffectiveExpiry(domain: DomainLike): EffectiveExpiry {
  const explicit = parse(domain.expiry_date);
  if (explicit) return { date: explicit, source: 'explicit' };

  const fromRenewalField = parse(domain.next_renewal_date);
  if (fromRenewalField) return { date: fromRenewalField, source: 'next_renewal_date' };

  const purchase = parse(domain.purchase_date);
  if (purchase) {
    const cycle = Math.max(1, Math.floor(domain.renewal_cycle ?? 1) || 1);
    const renewals = Math.max(0, Math.floor(domain.renewal_count ?? 0) || 0);
    const yearsAhead = (renewals + 1) * cycle;
    const estimated = new Date(purchase);
    estimated.setFullYear(estimated.getFullYear() + yearsAhead);
    if (!Number.isNaN(estimated.getTime())) {
      return { date: estimated, source: 'estimated' };
    }
  }

  return { date: null, source: 'unknown' };
}

/** Convenience: number of whole calendar days from now until effective expiry; null when unknown.
 *
 *  两边都先归一到**本地日历日的零点**再相减。直接拿毫秒差去 ceil 有两个坑：
 *  now 带的时分秒会让结果随一天中的时刻抖动，夏令时切换的那一天只有 23 小时
 *  （或 25），跨过它的区间会莫名多/少一天。 */
export function daysUntilEffectiveExpiry(domain: DomainLike, now: Date = new Date()): number | null {
  const { date } = getEffectiveExpiry(domain);
  if (!date) return null;
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((startOfDay(date) - startOfDay(now)) / 86_400_000);
}
