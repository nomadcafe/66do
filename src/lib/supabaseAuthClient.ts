import { createClient } from '@supabase/supabase-js'
import { Database } from './supabase'
import { validateEnvVars } from './env-validator'

/**
 * 创建使用 Service Role Key 的 Supabase 客户端（仅服务端，绕过 RLS）
 * 用于在 API 中已通过 JWT 校验 userId 后，按 user_id 读写数据，避免 setSession/RLS 导致插入或查询失败
 */
export function createServiceRoleSupabaseClient(): ReturnType<typeof createClient<Database>> | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) return null
  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}

/**
 * 创建带用户认证的 Supabase 客户端（用于 API 路由，与 RLS 配合）
 * 传入 refreshToken 以便 setSession 成功，RLS 才能正确识别 auth.uid()
 */
export async function createAuthenticatedSupabaseClient(
  accessToken?: string,
  refreshToken?: string
) {
  const envValidation = validateEnvVars(true)
  if (!envValidation.valid) {
    throw new Error(`Missing required environment variables: ${envValidation.missing.join(', ')}`)
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  const client = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })

  if (accessToken) {
    try {
      await client.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken || '',
      })
    } catch (err) {
      console.error('Error setting session in Supabase client:', err)
    }
  }

  return client
}
