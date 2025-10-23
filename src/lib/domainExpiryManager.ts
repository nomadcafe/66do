'use client';

import { Domain } from '../types/domain';

export interface ExpiryCalculationOptions {
  defaultRenewalCycle: number; // 默认续费周期（年）
  autoCalculateFromPurchase: boolean; // 是否从购买日期自动计算
  autoUpdateOnRenewal: boolean; // 续费时是否自动更新到期日期
  gracePeriodDays: number; // 宽限期天数
}

export class DomainExpiryManager {
  private options: ExpiryCalculationOptions;

  constructor(options: Partial<ExpiryCalculationOptions> = {}) {
    this.options = {
      defaultRenewalCycle: 1,
      autoCalculateFromPurchase: true,
      autoUpdateOnRenewal: true,
      gracePeriodDays: 30,
      ...options
    };
  }

  // 自动计算域名到期日期
  calculateExpiryDate(domain: Domain): string | null {
    // 如果已有到期日期，直接返回
    if (domain.expiry_date) {
      return domain.expiry_date;
    }

    // 从购买日期计算
    if (this.options.autoCalculateFromPurchase && domain.purchase_date) {
      const purchaseDate = new Date(domain.purchase_date);
      const renewalCycle = domain.renewal_cycle || this.options.defaultRenewalCycle;
      const expiryDate = new Date(purchaseDate);
      expiryDate.setFullYear(expiryDate.getFullYear() + renewalCycle);
      
      // 考虑已续费次数
      if (domain.renewal_count > 0) {
        expiryDate.setFullYear(expiryDate.getFullYear() + (domain.renewal_count * renewalCycle));
      }
      
      return expiryDate.toISOString().split('T')[0];
    }

    return null;
  }

  // 更新域名的到期日期
  updateDomainExpiry(domain: Domain, newExpiryDate?: string): Domain {
    let updatedExpiryDate: string | undefined = newExpiryDate;

    // 如果没有提供新的到期日期，自动计算
    if (!updatedExpiryDate) {
      const calculated = this.calculateExpiryDate(domain);
      updatedExpiryDate = calculated || undefined;
    }

    return {
      ...domain,
      expiry_date: updatedExpiryDate
    };
  }

  // 处理域名续费后的到期日期更新
  handleDomainRenewal(domain: Domain, renewalYears?: number): Domain {
    const renewalCycle = renewalYears || domain.renewal_cycle || this.options.defaultRenewalCycle;
    
    // 计算新的到期日期
    let newExpiryDate: Date;
    
    if (domain.expiry_date) {
      // 基于当前到期日期延长
      newExpiryDate = new Date(domain.expiry_date);
      newExpiryDate.setFullYear(newExpiryDate.getFullYear() + renewalCycle);
    } else {
      // 基于购买日期计算
      const purchaseDate = new Date(domain.purchase_date);
      newExpiryDate = new Date(purchaseDate);
      newExpiryDate.setFullYear(newExpiryDate.getFullYear() + renewalCycle);
      
      // 考虑已续费次数
      if (domain.renewal_count > 0) {
        newExpiryDate.setFullYear(newExpiryDate.getFullYear() + (domain.renewal_count * renewalCycle));
      }
    }

    return {
      ...domain,
      expiry_date: newExpiryDate.toISOString().split('T')[0],
      renewal_count: (domain.renewal_count || 0) + 1,
      updated_at: new Date().toISOString()
    };
  }

  // 批量更新域名的到期日期
  updateDomainsExpiry(domains: Domain[]): Domain[] {
    return domains.map(domain => this.updateDomainExpiry(domain));
  }

  // 检查域名是否需要设置到期日期
  needsExpiryDate(domain: Domain): boolean {
    return !domain.expiry_date && this.options.autoCalculateFromPurchase;
  }

