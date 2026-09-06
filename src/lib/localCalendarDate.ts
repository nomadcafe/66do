/** 本地日历日 YYYY-MM-DD（避免 toISOString() 的 UTC 导致晚间跨日偏差） */
export function localCalendarDateISO(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** DB 里 date 列的形态：'YYYY-MM-DD'，没有时间也没有时区 */
const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * 把日期列的值解析成**本地**日历日的零点。
 *
 * 不能直接用 `new Date('2026-01-01')`：那按 ISO 规则解释成 **UTC 午夜**，而之后
 * 代码读的却是 `.getFullYear()` / `.getMonth()` 这些**本地**取值器。在负偏移
 * 时区（整个美洲）UTC 午夜落回前一天，于是 1 月 1 日的交易被算进上一年、
 * 每月首日的交易被算进上个月——JST 和 CI 的 UTC 都复现不出来，只有用户会中。
 *
 * 带时间部分的值（created_at 这类 timestamptz）是真实时刻而不是日历日，
 * 原样交给 Date 解析。
 */
export function parseLocalCalendarDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;

  const m = DATE_ONLY_RE.exec(trimmed);
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const d = new Date(trimmed);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** 本地日历月 'YYYY-MM'。与 parseLocalCalendarDate 配对使用——
 *  用 toISOString().slice(0,7) 会在正偏移时区把每月 1 号推回上个月。 */
export function localMonthKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/**
 * 取日历年。'YYYY-MM-DD' 直接从字符串切——结果与运行时区无关，这是最强的
 * 保证；其他形态才退回 Date 解析。
 */
export function calendarYearOf(value: string | null | undefined): number {
  if (!value) return NaN;
  const trimmed = String(value).trim();
  const m = DATE_ONLY_RE.exec(trimmed);
  if (m) return Number(m[1]);
  const d = parseLocalCalendarDate(trimmed);
  return d ? d.getFullYear() : NaN;
}
