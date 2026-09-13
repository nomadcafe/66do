import { describe, it, expect } from 'vitest';
import {
  renewalCostPerYear,
  renewalAmountForYears,
  renewalCostFromPayment,
} from './renewalPricing';

describe('renewalPricing', () => {
  it('一年一续的域名：换算前后都是同一个数（改动前后行为不变的那一档）', () => {
    expect(renewalCostPerYear(20, 1)).toBe(20);
    expect(renewalAmountForYears(20, 1, 1)).toBe(20);
    expect(renewalAmountForYears(20, 1, 3)).toBe(60);
    expect(renewalCostFromPayment(60, 3, 1)).toBe(20);
  });

  it('两年一续 $80：每年 $40，续满一个周期就是 $80', () => {
    expect(renewalCostPerYear(80, 2)).toBe(40);
    // 以前这里预填 80 × 2 = 160，多一倍
    expect(renewalAmountForYears(80, 2, 2)).toBe(80);
    expect(renewalAmountForYears(80, 2, 1)).toBe(40);
    expect(renewalAmountForYears(80, 2, 4)).toBe(160);
  });

  it('预填→提交 的往返不改变 stored 单价（以前每续一次就砍半）', () => {
    for (const cycle of [1, 2, 3, 5]) {
      for (const years of [1, 2, 3, 5]) {
        const stored = 90;
        const amount = renewalAmountForYears(stored, cycle, years);
        expect(renewalCostFromPayment(amount, years, cycle)).toBeCloseTo(stored, 9);
      }
    }
  });

  it('用户手改金额时，按「他为几年付了多少」折算回一个周期的价', () => {
    // 2 年一续的域名，这次只续 1 年、付了 $50 → 每年 $50 → 一个周期 $100
    expect(renewalCostFromPayment(50, 1, 2)).toBe(100);
    // 2 年一续，续 2 年付了 $80 → 一个周期就是 $80
    expect(renewalCostFromPayment(80, 2, 2)).toBe(80);
  });

  it('周期 / 年数非法时退回 1，不产生 NaN 或 Infinity', () => {
    expect(renewalCostPerYear(50, 0)).toBe(50);
    expect(renewalCostPerYear(50, -3)).toBe(50);
    expect(renewalCostPerYear(50, NaN)).toBe(50);
    expect(renewalAmountForYears(50, 2, 0)).toBe(25);
    expect(renewalCostFromPayment(50, 0, 2)).toBe(100);
    expect(Number.isFinite(renewalCostFromPayment(NaN, 2, 2))).toBe(true);
  });
});
