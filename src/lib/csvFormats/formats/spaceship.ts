import type { CsvFormat, MappedDomain } from '../types'
import { parseLooseDate } from '../dateParse'
import { pickColumn } from '../pickColumn'

// Spaceship 的 Domain Manager 导出列：
//   Domain, Nameservers, Category, DNS Preset, Registration Date,
//   Expiration Date, Ownership change, Autorenew, Privacy,
//   Transfer Lock, Status
//
// 跟 Dynadot 共用 `Domain` + `Expiration Date` 这个签名，所以单靠两者会两边
// 都命中。靠把 `Nameservers` 抬到 required 解决——Dynadot 标准导出不带这一
// 列，靠它一刀切开。`DNS Preset` / `Transfer Lock` 也是 Spaceship 独有的
// 措辞，作为 bonus 进一步抬高置信度。
//
// 日期格式 "2/20/2024" 是 US M/D/YYYY，浏览器 `new Date(...)` 直接解析。

export const spaceshipFormat: CsvFormat = {
  id: 'spaceship',
  displayName: 'Spaceship',
  requiredHeaders: ['Domain', 'Nameservers', 'Expiration Date'],
  bonusHeaders: ['DNS Preset', 'Transfer Lock', 'Autorenew', 'Privacy', 'Registration Date'],
  mapRow(row): MappedDomain | null {
    const name = pickColumn(row, ['Domain', 'Domain Name'])?.toLowerCase()
    if (!name) return null
    const expiry = parseLooseDate(pickColumn(row, ['Expiration Date']))
    const registered = parseLooseDate(pickColumn(row, ['Registration Date']))
    return {
      domain_name: name,
      registrar: 'Spaceship',
      expiry_date: expiry ?? undefined,
      next_renewal_date: expiry ?? undefined,
      purchase_date: registered ?? undefined,
    }
  },
}
