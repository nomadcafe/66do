import type { CsvFormat, MappedDomain } from '../types'
import { parseLooseDate } from '../dateParse'
import { pickColumn } from '../pickColumn'

// Name.com 的 Domain Manager 导出（用户可勾列）。最小 / 常见列：
//   Domain Name, Create Date, Expire Date
//
// 识别签名：`Expire Date`（无 "ation"）是 Name.com 独有，跟 GoDaddy 的
// `Expiration Date` 和 Namecheap 的 `Domain expiration date` 都区分得开。
//
// 日期格式 "6/5/2025" 是 US M/D/YYYY，浏览器 `new Date(...)` 直接解析。
export const namecomFormat: CsvFormat = {
  id: 'namecom',
  displayName: 'Name.com',
  requiredHeaders: ['Domain Name', 'Expire Date'],
  bonusHeaders: ['Create Date'],
  mapRow(row): MappedDomain | null {
    const name = pickColumn(row, ['Domain Name', 'Domain'])?.toLowerCase()
    if (!name) return null
    const expiry = parseLooseDate(pickColumn(row, ['Expire Date']))
    const created = parseLooseDate(pickColumn(row, ['Create Date']))
    return {
      domain_name: name,
      registrar: 'Name.com',
      expiry_date: expiry ?? undefined,
      next_renewal_date: expiry ?? undefined,
      purchase_date: created ?? undefined,
    }
  },
}
