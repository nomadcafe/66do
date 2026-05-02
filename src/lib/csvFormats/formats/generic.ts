import type { CsvFormat, MappedDomain } from '../types'
import { parseLooseDate } from '../dateParse'

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
    const purchaseCost = row.purchase_cost ? Number(row.purchase_cost) : undefined
    const renewalCost = row.renewal_cost ? Number(row.renewal_cost) : undefined
    const renewalCycle = row.renewal_cycle ? Number(row.renewal_cycle) : undefined
    const renewalCount = row.renewal_count ? Number(row.renewal_count) : undefined
    return {
      domain_name: name,
      registrar: row.registrar || undefined,
      purchase_date: parseLooseDate(row.purchase_date) ?? undefined,
      purchase_cost: Number.isFinite(purchaseCost) ? purchaseCost : undefined,
      renewal_cost: Number.isFinite(renewalCost) ? renewalCost : undefined,
      renewal_cycle: Number.isFinite(renewalCycle) ? renewalCycle : undefined,
      renewal_count: Number.isFinite(renewalCount) ? renewalCount : undefined,
      expiry_date: parseLooseDate(row.expiry_date) ?? undefined,
      next_renewal_date: parseLooseDate(row.next_renewal_date) ?? undefined,
      status:
        row.status === 'for_sale' || row.status === 'sold' || row.status === 'expired'
          ? row.status
          : undefined,
    }
  },
}
