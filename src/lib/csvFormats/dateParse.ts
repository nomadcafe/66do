// 注册商导出的日期格式不统一：GoDaddy 用 "MM/DD/YYYY"，Namecheap 同样
// "MM/DD/YYYY"，自家导出用 "YYYY-MM-DD"。把所有形态归一成 ISO 短日期
// (YYYY-MM-DD) 喂给后端——validation 层只接受 ISO-ish 字符串。
//
// 实现选择 `new Date(...)` 而不是手写格式表：
//   - 支持的输入面广（浏览器对 "MM/DD/YYYY" / "Mon DD YYYY" / ISO 都解析）
//   - 失败安全：解析失败返回 null，调用方自然降级为不填日期
//
// **取值器必须是本地的，不能用 UTC 的。** 这里原本的注释写反了，说"输出走
// getUTCFullYear/getUTCMonth/getUTCDate 绕开时区"——而代码用的一直是本地
// 取值器，代码是对的、注释是错的。实测 "1/15/2025"：
//
//   TZ=+08  本地取值器 → 2025-01-15   UTC 取值器 → 2025-01-14  ✗
//   TZ=-05  本地取值器 → 2025-01-15   UTC 取值器 → 2025-01-15
//
// 因为 "MM/DD/YYYY" 被解析成**本地**午夜，再用 UTC 取值器读就会在东八区退
// 一天。照着那条旧注释去"修"代码，会让所有 UTC+ 用户导入的日期整体早一天。
// 纯 ISO 输入走上面的正则直接返回，压根不进 Date 解析，也就没有这个问题。
//
// 已知局限（不改，改了会伤到主流形态）：日期歧义无法消解。"05/01/2025" 一律
// 按 MM/DD 读成 5 月 1 日；欧洲习惯的 DD/MM 会被读错，而 "15/01/2025" 这种
// 明确越界的则解析失败返回 null（整条日期被丢掉，不会静默错）。当前支持的
// 五个注册商导出都是 MM/DD/YYYY。

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
