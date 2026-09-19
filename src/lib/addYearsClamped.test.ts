/**
 * 整年加减必须夹住闰日，否则 2 月 29 日会溢出成 3 月 1 日。
 *
 * 两层后果：日期不可逆地漂一天（续费再撤销回不到原点），以及更要紧的跨月——
 * expandRenewalEvents 从 expiry_date 往回推历次续费日期，闰日域名推出来的
 * 事件会全落在 3 月而不是 2 月，续费成本记进错误的月份。
 */
import { describe, it, expect } from 'vitest';
import { addYearsClamped, parseLocalCalendarDate, localCalendarDateISO } from './localCalendarDate';

const step = (iso: string, years: number) =>
  localCalendarDateISO(addYearsClamped(parseLocalCalendarDate(iso)!, years));

describe('addYearsClamped', () => {
  it('闰日加一年夹到 2 月 28（旧实现给 3 月 1 日）', () => {
    expect(step('2028-02-29', 1)).toBe('2029-02-28');
    expect(step('2028-02-29', 2)).toBe('2030-02-28');
  });

  it('目标年也是闰年时保留 2 月 29', () => {
    expect(step('2028-02-29', 4)).toBe('2032-02-29');
  });

  it('往回减同样夹住', () => {
    expect(step('2024-02-29', -1)).toBe('2023-02-28');
    expect(step('2024-02-29', -4)).toBe('2020-02-29');
  });

  it('续费再撤销能回到原点', () => {
    // 旧实现：2028-02-29 → 2029-03-01 → 2028-03-01，永久漂一天
    const renewed = step('2028-02-29', 1);
    expect(step(renewed, -1)).toBe('2028-02-28');
    // 夹过之后是稳定的：再来一轮不会继续漂
    expect(step(step('2028-02-28', 1), -1)).toBe('2028-02-28');
  });

  it('非闰日一律原样加减', () => {
    expect(step('2026-01-31', 1)).toBe('2027-01-31');
    expect(step('2026-03-31', 1)).toBe('2027-03-31');
    expect(step('2026-12-31', 1)).toBe('2027-12-31');
    expect(step('2026-06-15', 3)).toBe('2029-06-15');
  });

  it('0 年是恒等', () => {
    expect(step('2028-02-29', 0)).toBe('2028-02-29');
  });

  it('不修改传进来的 Date', () => {
    const d = parseLocalCalendarDate('2028-02-29')!;
    addYearsClamped(d, 1);
    expect(localCalendarDateISO(d)).toBe('2028-02-29');
  });
});
