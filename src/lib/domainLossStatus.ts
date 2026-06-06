// 域名是否构成"已实现损失"的统一判定。
//
// 设计：到期 ≠ 立即损失。域名过了 expiry_date 后，注册商仍有宽限期可续，
// 持有者也常常会续。所以刚过期只是"待续费"信号（dashboard 负责提醒），
// 只有过了宽限期仍未续费，才把它当作已实现损失计入财务口径。
//
// 这里只读 status / expiry_date，不修改任何状态字段——状态仍由用户手动维护。
// ROI(-100%) 与过期损失统计共用本判定，保证两处口径一致。

const DAY_MS = 86_400_000;

/** 过期后到计入损失之间的宽限天数。续费会延长 expiry_date，从而自动退出该窗口。 */
export const EXPIRY_GRACE_DAYS = 30;

/**
 * 该域名是否已构成损失？
 * - status === 'sold'    → 否（已出售，盈亏走交易口径）
 * - status === 'expired' → 是（用户手动放弃，立即计入，不走宽限期）
 * - 其它状态             → 仅当 expiry_date 已过去超过 graceDays 才计入
 *                          （expiry_date 缺失或非法时视为未损失）
 */
export function isDomainLost(
  domain: { status: string; expiry_date?: string | null },
  now: Date = new Date(),
  graceDays: number = EXPIRY_GRACE_DAYS
): boolean {
  if (domain.status === 'sold') return false;
  if (domain.status === 'expired') return true;
  if (!domain.expiry_date) return false;

  const expiry = new Date(domain.expiry_date);
  if (Number.isNaN(expiry.getTime())) return false;

  return now.getTime() - expiry.getTime() > graceDays * DAY_MS;
}

/**
 * 客观已损失、但用户尚未手动标记的域名：status 仍是 active/for_sale，
 * 却已过宽限期未续。用于在不改写 status 的前提下，给界面徽章加"逾期未续"提示，
 * 与用户手动标记的 expired（已主动放弃）区分开。
 */
export function isExpiredButNotMarked(
  domain: { status: string; expiry_date?: string | null },
  now: Date = new Date(),
  graceDays: number = EXPIRY_GRACE_DAYS
): boolean {
  if (domain.status === 'expired' || domain.status === 'sold') return false;
  return isDomainLost(domain, now, graceDays);
}
