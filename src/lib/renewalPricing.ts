/**
 * `domain.renewal_cost` 的单位换算。
 *
 * **口径：renewal_cost 是「一次续费」的价格，这一次覆盖 renewal_cycle 年。**
 * 不是每年价。整个分析层都按这个口径写、并且有测试钉住：
 *   - expandRenewalEvents: `{ amount: renewal_cost, years: cycle }`
 *     （测试：cycle 2 / cost 80 → 两次事件各 80）
 *   - archiveRenewalCost:  归档次数 × renewal_cost
 *   - renewalCostService:  每年价 = renewal_cost / cycle
 *     （测试："2 年 $30 的域名，每年 $15"）
 *   - upcomingRenewals:    清单里每行的 cost 就是 renewal_cost
 *
 * 而续费弹窗那条写入路径原本按「每年价」在算（变量就叫 perYear，金额预填是
 * renewal_cost × 年数，回写是 amount / 年数）。两种读法在 cycle === 1 时完全
 * 一致 —— 绝大多数域名都是一年一续，所以一直没暴露。cycle > 1 时就分叉了：
 *
 *   2 年一续、真实价 $80 的域名（renewal_cost = 80）
 *     预填：80 × 2 = $160        ← 多一倍
 *     用户若改回真实的 $80 再提交、且勾着「更新续费价」（默认勾）
 *     回写：80 / 2 = $40         ← 存进去的单价被砍半
 *   下次再续一遍，又砍一半。成本基准就这么一路缩水，利润随之虚高。
 *
 * 把换算收在这里，两边都调同一个函数，口径不可能再各写一套。
 */

/** 每年价 = 一次续费的价 ÷ 这一次覆盖的年数。cycle 非法时按 1 年算。 */
export function renewalCostPerYear(renewalCost: number, cycle: number): number {
  const c = normalizeCycle(cycle);
  const cost = Number(renewalCost);
  return Number.isFinite(cost) ? cost / c : 0;
}

/** 续 `years` 年要付多少：每年价 × 年数。用于续费弹窗的金额预填。 */
export function renewalAmountForYears(
  renewalCost: number,
  cycle: number,
  years: number
): number {
  const y = normalizeYears(years);
  return renewalCostPerYear(renewalCost, cycle) * y;
}

/**
 * 反向：用户为 `years` 年付了 `amount`，换算回「一次续费（cycle 年）」的价，
 * 也就是能存回 domain.renewal_cost 的那个数。
 */
export function renewalCostFromPayment(
  amount: number,
  years: number,
  cycle: number
): number {
  const a = Number(amount);
  if (!Number.isFinite(a)) return 0;
  return (a / normalizeYears(years)) * normalizeCycle(cycle);
}

function normalizeCycle(cycle: number): number {
  const c = Math.floor(Number(cycle));
  return Number.isFinite(c) && c > 0 ? c : 1;
}

function normalizeYears(years: number): number {
  const y = Math.floor(Number(years));
  return Number.isFinite(y) && y > 0 ? y : 1;
}
