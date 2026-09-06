'use client';

import { Domain } from '../types/domain';
import { localCalendarDateISO, parseLocalCalendarDate } from './localCalendarDate';

const DEFAULT_RENEWAL_CYCLE = 1;

// 续费时延长域名到期日，并把 renewal_count +1。
// 关键：renewalYears 是「这次续费要加几年」（可由用户在 RenewalModal 选 1/2/3/5），
// 不能跟 domain.renewal_cycle（域名自身的标准续费周期）混用。
//
// 基准日按 effectiveExpiry 的同一条兜底链取，顺序不能变：
//   1. expiry_date —— 用户给的精确日期
//   2. next_renewal_date —— 同一个概念的另一列（导入的旧数据形态写这里）。
//      这一档以前是漏的：明明有精确日期，却掉到下面的推算档去，purchase
//      2024-01-10 / next_renewal_date 2026-03-01 / count=0 续 1 年，算出来是
//      2026-01-10 而不是 2027-03-01——差 14 个月，而且把用户填的确切日期
//      直接丢了。注释当时已经写着「按 effectiveExpiry 同样的公式」，代码没做到。
//   3. purchase + (renewal_count + 1) × renewal_cycle —— 推算档
//      旧实现把 renewalYears 和 renewal_cycle 在 fallback 里同当一个量用，
//      count=0 时 +2yr 实际只多走了 1 个 cycle，账面显示「续了两年只延长一年」。
//
// 续完把 next_renewal_date 清空：这一列和 expiry_date 是同一个概念，续费后
// expiry_date 才是权威值，留着那个旧日期只会陈旧——DomainForm 没有对应的输入
// 控件（只在 state 里 round-trip），用户看不见也改不掉，一旦哪天 expiry_date
// 被清空，getEffectiveExpiry 就会把这个陈旧日期当成真的。信息没丢，它已经
// 搬进 expiry_date 了；删续费交易时 expiry_date 会被回退同样年数，正好还原。
export function handleDomainRenewal(domain: Domain, renewalYears?: number): Domain {
  const yearsToAdd = renewalYears || domain.renewal_cycle || DEFAULT_RENEWAL_CYCLE;
  const ownCycle = Math.max(1, Math.floor(domain.renewal_cycle || DEFAULT_RENEWAL_CYCLE));

  let baseDate: Date | null = null;
  if (domain.expiry_date) {
    // 必须按本地日历日解析：下面 setFullYear + localCalendarDateISO 全是本地
    // 取值器，UTC 解析会让负偏移时区每续费一次到期日就往前退一天。
    const d = parseLocalCalendarDate(domain.expiry_date);
    if (d) baseDate = d;
  }
  if (!baseDate && domain.next_renewal_date) {
    const d = parseLocalCalendarDate(domain.next_renewal_date);
    if (d) baseDate = d;
  }
  if (!baseDate && domain.purchase_date) {
    const purchase = parseLocalCalendarDate(domain.purchase_date);
    if (purchase) {
      baseDate = new Date(purchase);
      const priorCycles = (domain.renewal_count || 0) + 1;
      baseDate.setFullYear(baseDate.getFullYear() + priorCycles * ownCycle);
    }
  }

  let newExpiryDate = baseDate ? new Date(baseDate) : new Date();
  newExpiryDate.setFullYear(newExpiryDate.getFullYear() + yearsToAdd);

  if (Number.isNaN(newExpiryDate.getTime())) {
    const repair = new Date();
    repair.setFullYear(repair.getFullYear() + yearsToAdd);
    newExpiryDate = repair;
  }

  return {
    ...domain,
    expiry_date: localCalendarDateISO(newExpiryDate),
    // 只在原本就有值时才清，不往一个用户没用过的列里写东西
    ...(domain.next_renewal_date ? { next_renewal_date: undefined } : {}),
    renewal_count: (domain.renewal_count || 0) + 1,
    updated_at: new Date().toISOString(),
  };
}
