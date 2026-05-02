import type { CsvFormat, MappedDomain } from '../types'
import { pickColumn } from '../pickColumn'

// Dynadot 的 Domain Manager → Export 导出 CSV 列：
//   Domain, Expiration Date, Expiration Date Timestamp,
//   Registration Date, Registration Date Timestamp
//
// 设计取舍：
//   - requiredHeaders 选 `Domain` + `Expiration Date` —— `Domain`（不带
//     "Name"）就足以跟 GoDaddy/Namecheap 区分；`Expiration Date` 跟 GoDaddy
//     重名但 `Domain` vs `Domain Name` 已经判别开了。
//   - `Expiration Date Timestamp` / `Registration Date Timestamp` 是 Dynadot
//     独有列，作为 bonus 加分提高识别置信度。
//   - **不**用 timestamp 列做日期映射：timestamp 是 UTC 毫秒
//     ("1777075199000" = 2026-04-24T23:59:59Z)，但文本列写的是当地日历日
//     "2026/04/25 07:59 PRC"。我们 expiry_date 是 YYYY-MM-DD 的"用户日历
//     日"，从文本前 10 位 regex 抽更准——绕开时区漂移。
//   - 文本列含 "PRC" 字样，浏览器 `new Date(...)` 不认得，所以走
//     parseDynadotCalendar 而非通用的 parseLooseDate。

function parseDynadotCalendar(text: string | undefined): string | null {
  if (!text) return null
  // 形如 "2026/04/25 07:59 PRC" 或 "2026/04/25" —— 抓前 10 位的 YYYY/MM/DD
  const m = text.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/)
  if (!m) return null
  const yyyy = m[1]
  const mm = m[2].padStart(2, '0')
  const dd = m[3].padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export const dynadotFormat: CsvFormat = {
  id: 'dynadot',
  displayName: 'Dynadot',
  requiredHeaders: ['Domain', 'Expiration Date'],
  bonusHeaders: [
    'Expiration Date Timestamp',
    'Registration Date',
    'Registration Date Timestamp',
  ],
  mapRow(row): MappedDomain | null {
    const name = pickColumn(row, ['Domain', 'Domain Name'])?.toLowerCase()
    if (!name) return null
    const expiry = parseDynadotCalendar(pickColumn(row, ['Expiration Date']))
    const registered = parseDynadotCalendar(pickColumn(row, ['Registration Date', 'Created']))
    return {
      domain_name: name,
      registrar: 'Dynadot',
      expiry_date: expiry ?? undefined,
      next_renewal_date: expiry ?? undefined,
      purchase_date: registered ?? undefined,
    }
  },
}
