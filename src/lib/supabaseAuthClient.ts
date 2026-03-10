import { createClient } from '@supabase/supabase-js'
import { Database } from './supabase'
import { validateEnvVars } from './env-validator'

/**
 * 创建带用户认证的 Supabase 客户端（用于 API 路由，与 RLS 配合）
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

  if (accessToken) {
    try {
      await client.auth.setSession({
        access_token: accessToken,
        refresh_token: '',
      })
    } catch (err) {
      console.error('Error setting session in Supabase client:', err)
    }
  }

  return client
}
