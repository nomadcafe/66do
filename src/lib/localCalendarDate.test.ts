import { describe, it, expect } from 'vitest';
import {
  calendarYearOf,
  localCalendarDateISO,
  localMonthKey,
  parseLocalCalendarDate,
} from './localCalendarDate';
import { calculateYearlyRenewalVsProfit, expandSellToCashReceipts } from './coreCalculations';
import { handleDomainRenewal } from './domainExpiryManager';
import type { DomainWithTags, TransactionWithRequiredFields } from '../types/dashboard';
import type { Domain } from '../types/domain';

// 这一组断言必须在**任何**时区下都成立，所以：
//   - 期望值全部是日历日 / 日历年，不是 UTC 瞬间
//   - 测试里不出现 'Z' 结尾的构造
// 用 `TZ=America/New_York npm test` 之类的方式换时区跑一遍即可复核。
// 回归对象是"UTC 解析 + 本地取值器"混用：负偏移时区把 1 月 1 日读成上一年，
// 正偏移时区把每月 1 号读成上个月。

describe('parseLocalCalendarDate', () => {
  it('把 date 列解析成本地日历日，而不是 UTC 午夜', () => {
    const d = parseLocalCalendarDate('2026-01-01')!;
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(0);
    expect(d.getDate()).toBe(1);
  });

  it('往返 localCalendarDateISO 不丢天', () => {
    for (const s of ['2026-01-01', '2026-12-31', '2024-02-29', '2025-07-04']) {
      expect(localCalendarDateISO(parseLocalCalendarDate(s)!)).toBe(s);
    }
  });

  it('带时间的 timestamptz 仍按真实时刻解析', () => {
    expect(parseLocalCalendarDate('2026-01-01T12:34:56Z')!.getTime()).toBe(
      Date.parse('2026-01-01T12:34:56Z')
    );
  });

  it('空值 / 垃圾串返回 null', () => {
    expect(parseLocalCalendarDate(null)).toBeNull();
    expect(parseLocalCalendarDate('')).toBeNull();
    expect(parseLocalCalendarDate('   ')).toBeNull();
    expect(parseLocalCalendarDate('not-a-date')).toBeNull();
  });
});

describe('calendarYearOf / localMonthKey', () => {
  it('日历年直接来自字符串，与时区无关', () => {
    expect(calendarYearOf('2026-01-01')).toBe(2026);
    expect(calendarYearOf('2025-12-31')).toBe(2025);
  });

  it('月份 key 取本地日历月', () => {
    expect(localMonthKey(parseLocalCalendarDate('2026-01-01')!)).toBe('2026-01');
    expect(localMonthKey(parseLocalCalendarDate('2026-12-31')!)).toBe('2026-12');
  });
});

const domain = (over: Partial<DomainWithTags> = {}): DomainWithTags =>
  ({
    id: 'd1',
    domain_name: 'example.com',
    status: 'sold',
    renewal_count: 0,
    renewal_cycle: 1,
    tags: [],
    ...over,
  }) as DomainWithTags;

const sell = (date: string, amount: number): TransactionWithRequiredFields =>
  ({
    id: `t-${date}`,
    domain_id: 'd1',
    type: 'sell',
    amount,
    currency: 'USD',
    net_amount: amount,
    date,
    payment_plan: 'lump_sum',
  }) as TransactionWithRequiredFields;

describe('年度 / 月度分桶的跨时区一致性', () => {
  it('元旦的出售算在当年（负偏移时区曾经算进上一年）', () => {
    const rows = calculateYearlyRenewalVsProfit(
      [sell('2026-01-01', 1000)],
      [domain()],
      new Date(2026, 5, 1)
    );
    expect(rows.map((r) => ({ year: r.year, saleNet: r.saleNet }))).toContainEqual({
      year: 2026,
      saleNet: 1000,
    });
  });

  it('跨年那天的出售算在当年（除夕不能被推到下一年）', () => {
    const rows = calculateYearlyRenewalVsProfit(
      [sell('2025-12-31', 500)],
      [domain()],
      new Date(2026, 5, 1)
    );
    expect(rows.map((r) => ({ year: r.year, saleNet: r.saleNet }))).toContainEqual({
      year: 2025,
      saleNet: 500,
    });
  });

  it('年度桶与月度桶对同一笔钱给出同一个年份', () => {
    const tx = sell('2026-01-01', 1000);
    const rows = calculateYearlyRenewalVsProfit([tx], [domain()], new Date(2026, 5, 1));
    const yearFromRows = rows.find((r) => r.saleNet === 1000)!.year;
    const monthKey = expandSellToCashReceipts(tx)[0].monthKey;
    expect(monthKey.slice(0, 4)).toBe(String(yearFromRows));
    expect(monthKey).toBe('2026-01');
  });
});

const renewable = (expiry: string): Domain =>
  ({
    id: 'd1',
    domain_name: 'example.com',
    status: 'active',
    registrar: 'namecheap',
    expiry_date: expiry,
    renewal_count: 0,
    renewal_cycle: 1,
  }) as unknown as Domain;

describe('续费不改变到期日的"日"', () => {
  it('到期日 +N 年，日和月保持不变（负偏移时区曾经每续一次退一天）', () => {
    expect(handleDomainRenewal(renewable('2027-06-15'), 1).expiry_date).toBe('2028-06-15');
    expect(handleDomainRenewal(renewable('2026-01-01'), 2).expiry_date).toBe('2028-01-01');
  });

  it('连续续费不累积漂移', () => {
    let d = renewable('2026-03-10');
    for (let i = 0; i < 5; i++) d = handleDomainRenewal(d, 1);
    expect(d.expiry_date).toBe('2031-03-10');
  });
});
