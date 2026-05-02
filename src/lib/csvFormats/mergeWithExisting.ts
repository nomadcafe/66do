// CSV 导入的"按 name 匹配 + 字段保留"合并逻辑。
//
// 为什么需要这一层：
//   - saveData 走 id 主键 diff（useDashboardData.ts:202）；CSV 行没有 id，
//     不处理就被全部当 INSERT，撞上 (user_id, lower(domain_name)) 后端判重 →
//     重导失败。
//   - 注册商 CSV 不包含 purchase_cost / renewal_cost / tags 等用户数据；
//     如果导入时让 CSV 字段全量覆盖现有 row，会清掉用户已填写的成本，
//     这是用户最不想要的事。
//
// 合并规则（"CSV-fill-empty"）：
//   - 匹配到现有 domain → 复用其 id + 全量保留现有字段，仅当现有字段为空
//     (null / undefined / 空字符串) 时用 CSV 的值填补。
//   - 没匹配到 → 生成新 id，把 MappedDomain 的字段灌进去 + 默认值
//     (status='active', tags=[], renewal_cycle=1, renewal_count=0)。
//
// 输出：
//   - mergedDomains：现有 + 新增的并集，可直接交给 saveData。
//   - 现有 domain 在结果里保持原样或被合并版本替换；不在 CSV 里的现有 domain
//     原样保留（不删）。

import type { Domain } from '../supabaseService'
import type { DomainWithTags } from '../../types/dashboard'
import type { MappedDomain } from './types'

export interface MergeResult {
  mergedDomains: DomainWithTags[]
  newCount: number
  updatedCount: number
}

function isEmpty(v: unknown): boolean {
  return v === null || v === undefined || (typeof v === 'string' && v.trim() === '')
}

/** 把现有 domain 与同名 CSV 行合并：现有非空字段不动，CSV 仅填空。 */
function mergeOneExisting(existing: DomainWithTags, mapped: MappedDomain): DomainWithTags {
  const out: DomainWithTags = { ...existing }
  // 注意：renewal_cycle / renewal_count 在 Domain 接口是 number（不可空），
  // 不能用 isEmpty 判断；只在 existing 显式为 0 / 1 默认值时让 CSV 接管会
  // 太激进，所以这两个字段保留现有值不变。
  type FillKey = Extract<
    keyof Domain & keyof MappedDomain,
    'registrar' | 'purchase_date' | 'purchase_cost' | 'renewal_cost'
      | 'baseline_renewal_as_of' | 'next_renewal_date' | 'expiry_date' | 'estimated_value'
  >
  const fillKeys: FillKey[] = [
    'registrar',
    'purchase_date',
    'purchase_cost',
    'renewal_cost',
    'baseline_renewal_as_of',
    'next_renewal_date',
    'expiry_date',
    'estimated_value',
  ]
  const outRecord = out as unknown as Record<string, unknown>
  const mappedRecord = mapped as unknown as Record<string, unknown>
  for (const k of fillKeys) {
    if (isEmpty(existing[k]) && !isEmpty(mappedRecord[k])) {
      outRecord[k] = mappedRecord[k]
    }
  }
  return out
}

/** 用一行 CSV 构造一个全新 DomainWithTags（赋默认值）。
 *  注意 user_id / created_at / updated_at 不在这里赋值——saveData 路径下
 *  POST /api/domains 会从认证态注入 user_id，DB 默认值填时间戳。 */
function buildNewFromMapped(mapped: MappedDomain): DomainWithTags {
  return {
    id: crypto.randomUUID(),
    user_id: '',
    domain_name: mapped.domain_name,
    registrar: mapped.registrar ?? null,
    purchase_date: mapped.purchase_date ?? null,
    purchase_cost: mapped.purchase_cost ?? null,
    renewal_cost: mapped.renewal_cost ?? null,
    renewal_cycle: mapped.renewal_cycle ?? 1,
    renewal_count: mapped.renewal_count ?? 0,
    baseline_renewal_as_of: mapped.baseline_renewal_as_of ?? null,
    next_renewal_date: mapped.next_renewal_date ?? null,
    expiry_date: mapped.expiry_date ?? null,
    status: mapped.status ?? 'active',
    estimated_value: mapped.estimated_value ?? null,
    sale_date: mapped.sale_date ?? null,
    sale_price: mapped.sale_price ?? null,
    platform_fee: mapped.platform_fee ?? null,
    created_at: '',
    updated_at: '',
    tags: mapped.tags ?? [],
  }
}

export function mergeCsvImportWithExisting(
  existing: DomainWithTags[],
  mapped: MappedDomain[]
): MergeResult {
  // 用 lower(name) → existing index 建索引，O(1) 查找
  const byName = new Map<string, number>()
  existing.forEach((d, i) => byName.set(d.domain_name.toLowerCase().trim(), i))

  // 复制一份现有数组——准备就地替换匹配上的 row
  const merged: DomainWithTags[] = [...existing]
  const newRows: DomainWithTags[] = []

  let updatedCount = 0
  let newCount = 0

  for (const row of mapped) {
    const key = row.domain_name.toLowerCase().trim()
    const idx = byName.get(key)
    if (idx !== undefined) {
      merged[idx] = mergeOneExisting(merged[idx], row)
      updatedCount++
    } else {
      newRows.push(buildNewFromMapped(row))
      newCount++
    }
  }

  return {
    mergedDomains: [...merged, ...newRows],
    newCount,
    updatedCount,
  }
}
