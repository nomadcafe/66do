import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing required env vars: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// 数据库类型定义
export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          email_verified: boolean
          ical_token: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          email_verified?: boolean
          ical_token?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          email_verified?: boolean
          ical_token?: string | null
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
          baseline_renewal_as_of: string | null
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
          baseline_renewal_as_of?: string | null
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
          baseline_renewal_as_of?: string | null
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
          platform_fee: number | null
          platform_fee_percentage: number | null
          net_amount: number | null
          category: string | null
          tax_deductible: boolean
          receipt_url: string | null
          notes: string | null
          platform: string | null
          date: string
          created_at: string
          updated_at: string
          payment_plan: string | null
          installment_period: number | null
          downpayment_amount: number | null
          installment_amount: number | null
          final_payment_amount: number | null
          total_installment_amount: number | null
          paid_periods: number | null
          installment_status: string | null
          installment_first_payment_date: string | null
          platform_fee_type: string | null
          user_input_fee_rate: number | null
          user_input_surcharge_rate: number | null
          afternic_ns_pointed: boolean | null
          afternic_premium_addon: boolean | null
          atom_commission_tier: string | null
          atom_no_coin: boolean | null
          atom_custom_commission_rate: number | null
          escrow_lease_type: string | null
          escrow_transaction_fee: number | null
          renewal_period_years: number | null
        }
        Insert: {
          id: string
          user_id: string
          domain_id: string
          type: string
          amount: number
          currency?: string
          platform_fee?: number | null
          platform_fee_percentage?: number | null
          net_amount?: number | null
          category?: string | null
          tax_deductible?: boolean
          receipt_url?: string | null
          notes?: string | null
          platform?: string | null
          date: string
          created_at?: string
          updated_at?: string
          payment_plan?: string | null
          installment_period?: number | null
          downpayment_amount?: number | null
          installment_amount?: number | null
          final_payment_amount?: number | null
          total_installment_amount?: number | null
          paid_periods?: number | null
          installment_status?: string | null
          installment_first_payment_date?: string | null
          platform_fee_type?: string | null
          user_input_fee_rate?: number | null
          user_input_surcharge_rate?: number | null
          afternic_ns_pointed?: boolean | null
          afternic_premium_addon?: boolean | null
          atom_commission_tier?: string | null
          atom_no_coin?: boolean | null
          atom_custom_commission_rate?: number | null
          escrow_lease_type?: string | null
          escrow_transaction_fee?: number | null
          renewal_period_years?: number | null
        }
        Update: {
          id?: string
          user_id?: string
          domain_id?: string
          type?: string
          amount?: number
          currency?: string
          platform_fee?: number | null
          platform_fee_percentage?: number | null
          net_amount?: number | null
          category?: string | null
          tax_deductible?: boolean
          receipt_url?: string | null
          notes?: string | null
          platform?: string | null
          date?: string
          created_at?: string
          updated_at?: string
          payment_plan?: string | null
          installment_period?: number | null
          downpayment_amount?: number | null
          installment_amount?: number | null
          final_payment_amount?: number | null
          total_installment_amount?: number | null
          paid_periods?: number | null
          installment_status?: string | null
          installment_first_payment_date?: string | null
          platform_fee_type?: string | null
          user_input_fee_rate?: number | null
          user_input_surcharge_rate?: number | null
          afternic_ns_pointed?: boolean | null
          afternic_premium_addon?: boolean | null
          atom_commission_tier?: string | null
          atom_no_coin?: boolean | null
          atom_custom_commission_rate?: number | null
          escrow_lease_type?: string | null
          escrow_transaction_fee?: number | null
          renewal_period_years?: number | null
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
