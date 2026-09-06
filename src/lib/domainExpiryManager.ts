'use client';

import { Domain } from '../types/domain';
import { localCalendarDateISO, parseLocalCalendarDate } from './localCalendarDate';

const DEFAULT_RENEWAL_CYCLE = 1;

// 续费时延长域名到期日，并把 renewal_count +1。
// 关键：renewalYears 是「这次续费要加几年」（可由用户在 RenewalModal 选 1/2/3/5），
// 不能跟 domain.renewal_cycle（域名自身的标准续费周期）混用。
//   - 有 expiry_date：直接 expiry + renewalYears。
//   - 无 expiry_date：先按 effectiveExpiry 同样的公式估算「当前到期日」
//     = purchase + (renewal_count + 1) × renewal_cycle，再 + renewalYears。
//     旧实现把 renewalYears 和 renewal_cycle 在 fallback 里同当一个量用，
//     count=0 时 +2yr 实际只多走了 1 个 cycle，账面显示「续了两年只延长一年」。
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
    renewal_count: (domain.renewal_count || 0) + 1,
    updated_at: new Date().toISOString(),
  };
}

// 校验用户在表单中输入的到期日期是否合理。
export function validateExpiryDate(
  domain: Domain,
  expiryDate: string
): { isValid: boolean; warnings: string[]; suggestions: string[] } {
  const warnings: string[] = [];
  const suggestions: string[] = [];
  let isValid = true;

  const expiry = parseLocalCalendarDate(expiryDate) ?? new Date(NaN);
  const purchase = parseLocalCalendarDate(domain.purchase_date) ?? new Date(NaN);
  const now = new Date();

  if (expiry <= purchase) {
    warnings.push('到期日期不能早于购买日期');
    isValid = false;
  }

  const yearsFromNow = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 365);
  if (yearsFromNow > 10) {
    warnings.push('到期日期似乎过于遥远，请确认是否正确');
  }

  const renewalCycle = domain.renewal_cycle || DEFAULT_RENEWAL_CYCLE;
  const expectedExpiry = new Date(purchase);
  expectedExpiry.setFullYear(expectedExpiry.getFullYear() + renewalCycle);

  const daysDiff = Math.abs((expiry.getTime() - expectedExpiry.getTime()) / (1000 * 60 * 60 * 24));
  if (daysDiff > 30) {
    suggestions.push(
      `建议的到期日期：${expectedExpiry.toISOString().split('T')[0]}（基于${renewalCycle}年续费周期）`
    );
  }

  return { isValid, warnings, suggestions };
}
