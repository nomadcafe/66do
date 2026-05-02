import type { CsvFormat, MappedDomain } from '../types'
import { parseLooseDate } from '../dateParse'
import { pickColumn } from '../pickColumn'

// GoDaddy 的 Domain Manager 导出 CSV 典型列：
//   Domain Name, Status, Expiration Date, Privacy, Auto Renew, Lock, Folder
// 不同区域 / 时间点的导出会缺一两列，所以 requiredHeaders 选最稳的两个。
export const godaddyFormat: CsvFormat = {
  id: 'godaddy',
  displayName: 'GoDaddy',
  requiredHeaders: ['Domain Name', 'Expiration Date'],
  bonusHeaders: ['Auto Renew', 'Privacy', 'Lock', 'Folder'],
  mapRow(row): MappedDomain | null {
    const name = pickColumn(row, ['Domain Name', 'Domain'])?.toLowerCase()
    if (!name) return null
    const expiry = parseLooseDate(pickColumn(row, ['Expiration Date', 'Expires']))
    const created = parseLooseDate(pickColumn(row, ['Created', 'Year Created', 'Creation Date']))
    return {
      domain_name: name,
      registrar: 'GoDaddy',
      expiry_date: expiry ?? undefined,
      next_renewal_date: expiry ?? undefined,
      purchase_date: created ?? undefined,
    }
  },
}
