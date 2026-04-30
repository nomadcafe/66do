import type { DomainInsert, DomainUpdate } from './supabaseService'

const VALID_STATUS = ['active', 'for_sale', 'sold', 'expired'] as const

// 把 sanitize 后的对象再过一道白名单，得到严格的 DomainInsert / DomainUpdate
// DTO。跟 transactionInsertPayload.ts 一个套路：路由层不再 spread 用户输入直
// 接喂给 .insert / .update —— 否则用户在 body 里塞 created_at / updated_at /
// 未来新加的敏感列就能直接写库。RLS 拦得住 user_id 改写，但拦不住别的列。
//
// 注意 user_id 不出现在两个 DTO 里：insert 强制从受信 userId 传入，update
// 完全不接受 user_id（路由层 .eq('user_id', userId) + RLS WITH CHECK 兜底）。
// id / created_at / updated_at 同理由 DB 或路径参数主导，不接受 body 输入。

export function buildDomainInsertPayload(
  domain: Record<string, unknown>,
  userId: string
): DomainInsert {
  const id =
    typeof domain.id === 'string' && domain.id.trim().length > 0
      ? domain.id.trim()
      : crypto.randomUUID()
  const status =
    typeof domain.status === 'string' && (VALID_STATUS as readonly string[]).includes(domain.status)
      ? domain.status
      : 'active'
  return {
    id,
    user_id: userId,
    domain_name: typeof domain.domain_name === 'string' ? domain.domain_name : '',
    registrar: typeof domain.registrar === 'string' ? domain.registrar : null,
    purchase_date: typeof domain.purchase_date === 'string' ? domain.purchase_date : null,
    purchase_cost:
      domain.purchase_cost != null && Number.isFinite(Number(domain.purchase_cost))
        ? Number(domain.purchase_cost)
        : null,
    renewal_cost:
      domain.renewal_cost != null && Number.isFinite(Number(domain.renewal_cost))
        ? Number(domain.renewal_cost)
        : null,
    renewal_cycle:
      domain.renewal_cycle != null && Number.isFinite(Number(domain.renewal_cycle))
        ? Number(domain.renewal_cycle)
        : 1,
    renewal_count:
      domain.renewal_count != null && Number.isFinite(Number(domain.renewal_count))
        ? Number(domain.renewal_count)
        : 0,
    baseline_renewal_as_of:
      typeof domain.baseline_renewal_as_of === 'string' ? domain.baseline_renewal_as_of : null,
    next_renewal_date:
      typeof domain.next_renewal_date === 'string' ? domain.next_renewal_date : null,
    expiry_date: typeof domain.expiry_date === 'string' ? domain.expiry_date : null,
    status,
    estimated_value:
      domain.estimated_value != null && Number.isFinite(Number(domain.estimated_value))
        ? Number(domain.estimated_value)
        : null,
    sale_date: typeof domain.sale_date === 'string' ? domain.sale_date : null,
    sale_price:
      domain.sale_price != null && Number.isFinite(Number(domain.sale_price))
        ? Number(domain.sale_price)
        : null,
    platform_fee:
      domain.platform_fee != null && Number.isFinite(Number(domain.platform_fee))
        ? Number(domain.platform_fee)
        : null,
    tags: normalizeTagsForDb(domain.tags),
  }
}

export function buildDomainUpdatePayload(
  domain: Record<string, unknown>
): DomainUpdate {
  const out: DomainUpdate = {}
  // 只有「key 存在于 body」的字段才进 update —— PostgREST 走部分更新，未传
  // 字段不动数据库现有值。null 是合法值（清空字段），undefined 才忽略。
  if (typeof domain.domain_name === 'string') out.domain_name = domain.domain_name
  if ('registrar' in domain)
    out.registrar = typeof domain.registrar === 'string' ? domain.registrar : null
  if ('purchase_date' in domain)
    out.purchase_date = typeof domain.purchase_date === 'string' ? domain.purchase_date : null
  if ('purchase_cost' in domain) {
    out.purchase_cost =
      domain.purchase_cost != null && Number.isFinite(Number(domain.purchase_cost))
        ? Number(domain.purchase_cost)
        : null
  }
  if ('renewal_cost' in domain) {
    out.renewal_cost =
      domain.renewal_cost != null && Number.isFinite(Number(domain.renewal_cost))
        ? Number(domain.renewal_cost)
        : null
  }
  if ('renewal_cycle' in domain && Number.isFinite(Number(domain.renewal_cycle))) {
    out.renewal_cycle = Number(domain.renewal_cycle)
  }
  if ('renewal_count' in domain && Number.isFinite(Number(domain.renewal_count))) {
    out.renewal_count = Number(domain.renewal_count)
  }
  if ('baseline_renewal_as_of' in domain) {
    out.baseline_renewal_as_of =
      typeof domain.baseline_renewal_as_of === 'string' ? domain.baseline_renewal_as_of : null
  }
  if ('next_renewal_date' in domain) {
    out.next_renewal_date =
      typeof domain.next_renewal_date === 'string' ? domain.next_renewal_date : null
  }
  if ('expiry_date' in domain)
    out.expiry_date = typeof domain.expiry_date === 'string' ? domain.expiry_date : null
  if (
    typeof domain.status === 'string' &&
    (VALID_STATUS as readonly string[]).includes(domain.status)
  ) {
    out.status = domain.status
  }
  if ('estimated_value' in domain) {
    out.estimated_value =
      domain.estimated_value != null && Number.isFinite(Number(domain.estimated_value))
        ? Number(domain.estimated_value)
        : null
  }
  if ('sale_date' in domain)
    out.sale_date = typeof domain.sale_date === 'string' ? domain.sale_date : null
  if ('sale_price' in domain) {
    out.sale_price =
      domain.sale_price != null && Number.isFinite(Number(domain.sale_price))
        ? Number(domain.sale_price)
        : null
  }
  if ('platform_fee' in domain) {
    out.platform_fee =
      domain.platform_fee != null && Number.isFinite(Number(domain.platform_fee))
        ? Number(domain.platform_fee)
        : null
  }
  if ('tags' in domain) out.tags = normalizeTagsForDb(domain.tags)
  return out
}

function normalizeTagsForDb(tags: unknown): string {
  if (Array.isArray(tags)) return JSON.stringify(tags)
  if (typeof tags === 'string') return tags
  return '[]'
}
