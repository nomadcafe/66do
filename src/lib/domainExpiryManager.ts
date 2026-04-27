'use client';

import { Domain } from '../types/domain';
import { localCalendarDateISO } from './localCalendarDate';

const DEFAULT_RENEWAL_CYCLE = 1;

// 续费时延长域名到期日，并把 renewal_count +1。
// 优先在现有 expiry_date 上加年；没 expiry_date 时用 purchase_date + (renewal_count+1) * cycle 兜底。
export function handleDomainRenewal(domain: Domain, renewalYears?: number): Domain {
  const renewalCycle = renewalYears || domain.renewal_cycle || DEFAULT_RENEWAL_CYCLE;

  let newExpiryDate: Date;

  if (domain.expiry_date) {
    newExpiryDate = new Date(domain.expiry_date);
    if (Number.isNaN(newExpiryDate.getTime())) {
      newExpiryDate = domain.purchase_date ? new Date(domain.purchase_date) : new Date();
    }
    newExpiryDate.setFullYear(newExpiryDate.getFullYear() + renewalCycle);
  } else {
    const purchaseDate = domain.purchase_date ? new Date(domain.purchase_date) : new Date();
    newExpiryDate = Number.isNaN(purchaseDate.getTime()) ? new Date() : new Date(purchaseDate);
    newExpiryDate.setFullYear(newExpiryDate.getFullYear() + renewalCycle);
    if (domain.renewal_count > 0) {
      newExpiryDate.setFullYear(newExpiryDate.getFullYear() + (domain.renewal_count * renewalCycle));
    }
  }

  if (Number.isNaN(newExpiryDate.getTime())) {
    const repair = new Date();
    repair.setFullYear(repair.getFullYear() + renewalCycle);
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

  const expiry = new Date(expiryDate);
  const purchase = new Date(domain.purchase_date);
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
