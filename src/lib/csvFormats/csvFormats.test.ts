import { describe, it, expect } from 'vitest'
import * as Papa from 'papaparse'
import { detectFormat, mapRows } from './index'
import { mergeCsvImportWithExisting } from './mergeWithExisting'
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

  it('recognises Namecheap export by Domain Name + Expires (not Expiration Date)', () => {
    const csv = `Domain Name,Status,Expires,Auto-Renew,WhoisGuard,Years
example.com,active,12/31/2026,Yes,Enabled,1`
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

  it('maps Namecheap rows including renewal_cycle from Years column', () => {
    const csv = `Domain Name,Expires,Years
foo.io,06/15/2027,3`
    const { headers, rows } = parse(csv)
    const detection = detectFormat(headers)!
    const mapped = mapRows(rows, detection.format)
    expect(mapped[0]).toMatchObject({
      domain_name: 'foo.io',
      registrar: 'Namecheap',
      expiry_date: '2027-06-15',
      renewal_cycle: 3,
    })
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
