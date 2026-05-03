import type { CsvFormat, MappedDomain } from '../types'
import { parseLooseDate } from '../dateParse'
import { pickColumn } from '../pickColumn'
import { parseMoneyAmount } from '../parseMoney'

// GoDaddy 的 Domain Manager 导出 CSV 列。最小可观察形态（只勾必选列）：
//   Domain Name, Expiration Date, Auto-renew, Status
// 完整勾选时还会带 Privacy / Lock / Folder 等。requiredHeaders 选最稳的两
// 个，bonusHeaders 同时覆盖最小态（Status / Auto-renew）和完整态。
//
// 列名注意：GoDaddy 用 "Auto-renew"（连字符、小写 r），Spaceship 用
// "Autorenew"（一个词）。我们 normalizeHeader 会把两者都归到 "autorenew"，
// 所以列在 bonus 里写哪种都一样命中。
//
// 日期格式："2026-12-18" 已是 ISO，parseLooseDate 直通；老版本"12/18/2026"
// 也支持。
export const godaddyFormat: CsvFormat = {
  id: 'godaddy',
  displayName: 'GoDaddy',
  requiredHeaders: ['Domain Name', 'Expiration Date'],
  bonusHeaders: ['Auto-renew', 'Status', 'Privacy', 'Lock', 'Folder', 'Estimated Value', 'Protection Plan'],
  mapRow(row): MappedDomain | null {
    const name = pickColumn(row, ['Domain Name', 'Domain'])?.toLowerCase()
    if (!name) return null
    const expiry = parseLooseDate(pickColumn(row, ['Expiration Date', 'Expires']))
    // Created/Year Created 是 registrar 端的原始注册日 → registration_date。
    // **不**写进 purchase_date —— purchase_date 表示"this user 何时获取
    // 该域名"，对米市/drop/aftermarket 买入的域名跟 registration 日期差很多。
    // 用户导入后再自行补 purchase_date。
    const registered = parseLooseDate(pickColumn(row, ['Created', 'Year Created', 'Creation Date']))
    // GoDaddy Appraisal 在导出里就是 "Estimated Value" 列，值形如 "$ 402.00"。
    // 直接进我们 estimated_value 字段，跟手填的 ML 估值复用同一列。
    const estimated = parseMoneyAmount(pickColumn(row, ['Estimated Value']))
    return {
      domain_name: name,
      registrar: 'GoDaddy',
      expiry_date: expiry ?? undefined,
      next_renewal_date: expiry ?? undefined,
      registration_date: registered ?? undefined,
      estimated_value: estimated ?? undefined,
    }
  },
}
