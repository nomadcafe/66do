import { createClient } from '@supabase/supabase-js'
// import type：supabase.ts 顶层会实例化浏览器端 singleton（还会在缺 env var 时
// 直接 throw）。这里只要类型，别把那个模块拖进服务端运行时。
import type { Database } from './supabase'
import { validateEnvVars } from './env-validator'

/**
 * 创建带用户认证的 Supabase 客户端（用于 API 路由，与 RLS 配合）。
 *
 * 鉴权靠 `global.headers.Authorization: Bearer <JWT>`——PostgREST 从这里解出
 * `auth.uid()` 来匹配 RLS。这条链在 supabase-js 2.105 里是这样接的：
 *
 *   global.headers → SupabaseClient.headers → new PostgrestClient({ headers })
 *   → 每个请求 `new Headers(this.headers)`（postgrest-js index.cjs:258）
 *   → fetchWithAuth 只在 `!headers.has("Authorization")` 时才塞自己的 token
 *     （supabase-js index.cjs:111）
 *
 * 也就是说显式传的 header 永远优先，SDK 内部 session 是 fallback。
 *
 * 曾经这里还会 `await client.auth.setSession({...})`。那是纯粹的浪费：
 * access_token 没过期时 setSession 会去调一次 `_getUser()`（auth-js
 * GoTrueClient.js:2835），而 auth-helper 在更早的地方已经 getUser 验过一遍身份
 * 了——每个写请求平白多打一次 GoTrue 往返，客户端几乎每次都带 refresh token，
 * 所以是 100% 命中。删掉它对 RLS 没有任何影响。
 *
 * ⚠️ 不要为了「保险」把 setSession 加回来。要改这里先看上面那条链。
 */
export async function createAuthenticatedSupabaseClient(accessToken?: string) {
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

  return client
}
