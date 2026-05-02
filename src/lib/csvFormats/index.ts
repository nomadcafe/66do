// 入口：detect + map。
//
// 设计取舍：
//   1. registry 顺序 = 优先级：registrar 格式排前面，generic 兜底。一个 CSV
//      同时能匹配 GoDaddy 和 generic 时（generic 只看 domain_name），希望
//      先返回 GoDaddy。
//   2. 识别走"required headers 全命中"硬门槛 + bonus 加分打破平局，避免
//      "随便一列叫 Domain Name 的 CSV" 错认成某 registrar。
//   3. 返回的 DetectionResult 包含原始格式 + 命中分数，UI 可以显示置信度
//      （现阶段没用，但便于未来加"识别不准？切换格式"按钮）。

import type { CsvFormat, MappedDomain } from './types'
import { normalizeHeader } from './types'
import { godaddyFormat } from './formats/godaddy'
import { namecheapFormat } from './formats/namecheap'
import { dynadotFormat } from './formats/dynadot'
import { spaceshipFormat } from './formats/spaceship'
import { namecomFormat } from './formats/namecom'
import { genericFormat } from './formats/generic'

const REGISTRY: CsvFormat[] = [
  godaddyFormat,
  namecheapFormat,
  dynadotFormat,
  spaceshipFormat,
  namecomFormat,
  genericFormat,
]

export interface DetectionResult {
  format: CsvFormat
  score: number
}

/** 找出最匹配的格式。无任何匹配返回 null（调用方应该报"未知 CSV 格式"）。 */
export function detectFormat(headers: string[]): DetectionResult | null {
  const headerNorms = new Set(headers.map(normalizeHeader))
  let best: DetectionResult | null = null
  for (const format of REGISTRY) {
    const requiredOk = format.requiredHeaders.every((h) => headerNorms.has(normalizeHeader(h)))
    if (!requiredOk) continue
    const bonusHits = (format.bonusHeaders ?? []).filter((h) =>
      headerNorms.has(normalizeHeader(h))
    ).length
    // 基础分 = required 数（保证 generic 这种 1 列的不会赢过 GoDaddy 这种 2
    // 列的）；bonus 拿来打破平局
    const score = format.requiredHeaders.length * 10 + bonusHits
    if (!best || score > best.score) {
      best = { format, score }
    }
  }
  return best
}

/** 映射所有行；跳过 mapRow 返回 null 的行（空行 / 重复表头）。 */
export function mapRows(rows: Record<string, string>[], format: CsvFormat): MappedDomain[] {
  const out: MappedDomain[] = []
  for (const row of rows) {
    const mapped = format.mapRow(row)
    if (mapped) out.push(mapped)
  }
  return out
}

export type { CsvFormat, MappedDomain } from './types'
