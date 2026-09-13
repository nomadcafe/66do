/**
 * CSV 导入的日期归一化。
 *
 * 这个函数决定每个导入进来的域名拿到哪一天，而它之前一个测试都没有——偏偏
 * 它的注释还写反了（说输出走 UTC 取值器，实际代码用的是本地取值器，而且本地
 * 才是对的）。这里把正确行为钉住，免得下次有人照着注释去"修"。
 */
import { describe, it, expect } from 'vitest';
import { parseLooseDate } from './dateParse';

describe('parseLooseDate', () => {
  it('ISO 短日期原样返回，不进 Date 解析', () => {
    expect(parseLooseDate('2025-01-15')).toBe('2025-01-15');
    expect(parseLooseDate('  2025-12-31  ')).toBe('2025-12-31');
  });

  it('MM/DD/YYYY（五个注册商导出的通用形态）不跨天', () => {
    // 用 UTC 取值器的话，这一条在东八区会变成 2025-01-14
    expect(parseLooseDate('1/15/2025')).toBe('2025-01-15');
    expect(parseLooseDate('01/15/2025')).toBe('2025-01-15');
    expect(parseLooseDate('12/31/2025')).toBe('2025-12-31');
  });

  it('月初和年初这种最容易跨天的日子也不跨', () => {
    expect(parseLooseDate('1/1/2025')).toBe('2025-01-01');
    expect(parseLooseDate('3/1/2026')).toBe('2026-03-01');
  });

  it('文字月份形态也能吃', () => {
    expect(parseLooseDate('Jan 15, 2025')).toBe('2025-01-15');
  });

  it('空 / 无法解析时返回 null，调用方降级为不填日期', () => {
    expect(parseLooseDate(null)).toBeNull();
    expect(parseLooseDate(undefined)).toBeNull();
    expect(parseLooseDate('')).toBeNull();
    expect(parseLooseDate('   ')).toBeNull();
    expect(parseLooseDate('not a date')).toBeNull();
  });

  it('越界的 DD/MM 解析失败而不是静默读错', () => {
    // 15 月不存在 → null，整条日期被丢掉
    expect(parseLooseDate('15/01/2025')).toBeNull();
  });

  it('输出的格式能被应用的本地日历日解析器吃下', () => {
    const out = parseLooseDate('1/15/2025')!;
    expect(out).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
