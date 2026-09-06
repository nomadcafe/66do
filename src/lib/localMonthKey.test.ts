import { describe, it, expect } from 'vitest';
import { localMonthKey, parseLocalMonthKey } from './localCalendarDate';

describe('parseLocalMonthKey', () => {
  it('lands on the local first-of-month, not UTC midnight', () => {
    // 回归：图表渲染端曾经写 new Date('2026-09')，JS 按 ISO 规则当 UTC 午夜，
    // 在负偏移时区落回 8-31，getMonth() 少一格，整条 X 轴的月份标签早一个月。
    const d = parseLocalMonthKey('2026-09');
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2026);
    expect(d!.getMonth()).toBe(8); // 9 月
    expect(d!.getDate()).toBe(1);
    expect(d!.getHours()).toBe(0);
  });

  it('round-trips with localMonthKey for every month of a year', () => {
    for (let m = 0; m < 12; m++) {
      const key = localMonthKey(new Date(2026, m, 15));
      const back = parseLocalMonthKey(key);
      expect(back).not.toBeNull();
      expect(localMonthKey(back!)).toBe(key);
      expect(back!.getMonth()).toBe(m);
    }
  });

  it('rejects anything that is not a bare YYYY-MM', () => {
    expect(parseLocalMonthKey('2026-09-01')).toBeNull();
    expect(parseLocalMonthKey('2026-9')).toBeNull();
    expect(parseLocalMonthKey('')).toBeNull();
    expect(parseLocalMonthKey(null)).toBeNull();
    expect(parseLocalMonthKey(undefined)).toBeNull();
  });
});
