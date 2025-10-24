import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// 数据库类型定义
export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          password_hash: string
          email_verified: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          password_hash: string
          email_verified?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          password_hash?: string
          email_verified?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      domains: {
        Row: {
          id: string
          user_id: string
          domain_name: string
          registrar: string | null
          purchase_date: string | null
          purchase_cost: number | null
          renewal_cost: number | null
          renewal_cycle: number
          renewal_count: number
          next_renewal_date: string | null
          expiry_date: string | null
          status: string
          estimated_value: number | null
          sale_date: string | null
          sale_price: number | null
          platform_fee: number | null
          tags: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          user_id: string
          domain_name: string
          registrar?: string | null
          purchase_date?: string | null
          purchase_cost?: number | null
          renewal_cost?: number | null
          renewal_cycle?: number
          renewal_count?: number
          next_renewal_date?: string | null
          expiry_date?: string | null
          status?: string
          estimated_value?: number | null
          sale_date?: string | null
          sale_price?: number | null
          platform_fee?: number | null
          tags?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          domain_name?: string
          registrar?: string | null
          purchase_date?: string | null
          purchase_cost?: number | null
          renewal_cost?: number | null
          renewal_cycle?: number
          renewal_count?: number
          next_renewal_date?: string | null
          expiry_date?: string | null
          status?: string
          estimated_value?: number | null
          sale_date?: string | null
          sale_price?: number | null
          platform_fee?: number | null
          tags?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      domain_transactions: {
        Row: {
          id: string
          user_id: string
          domain_id: string
          type: string
          amount: number
          currency: string
          exchange_rate: number
          base_amount: number | null
          platform_fee: number | null
          platform_fee_percentage: number | null
          net_amount: number | null
          category: string | null
          tax_deductible: boolean
          receipt_url: string | null
          notes: string | null
          date: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          user_id: string
          domain_id: string
          type: string
          amount: number
          currency?: string
          exchange_rate?: number
          base_amount?: number | null
          platform_fee?: number | null
          platform_fee_percentage?: number | null
          net_amount?: number | null
          category?: string | null
          tax_deductible?: boolean
          receipt_url?: string | null
          notes?: string | null
          date: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          domain_id?: string
          type?: string
          amount?: number
          currency?: string
          exchange_rate?: number
          base_amount?: number | null
          platform_fee?: number | null
          platform_fee_percentage?: number | null
          net_amount?: number | null
          category?: string | null
          tax_deductible?: boolean
          receipt_url?: string | null
          notes?: string | null
          date?: string
          created_at?: string
          updated_at?: string
        }
      }
      verification_tokens: {
        Row: {
          id: string
          user_id: string
          token: string
          expires_at: string
          created_at: string
        }
        Insert: {
          id: string
          user_id: string
          token: string
          expires_at: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          token?: string
          expires_at?: string
          created_at?: string
        }
      }
    }
  }
}
