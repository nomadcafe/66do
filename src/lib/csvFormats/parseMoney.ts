// 注册商导出里"价格 / 估值"列的格式比日期还乱：
//   GoDaddy: "$ 402.00"      （$ 后面带空格）
//   通用:    "$1,234.56"     （千分位逗号）
//   一些场合: "402"           （纯数字）
//   缺值:    "" / "N/A" / "Free" → 返回 null
//
// 实现选择：剥掉一切非数字、非小数点字符，然后 parseFloat。这样 "$ 1,234.56"
// → "1234.56" → 1234.56。负数 / 多个小数点等病态输入会得 NaN → 返回 null。

export function parseMoneyAmount(input: string | undefined | null): number | null {
  if (!input) return null
  const trimmed = input.trim()
  if (!trimmed) return null
  // 留下数字 + '.'；其他全删（含 $, 空格, 逗号, 字母）
  const digits = trimmed.replace(/[^\d.]/g, '')
  if (!digits) return null
  const n = parseFloat(digits)
  if (!Number.isFinite(n) || n < 0) return null
  return n
}
