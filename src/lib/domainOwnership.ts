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
