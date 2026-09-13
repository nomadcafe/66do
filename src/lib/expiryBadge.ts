import { daysUntilEffectiveExpiry } from './effectiveExpiry';

export interface ExpiryBadge {
  /** 距今天数；负数 = 已过期 */
  days: number;
  /** 已过期时为 true，UI 负责显示"已过期"而不是天数 */
  expired: boolean;
  /** 紧迫度：<=30 天 critical，<=90 天 soon，其余 ok */
  tone: 'expired' | 'critical' | 'soon' | 'ok';
}

/**
 * 域名列表里那枚「还有几天到期」徽章的判定。表格和卡片共用。
 *
 * 刻意只读字面的 expiry_date，不走 getEffectiveExpiry 的兜底链——这是表格
 * 原有的语义（"没填就不显示"），把它抽出来时一并保留：列表里的徽章应当如实
 * 反映用户填没填，推算出来的日期由 Insights → Renewals 那一屏负责，那里会把
 * expiry_source 标成 estimated。
 *
 * 天数走 daysUntilEffectiveExpiry 而不是自己减：两边都按本地日历日零点归一，
 * 否则同一个域名在不同视图里会差一天（UTC 午夜 vs 真实时刻，得数随一天中的
 * 时刻跳变）。
 */
export function getExpiryBadge(
  domain: { status: string; expiry_date?: string | null },
  now: Date = new Date()
): ExpiryBadge | null {
  // 已出售的域名不再需要续费，不显示到期信息
  if (domain.status === 'sold') return null;
  if (!domain.expiry_date) return null;

  const days = daysUntilEffectiveExpiry({ expiry_date: domain.expiry_date }, now);
  if (days === null) return null;

  const tone: ExpiryBadge['tone'] =
    days < 0 ? 'expired' : days <= 30 ? 'critical' : days <= 90 ? 'soon' : 'ok';

  return { days, expired: days < 0, tone };
}

/** 徽章文字色。表格和卡片同一套，改一处两处都跟着变。 */
export const EXPIRY_TONE_CLASS: Record<ExpiryBadge['tone'], string> = {
  expired: 'text-rose-700',
  critical: 'text-rose-600',
  soon: 'text-amber-600',
  ok: 'text-emerald-600',
};
