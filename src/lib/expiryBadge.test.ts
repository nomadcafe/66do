/**
 * 到期徽章的判定，域名表格和域名卡片共用。
 *
 * 卡片以前完全不显示到期信息，而手机上列表被强制成卡片视图——也就是说在手机
 * 上打开域名列表，看不到任何一个域名什么时候到期。
 */
import { describe, it, expect } from 'vitest';
import { getExpiryBadge } from './expiryBadge';

const NOW = new Date(2026, 8, 13); // 2026-09-13 本地零点

const d = (over: Record<string, unknown> = {}) => ({
  status: 'active',
  expiry_date: '2026-12-01',
  ...over,
});

describe('getExpiryBadge', () => {
  it('按剩余天数分档：<=30 critical、<=90 soon、其余 ok', () => {
    expect(getExpiryBadge(d({ expiry_date: '2026-10-01' }), NOW)?.tone).toBe('critical');
    expect(getExpiryBadge(d({ expiry_date: '2026-11-15' }), NOW)?.tone).toBe('soon');
    expect(getExpiryBadge(d({ expiry_date: '2027-06-01' }), NOW)?.tone).toBe('ok');
  });

  it('已过期单独成一档', () => {
    const badge = getExpiryBadge(d({ expiry_date: '2026-08-01' }), NOW);
    expect(badge?.expired).toBe(true);
    expect(badge?.tone).toBe('expired');
    expect(badge!.days).toBeLessThan(0);
  });

  it('天数按本地日历日算，不随一天中的时刻跳变', () => {
    const morning = new Date(2026, 8, 13, 1, 0, 0);
    const night = new Date(2026, 8, 13, 23, 30, 0);
    const a = getExpiryBadge(d({ expiry_date: '2026-10-01' }), morning)!.days;
    const b = getExpiryBadge(d({ expiry_date: '2026-10-01' }), night)!.days;
    expect(a).toBe(b);
    expect(a).toBe(18);
  });

  it('已出售的域名不显示到期信息', () => {
    expect(getExpiryBadge(d({ status: 'sold' }), NOW)).toBeNull();
  });

  it('没填 expiry_date 就不显示——刻意不走 getEffectiveExpiry 的推算兜底', () => {
    expect(getExpiryBadge(d({ expiry_date: null }), NOW)).toBeNull();
    expect(getExpiryBadge(d({ expiry_date: undefined }), NOW)).toBeNull();
    // 有 next_renewal_date / purchase_date 也不推算
    expect(
      getExpiryBadge(
        d({ expiry_date: null, next_renewal_date: '2026-10-01', purchase_date: '2020-01-01' }),
        NOW
      )
    ).toBeNull();
  });
});
