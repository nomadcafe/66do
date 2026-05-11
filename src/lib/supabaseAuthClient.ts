import { createClient } from '@supabase/supabase-js'
import { Database } from './supabase'
import { validateEnvVars } from './env-validator'
import { serverLogger } from './logger'

/**
 * 创建带用户认证的 Supabase 客户端（用于 API 路由，与 RLS 配合）。
 *
 * 鉴权实际靠 `global.headers.Authorization: Bearer <JWT>` —— PostgREST 会从这里
 * 解出 `auth.uid()` 来匹配 RLS。`setSession` 是给 SDK 内部的 session 机制用的，
 * 在 server 端（persistSession/autoRefreshToken 都关掉）基本是冗余，但不同版本
 * 的 SDK 行为略有差异，所以保留；即使它失败，Authorization header 仍能让 RLS
 * 正常工作，故 soft-fail。
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
      const { error } = await client.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken || '',
      })
      // AuthSessionMissingError is the expected outcome when the caller only
      // sends an access token (no refresh token) — the SDK refuses to consider
      // it a "full" session but the Authorization header above still works.
      // Don't log it; everything else is a real signal.
      if (error && error.message !== 'Auth session missing!') {
        serverLogger.error(
          'Supabase setSession returned error; falling back to Authorization header:',
          error
        )
      }
    } catch (err) {
      serverLogger.error(
        'Supabase setSession threw; falling back to Authorization header:',
        err
      )
    }
  }

  return client
}
