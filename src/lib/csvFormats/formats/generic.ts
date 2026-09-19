import type { CsvFormat, MappedDomain } from '../types'
import { parseLooseDate } from '../dateParse'
import { parseMoneyAmount } from '../parseMoney'

/** 次数 / 周期这类计数列。负数和小数都是坏数据，当成没填。 */
function parseCount(raw: string | undefined): number | undefined {
  if (!raw || !raw.trim()) return undefined
  const n = Number(raw.trim())
  if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) return undefined
  return n
}

// 我们自家的 JSON 导出 / 用户手填 CSV 走这里。列名为 snake_case，跟 Domain
// 接口一一对应。这是导入路径里"老用户备份恢复"的兼容形态。
//
// 注意：此 format 跟其他 registrar 不同，走"软识别"——只看 domain_name 列
// 是否存在，不要求其他字段。registry 把它放最后做兜底，避免抢前面 registrar
// 格式的命中。
export const genericFormat: CsvFormat = {
  id: 'generic',
  displayName: 'Generic',
  requiredHeaders: ['domain_name'],
  mapRow(row): MappedDomain | null {
    const name = (row.domain_name || '').trim().toLowerCase()
    if (!name) return null
    // 金额走 parseMoneyAmount，跟 godaddy adapter 同一套。裸 Number() 有两个
    // 静默错法：'1,234.56' → NaN（成本整个丢掉，界面上只是空白），'-5' → −5
    // （负成本进库，ROI 立刻变成负无穷那一类的荒唐值）。这个 format 除了吃
    // 自家导出，注释里也写着要吃"用户手填 CSV"——手填的就会是这些形态。
    const purchaseCost = parseMoneyAmount(row.purchase_cost) ?? undefined
    const renewalCost = parseMoneyAmount(row.renewal_cost) ?? undefined
    const renewalCycle = parseCount(row.renewal_cycle)
    const renewalCount = parseCount(row.renewal_count)
    return {
      domain_name: name,
      registrar: row.registrar || undefined,
      purchase_date: parseLooseDate(row.purchase_date) ?? undefined,
      registration_date: parseLooseDate(row.registration_date) ?? undefined,
      purchase_cost: purchaseCost,
      renewal_cost: renewalCost,
      renewal_cycle: renewalCycle,
      renewal_count: renewalCount,
      expiry_date: parseLooseDate(row.expiry_date) ?? undefined,
      next_renewal_date: parseLooseDate(row.next_renewal_date) ?? undefined,
      status:
        row.status === 'for_sale' || row.status === 'sold' || row.status === 'expired'
          ? row.status
          : undefined,
    }
  },
}
