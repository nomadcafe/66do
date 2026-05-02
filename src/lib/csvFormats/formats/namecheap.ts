import type { CsvFormat, MappedDomain } from '../types'
import { parseLooseDate } from '../dateParse'
import { pickColumn } from '../pickColumn'

// Namecheap 的 Domain List 导出（"Export to CSV"）实测列：
//   Domain Name, Domain privacy protection status, Domain status at NC,
//   Domain auto-renew status, Domain expiration date
//
// 没有注册日期 / 续费年数 / 成本——比 GoDaddy 还简陋。
//
// 识别签名：`Domain expiration date`（小写 'expiration'，且带 "Domain" 前缀）
// 是 Namecheap 独有的列名，跟 GoDaddy 的 `Expiration Date` 区分开。
//
// 日期格式："Dec 14 2027"，浏览器 `new Date()` 直接吃 → parseLooseDate 复用即可。
export const namecheapFormat: CsvFormat = {
  id: 'namecheap',
  displayName: 'Namecheap',
  requiredHeaders: ['Domain Name', 'Domain expiration date'],
  bonusHeaders: [
    'Domain status at NC',
    'Domain privacy protection status',
    'Domain auto-renew status',
  ],
  mapRow(row): MappedDomain | null {
    const name = pickColumn(row, ['Domain Name', 'Domain'])?.toLowerCase()
    if (!name) return null
    const expiry = parseLooseDate(pickColumn(row, ['Domain expiration date', 'Expires']))
    return {
      domain_name: name,
      registrar: 'Namecheap',
      expiry_date: expiry ?? undefined,
      next_renewal_date: expiry ?? undefined,
    }
  },
}
