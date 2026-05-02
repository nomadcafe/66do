import type { CsvFormat, MappedDomain } from '../types'
import { parseLooseDate } from '../dateParse'
import { pickColumn } from '../pickColumn'

// Namecheap Domain List 导出列（"Export to CSV" 按钮）：
//   Domain Name, Status, Expires, Auto-Renew, WhoisGuard, Created, Years
// "Expires" 是 Namecheap 独有用法（不是 "Expiration Date"），用作判别列。
export const namecheapFormat: CsvFormat = {
  id: 'namecheap',
  displayName: 'Namecheap',
  requiredHeaders: ['Domain Name', 'Expires'],
  bonusHeaders: ['Auto-Renew', 'WhoisGuard', 'Years'],
  mapRow(row): MappedDomain | null {
    const name = pickColumn(row, ['Domain Name', 'Domain'])?.toLowerCase()
    if (!name) return null
    const expiry = parseLooseDate(pickColumn(row, ['Expires', 'Expiration Date']))
    const created = parseLooseDate(pickColumn(row, ['Created', 'Creation Date']))
    const years = Number(pickColumn(row, ['Years', 'Registration Period']))
    return {
      domain_name: name,
      registrar: 'Namecheap',
      expiry_date: expiry ?? undefined,
      next_renewal_date: expiry ?? undefined,
      purchase_date: created ?? undefined,
      renewal_cycle: Number.isFinite(years) && years >= 1 && years <= 10 ? years : undefined,
    }
  },
}