  // 获取域名的到期状态
  getDomainExpiryStatus(domain: Domain): {
    hasExpiryDate: boolean;
    isExpired: boolean;
    daysUntilExpiry: number | null;
    needsRenewal: boolean;
    gracePeriodEnd: string | null;
  } {
    const hasExpiryDate = !!domain.expiry_date;
    let isExpired = false;
    let daysUntilExpiry: number | null = null;
    let needsRenewal = false;
    let gracePeriodEnd: string | null = null;

    if (hasExpiryDate) {
      const expiryDate = new Date(domain.expiry_date!);
      const now = new Date();
      const timeDiff = expiryDate.getTime() - now.getTime();
      daysUntilExpiry = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
      
      isExpired = daysUntilExpiry < 0;
      needsRenewal = daysUntilExpiry <= this.options.gracePeriodDays;
      
      if (isExpired) {
        const graceEnd = new Date(expiryDate);
        graceEnd.setDate(graceEnd.getDate() + this.options.gracePeriodDays);
        gracePeriodEnd = graceEnd.toISOString().split('T')[0];
      }
    }

    return {
      hasExpiryDate,
      isExpired,
      daysUntilExpiry,
      needsRenewal,
      gracePeriodEnd
    };
  }

  // 获取建议的到期日期
  getSuggestedExpiryDate(domain: Domain): string | null {
    if (domain.expiry_date) {
      return domain.expiry_date;
    }

    return this.calculateExpiryDate(domain);
  }

  // 验证到期日期的合理性
  validateExpiryDate(domain: Domain, expiryDate: string): {
    isValid: boolean;
    warnings: string[];
    suggestions: string[];
  } {
    const warnings: string[] = [];
    const suggestions: string[] = [];
    let isValid = true;

    const expiry = new Date(expiryDate);
    const purchase = new Date(domain.purchase_date);
    const now = new Date();

    // 检查到期日期是否在购买日期之后
    if (expiry <= purchase) {
      warnings.push('到期日期不能早于购买日期');
      isValid = false;
    }

    // 检查到期日期是否合理（不能太远）
    const yearsFromNow = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 365);
    if (yearsFromNow > 10) {
      warnings.push('到期日期似乎过于遥远，请确认是否正确');
    }

    // 检查是否与续费周期匹配
    const renewalCycle = domain.renewal_cycle || this.options.defaultRenewalCycle;
    const expectedExpiry = new Date(purchase);
    expectedExpiry.setFullYear(expectedExpiry.getFullYear() + renewalCycle);
    
    const daysDiff = Math.abs((expiry.getTime() - expectedExpiry.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff > 30) {
      suggestions.push(`建议的到期日期：${expectedExpiry.toISOString().split('T')[0]}（基于${renewalCycle}年续费周期）`);
    }

    return {
      isValid,
      warnings,
      suggestions
    };
  }

  // 获取域名续费建议
  getRenewalSuggestions(domain: Domain): {
    shouldRenew: boolean;
    urgency: 'critical' | 'urgent' | 'warning' | 'normal';
    suggestedRenewalDate: string | null;
    estimatedCost: number;
  } {
    const status = this.getDomainExpiryStatus(domain);
    
    let urgency: 'critical' | 'urgent' | 'warning' | 'normal' = 'normal';
    let shouldRenew = false;
    let suggestedRenewalDate: string | null = null;

    if (status.hasExpiryDate && status.daysUntilExpiry !== null) {
      if (status.daysUntilExpiry < 0) {
        urgency = 'critical';
        shouldRenew = true;
      } else if (status.daysUntilExpiry <= 7) {
        urgency = 'critical';
        shouldRenew = true;
      } else if (status.daysUntilExpiry <= 14) {
        urgency = 'urgent';
        shouldRenew = true;
      } else if (status.daysUntilExpiry <= 30) {
        urgency = 'warning';
        shouldRenew = true;
      }

      if (shouldRenew) {
        // 建议在到期前7天续费
        const suggestedDate = new Date(domain.expiry_date!);
        suggestedDate.setDate(suggestedDate.getDate() - 7);
        suggestedRenewalDate = suggestedDate.toISOString().split('T')[0];
      }
    }

    return {
      shouldRenew,
      urgency,
      suggestedRenewalDate,
      estimatedCost: domain.renewal_cost || 0
    };
  }

  // 更新设置
  updateOptions(newOptions: Partial<ExpiryCalculationOptions>) {
    this.options = { ...this.options, ...newOptions };
  }

  // 获取当前设置
  getOptions(): ExpiryCalculationOptions {
    return { ...this.options };
  }
}

// 导出单例实例
export const domainExpiryManager = new DomainExpiryManager();
