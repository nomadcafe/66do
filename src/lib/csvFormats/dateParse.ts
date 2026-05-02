// 注册商导出的日期格式不统一：GoDaddy 用 "MM/DD/YYYY"，Namecheap 同样
// "MM/DD/YYYY"，自家导出用 "YYYY-MM-DD"。把所有形态归一成 ISO 短日期
// (YYYY-MM-DD) 喂给后端——validation 层只接受 ISO-ish 字符串。
//
// 实现选择 `new Date(...)` 而不是手写格式表：
//   - 支持的输入面广（浏览器对 "MM/DD/YYYY" / "Mon DD YYYY" / ISO 都解析）
//   - 失败安全：解析失败返回 null，调用方自然降级为不填日期
//   - 时区陷阱：`new Date('2025-01-15')` 在浏览器里被解释为 UTC 午夜，再
//     toISOString().slice(0,10) 不会跨天；但 `new Date('1/15/2025')` 是
//     local 午夜 → 在 UTC- 时区下 toISOString 会回退一天。所以输出走
//     getUTCFullYear/getUTCMonth/getUTCDate 拼成的纯字符串，绕开时区。

export function parseLooseDate(input: string | undefined | null): string | null {
  if (!input) return null
  const trimmed = input.trim()
  if (!trimmed) return null
  // 已经是 YYYY-MM-DD：直接用，避免走 Date 解析时区漂移
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed
  const d = new Date(trimmed)
  if (isNaN(d.getTime())) return null
  const yyyy = d.getFullYear().toString().padStart(4, '0')
  const mm = (d.getMonth() + 1).toString().padStart(2, '0')
  const dd = d.getDate().toString().padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}
