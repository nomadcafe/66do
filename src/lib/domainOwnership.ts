import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './supabase'

/** 服务端校验：该 domain 行是否属于当前用户（与 Service Role / RLS 无关，按 user_id 显式过滤） */
export async function isDomainOwnedByUser(
  client: SupabaseClient<Database>,
  domainId: string | null | undefined,
  userId: string
): Promise<boolean> {
  if (!domainId || typeof domainId !== 'string') return false
  const id = domainId.trim()
  if (!id) return false

  const { data, error } = await client
    .from('domains')
    .select('id')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle()

  return !error && !!data
}

/**
 * 批量版：返回 domainIds 中确实属于该用户的那些 id。批量创建时用它一次性把
 * 所有权校验做完（一次查询，不是 N 次），确保任何写入发生前就能整批拒绝。
 */
export async function getOwnedDomainIds(
  client: SupabaseClient<Database>,
  domainIds: Array<string | null | undefined>,
  userId: string
): Promise<Set<string>> {
  const ids = Array.from(
    new Set(domainIds.map((id) => (typeof id === 'string' ? id.trim() : '')).filter(Boolean))
  )
  if (ids.length === 0) return new Set()

  // 注意：由于 Supabase 类型系统的限制，这里需要使用类型断言
  const { data, error } = await (client
    .from('domains')
    .select('id')
    .eq('user_id', userId)
    .in('id', ids) as unknown as Promise<{ data: Array<{ id: string }> | null; error: unknown }>)

  // 出错（含 id 非法 uuid 的 22P02）一律按"一个都不属于"处理，调用方会拒绝整批
  if (error || !data) return new Set()

  return new Set(data.map((row) => row.id))
}
