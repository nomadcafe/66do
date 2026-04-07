/** 本地日历日 YYYY-MM-DD（避免 toISOString() 的 UTC 导致晚间跨日偏差） */
export function localCalendarDateISO(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
