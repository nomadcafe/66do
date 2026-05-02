import { describe, it, expect } from 'vitest'
import * as Papa from 'papaparse'
import { detectFormat, mapRows } from './index'
import { mergeCsvImportWithExisting } from './mergeWithExisting'
import { parseMoneyAmount } from './parseMoney'
import type { DomainWithTags } from '../../types/dashboard'

// 真实场景下的 papaparse 一致：用同样的 header:true / skipEmptyLines。
function parse(csv: string) {
  const result = Papa.parse<Record<string, string>>(csv, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
    transform: (v) => v.trim(),
  })
  return { headers: result.meta.fields ?? [], rows: result.data }
}

describe('detectFormat', () => {
  it('recognises GoDaddy export by Domain Name + Expiration Date', () => {
    const csv = `Domain Name,Status,Expiration Date,Auto Renew,Privacy
example.com,active,12/31/2026,Yes,Public
foo.io,active,06/15/2027,No,Public`
    const { headers } = parse(csv)
    const detection = detectFormat(headers)
    expect(detection?.format.id).toBe('godaddy')
  })

  it('recognises GoDaddy minimum export (only 4 cols, ISO date)', () => {
    // 用户实测：只勾必选列时导出就这 4 列，日期已是 ISO。
    const csv = `Domain Name,Expiration Date,Auto-renew,Status
mony.fund,2026-12-18,On,Active`
    const { headers } = parse(csv)
    expect(detectFormat(headers)?.format.id).toBe('godaddy')
  })

  it('recognises Namecheap export by Domain Name + Domain expiration date', () => {
    const csv = `Domain Name,Domain privacy protection status,Domain status at NC,Domain auto-renew status,Domain expiration date
vuno.ai,ON,Active,OFF,Dec 14 2027`
    const { headers } = parse(csv)
    const detection = detectFormat(headers)
    expect(detection?.format.id).toBe('namecheap')
  })

  it('falls back to generic for snake_case headers', () => {
    const csv = `domain_name,registrar,purchase_cost
example.com,Cloudflare,10`
    const { headers } = parse(csv)
    const detection = detectFormat(headers)
    expect(detection?.format.id).toBe('generic')
  })

  it('returns null when no format matches', () => {
    const csv = `random,unrelated,columns
a,b,c`
    const { headers } = parse(csv)
    expect(detectFormat(headers)).toBeNull()
  })

  it('recognises Dynadot export by Domain (no "Name") + Expiration Date Timestamp', () => {
    const csv = `Domain,Expiration Date,Expiration Date Timestamp,Registration Date,Registration Date Timestamp
xximoney.xyz,2026/04/25 07:59 PRC,1777075199000,2025/04/24 22:18 PRC,1745504314000`
    const { headers } = parse(csv)
    const detection = detectFormat(headers)
    expect(detection?.format.id).toBe('dynadot')
  })

  it('recognises Spaceship export by Domain + Nameservers + Expiration Date', () => {
    const csv = `Domain,Nameservers,Category,DNS Preset,Registration Date,Expiration Date,Ownership change,Autorenew,Privacy,Transfer Lock,Status
01us.com,launch1.spaceship.net launch2.spaceship.net,N/A,N/A,2/20/2024,2/20/2030,N/A,On,Private,Locked,active`
    const { headers } = parse(csv)
    const detection = detectFormat(headers)
    expect(detection?.format.id).toBe('spaceship')
  })

  it('Spaceship wins over Dynadot when Nameservers column distinguishes them', () => {
    // 双方都过 `Domain` + `Expiration Date` 这关；靠 Spaceship 的 Nameservers
    // (required) 在 score 上压过 Dynadot —— required 长度 3 vs 2，无悬念。
    const csv = `Domain,Nameservers,Registration Date,Expiration Date,Autorenew,Status
foo.com,ns1.spaceship.net ns2.spaceship.net,2/20/2024,2/20/2030,On,active`
    const { headers } = parse(csv)
    expect(detectFormat(headers)?.format.id).toBe('spaceship')
  })

  it('GoDaddy beats generic when both could match a CSV with snake_case + GoDaddy markers', () => {
    // 罕见但可能的边界：CSV 同时出现 domain_name 和 Domain Name + Expiration
    // Date。GoDaddy 的 requiredHeaders 长度更大，应当胜出。
    const csv = `Domain Name,Expiration Date,domain_name
example.com,12/31/2026,example.com`
    const { headers } = parse(csv)
    expect(detectFormat(headers)?.format.id).toBe('godaddy')
  })
})

