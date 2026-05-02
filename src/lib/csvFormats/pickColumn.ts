// 注册商 CSV 列名会因导出版本/时间不同有微小差异（"Expires" vs "Expiration
// Date"，"Created" vs "Year Created"）。pickColumn 给 adapter 一个简单的"按
// 优先级取第一个非空列"的接口。
//
// 比较走 normalize（小写、去空格/标点），所以传入候选列名怎么写都行。

import { normalizeHeader } from './types'

export function pickColumn(row: Record<string, string>, candidates: string[]): string | undefined {
  // 预建 row 的 normalized key map 一次（每行调用很多次 pickColumn 时摊销）
  const rowKeys = Object.keys(row)
  for (const candidate of candidates) {
    const targetNorm = normalizeHeader(candidate)
    const matchKey = rowKeys.find((k) => normalizeHeader(k) === targetNorm)
    if (matchKey) {
      const v = row[matchKey]
      if (v && v.trim()) return v.trim()
    }
  }
  return undefined
}