describe('mapRows', () => {
  it('maps GoDaddy rows to our schema with normalised dates', () => {
    const csv = `Domain Name,Expiration Date,Created
EXAMPLE.com,12/31/2026,01/15/2024`
    const { headers, rows } = parse(csv)
    const detection = detectFormat(headers)!
    const mapped = mapRows(rows, detection.format)
    expect(mapped).toHaveLength(1)
    expect(mapped[0]).toMatchObject({
      domain_name: 'example.com',
      registrar: 'GoDaddy',
      expiry_date: '2026-12-31',
      purchase_date: '2024-01-15',
    })
  })

  it('maps GoDaddy export with Estimated Value (Appraisal) into estimated_value', () => {
    // 用户实测：勾上 "Estimated Value" 时导出含 "$ 402.00" 形态。$ 后带空格、
    // 千分位等都要稳。
    const csv = `Domain Name,Expiration Date,Auto-renew,Status,Protection Plan,Privacy,Estimated Value
mony.fund,2026-12-18,On,Active,No Protection,On,$ 402.00`
    const { headers, rows } = parse(csv)
    const detection = detectFormat(headers)!
    expect(detection.format.id).toBe('godaddy')
    const mapped = mapRows(rows, detection.format)
    expect(mapped[0]).toMatchObject({
      domain_name: 'mony.fund',
      registrar: 'GoDaddy',
      expiry_date: '2026-12-18',
      estimated_value: 402,
    })
  })

  it('maps GoDaddy minimum export (ISO date passes through, no Created column)', () => {
    const csv = `Domain Name,Expiration Date,Auto-renew,Status
mony.fund,2026-12-18,On,Active`
    const { headers, rows } = parse(csv)
    const detection = detectFormat(headers)!
    const mapped = mapRows(rows, detection.format)
    expect(mapped[0]).toMatchObject({
      domain_name: 'mony.fund',
      registrar: 'GoDaddy',
      expiry_date: '2026-12-18',
    })
    expect(mapped[0].purchase_date).toBeUndefined()
  })

  it('maps Spaceship rows with US M/D/YYYY dates', () => {
    const csv = `Domain,Nameservers,Category,DNS Preset,Registration Date,Expiration Date,Ownership change,Autorenew,Privacy,Transfer Lock,Status
01us.com,launch1.spaceship.net launch2.spaceship.net,N/A,N/A,2/20/2024,2/20/2030,N/A,On,Private,Locked,active
163AI.com,NS1.atom.COM NS2.atom.COM,N/A,N/A,12/30/2013,12/30/2029,N/A,On,Private,Locked,active`
    const { headers, rows } = parse(csv)
    const detection = detectFormat(headers)!
    const mapped = mapRows(rows, detection.format)
    expect(mapped).toHaveLength(2)
    expect(mapped[0]).toMatchObject({
      domain_name: '01us.com',
      registrar: 'Spaceship',
      expiry_date: '2030-02-20',
      purchase_date: '2024-02-20',
    })
    expect(mapped[1]).toMatchObject({
      domain_name: '163ai.com',
      expiry_date: '2029-12-30',
      purchase_date: '2013-12-30',
    })
  })

  it('maps Dynadot rows from text column (not timestamp) to keep user calendar date', () => {
    // 验证关键不变量：timestamp 1777075199000 = 2026-04-24T23:59:59Z 会得出
    // 错误的 4-24，正确解析必须从文本 "2026/04/25" 抽到 2026-04-25。
    const csv = `Domain,Expiration Date,Expiration Date Timestamp,Registration Date,Registration Date Timestamp
xximoney.xyz,2026/04/25 07:59 PRC,1777075199000,2025/04/24 22:18 PRC,1745504314000
RUFUS.CHAT,2026/06/03 10:26 PRC,1780453569000,2025/06/03 10:26 PRC,1748917569000`
    const { headers, rows } = parse(csv)
    const detection = detectFormat(headers)!
    const mapped = mapRows(rows, detection.format)
    expect(mapped).toHaveLength(2)
    expect(mapped[0]).toMatchObject({
      domain_name: 'xximoney.xyz',
      registrar: 'Dynadot',
      expiry_date: '2026-04-25',
      purchase_date: '2025-04-24',
    })
    // 大小写归一
    expect(mapped[1].domain_name).toBe('rufus.chat')
    expect(mapped[1].expiry_date).toBe('2026-06-03')
  })

  it('maps Namecheap rows from real export (Dec 14 2027 → 2027-12-14)', () => {
    const csv = `Domain Name,Domain privacy protection status,Domain status at NC,Domain auto-renew status,Domain expiration date
vuno.ai,ON,Active,OFF,Dec 14 2027`
    const { headers, rows } = parse(csv)
    const detection = detectFormat(headers)!
    const mapped = mapRows(rows, detection.format)
    expect(mapped[0]).toMatchObject({
      domain_name: 'vuno.ai',
      registrar: 'Namecheap',
      expiry_date: '2027-12-14',
    })
    // Namecheap 导出无注册日期列，purchase_date 应为 undefined
    expect(mapped[0].purchase_date).toBeUndefined()
  })
})

describe('parseMoneyAmount', () => {
  it('strips $ + space ("$ 402.00" → 402)', () => {
    expect(parseMoneyAmount('$ 402.00')).toBe(402)
  })
  it('handles thousands separators ("$1,234.56" → 1234.56)', () => {
    expect(parseMoneyAmount('$1,234.56')).toBe(1234.56)
  })
  it('returns null for empty / N/A / Free / non-numeric strings', () => {
    expect(parseMoneyAmount('')).toBeNull()
    expect(parseMoneyAmount('   ')).toBeNull()
    expect(parseMoneyAmount('N/A')).toBeNull()
    expect(parseMoneyAmount('Free')).toBeNull()
    expect(parseMoneyAmount(undefined)).toBeNull()
  })
  it('parses bare numbers', () => {
    expect(parseMoneyAmount('402')).toBe(402)
    expect(parseMoneyAmount('0.5')).toBe(0.5)
  })
})

describe('mergeCsvImportWithExisting', () => {
  // 帮手：建一个最小 DomainWithTags
  function existingDomain(overrides: Partial<DomainWithTags> = {}): DomainWithTags {
    return {
      id: 'existing-id-1',
      user_id: 'u',
      domain_name: 'example.com',
      registrar: null,
      purchase_date: null,
      purchase_cost: null,
      renewal_cost: null,
      renewal_cycle: 1,
      renewal_count: 0,
      baseline_renewal_as_of: null,
      next_renewal_date: null,
      expiry_date: null,
      status: 'active',
      estimated_value: null,
      sale_date: null,
      sale_price: null,
      platform_fee: null,
      created_at: '',
      updated_at: '',
      tags: [],
      ...overrides,
    }
  }

  it('reuses existing id and fills empty fields', () => {
    const existing = [existingDomain({ purchase_cost: null, registrar: null })]
    const result = mergeCsvImportWithExisting(existing, [
      { domain_name: 'example.com', registrar: 'GoDaddy', expiry_date: '2026-12-31' },
    ])
    expect(result.updatedCount).toBe(1)
    expect(result.newCount).toBe(0)
    expect(result.mergedDomains).toHaveLength(1)
    expect(result.mergedDomains[0].id).toBe('existing-id-1')
    expect(result.mergedDomains[0].registrar).toBe('GoDaddy')
    expect(result.mergedDomains[0].expiry_date).toBe('2026-12-31')
  })

  it('does NOT overwrite user-filled fields', () => {
    const existing = [
      existingDomain({ purchase_cost: 250, registrar: 'Cloudflare' }),
    ]
    const result = mergeCsvImportWithExisting(existing, [
      // CSV 试图把 registrar 改成 GoDaddy + 写入 purchase_cost
      { domain_name: 'example.com', registrar: 'GoDaddy', purchase_cost: 999 },
    ])
    // 现有非空字段不动
    expect(result.mergedDomains[0].registrar).toBe('Cloudflare')
    expect(result.mergedDomains[0].purchase_cost).toBe(250)
  })

  it('generates new ids and appends new rows', () => {
    const existing = [existingDomain()]
    const result = mergeCsvImportWithExisting(existing, [
      { domain_name: 'newone.com', registrar: 'GoDaddy', expiry_date: '2027-01-01' },
    ])
    expect(result.newCount).toBe(1)
    expect(result.updatedCount).toBe(0)
    expect(result.mergedDomains).toHaveLength(2)
    const newRow = result.mergedDomains.find((d) => d.domain_name === 'newone.com')!
    expect(newRow.id).not.toBe('existing-id-1')
    expect(newRow.id).toMatch(/^[0-9a-f-]{36}$/i)
    expect(newRow.registrar).toBe('GoDaddy')
  })

  it('keeps existing domains absent from CSV (no deletes)', () => {
    const existing = [
      existingDomain({ id: 'a', domain_name: 'kept.com' }),
      existingDomain({ id: 'b', domain_name: 'also-kept.com' }),
    ]
    const result = mergeCsvImportWithExisting(existing, [
      { domain_name: 'new.com' },
    ])
    expect(result.mergedDomains).toHaveLength(3)
    expect(result.mergedDomains.map((d) => d.domain_name).sort()).toEqual([
      'also-kept.com',
      'kept.com',
      'new.com',
    ])
  })

  it('matches case-insensitively by domain_name', () => {
    const existing = [existingDomain({ domain_name: 'example.com' })]
    const result = mergeCsvImportWithExisting(existing, [
      { domain_name: 'EXAMPLE.COM', registrar: 'GoDaddy' },
    ])
    expect(result.updatedCount).toBe(1)
    expect(result.mergedDomains[0].id).toBe('existing-id-1')
  })
})
