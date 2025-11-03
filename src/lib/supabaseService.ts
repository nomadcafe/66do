import { supabase } from './supabase'
import { Database } from './supabase'

type Tables = Database['public']['Tables']

// 类型定义
export type User = Tables['users']['Row']
export type Domain = Tables['domains']['Row']
export type Transaction = Tables['domain_transactions']['Row']
export type VerificationToken = Tables['verification_tokens']['Row']

export type UserInsert = Tables['users']['Insert']
export type DomainInsert = Tables['domains']['Insert']
export type TransactionInsert = Tables['domain_transactions']['Insert']
export type VerificationTokenInsert = Tables['verification_tokens']['Insert']

export type UserUpdate = Tables['users']['Update']
export type DomainUpdate = Tables['domains']['Update']
export type TransactionUpdate = Tables['domain_transactions']['Update']

// 数据服务结果类型
export interface DataServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  source: 'supabase' | 'cache';
}

// 用户相关操作
export class UserService {
  static async getUser(email: string): Promise<User | null> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .maybeSingle()
    
    if (error) {
      console.error('Error fetching user:', error)
      return null
    }
    
    return data
  }

  static async createUser(user: UserInsert): Promise<User | null> {
    try {
      const { data, error } = await supabase
        .from('users')
        .insert(user)
        .select()
        .single()
      
      if (error) {
        console.error('Error creating user:', error)
        return null
      }
      
      return data
    } catch (error) {
      console.error('Error creating user:', error)
      return null
    }
  }

  static async updateUser(id: string, updates: UserUpdate): Promise<User | null> {
    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    
    if (error) {
      console.error('Error updating user:', error)
      return null
    }
    
    return data
  }

  static async updateEmailVerification(email: string, verified: boolean): Promise<boolean> {
    const { error } = await supabase
      .from('users')
      .update({ email_verified: verified })
      .eq('email', email)
    
    if (error) {
      console.error('Error updating email verification:', error)
      return false
    }
    
    return true
  }
}

// 域名相关操作
export class DomainService {
  static async getDomains(userId: string): Promise<Domain[]> {
    const { data, error } = await supabase
      .from('domains')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('Error fetching domains:', error)
      return []
    }
    
    return data || []
  }

  static async createDomain(domain: DomainInsert): Promise<Domain | null> {
    const { data, error } = await supabase
      .from('domains')
      .insert(domain)
      .select()
      .single()
    
    if (error) {
      console.error('Error creating domain:', error)
      return null
    }
    
    return data
  }

  static async getDomainById(id: string): Promise<Domain | null> {
    const { data, error } = await supabase
      .from('domains')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    
    if (error) {
      console.error('Error fetching domain:', error)
      return null
    }
    
    return data
  }

  static async updateDomain(id: string, updates: DomainUpdate, userId?: string): Promise<Domain | null> {
    // 如果提供了userId，确保只能更新属于该用户的域名
    let query = supabase
      .from('domains')
      .update(updates)
      .eq('id', id)
    
    if (userId) {
      query = query.eq('user_id', userId)
    }
    
    const { data, error } = await query
      .select()
      .single()
    
    if (error) {
      console.error('Error updating domain:', error)
      return null
    }
    
    return data
  }

  static async deleteDomain(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('domains')
      .delete()
      .eq('id', id)
    
    if (error) {
      console.error('Error deleting domain:', error)
      return false
    }
    
    return true
  }

  static async bulkUpdateDomains(domains: DomainUpdate[]): Promise<boolean> {
    const { error } = await supabase
      .from('domains')
      .upsert(domains)
    
    if (error) {
      console.error('Error bulk updating domains:', error)
      return false
    }
    
    return true
  }
}

// 交易相关操作
export class TransactionService {
  static async getTransactions(userId: string): Promise<Transaction[]> {
    const { data, error } = await supabase
      .from('domain_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false })
    
    if (error) {
      console.error('Error fetching transactions:', error)
      return []
    }
    
    return data || []
  }

  static async createTransaction(transaction: TransactionInsert): Promise<Transaction | null> {
    const { data, error } = await supabase
      .from('domain_transactions')
      .insert(transaction)
      .select()
      .single()
    
    if (error) {
      console.error('Error creating transaction:', error)
      return null
    }
    
    return data
  }

  static async updateTransaction(id: string, updates: TransactionUpdate): Promise<Transaction | null> {
    const { data, error } = await supabase
      .from('domain_transactions')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    
    if (error) {
      console.error('Error updating transaction:', error)
      return null
    }
    
    return data
  }

  static async deleteTransaction(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('domain_transactions')
      .delete()
      .eq('id', id)
    
    if (error) {
      console.error('Error deleting transaction:', error)
      return false
    }
    
    return true
  }

  static async bulkUpdateTransactions(transactions: TransactionUpdate[]): Promise<boolean> {
    const { error } = await supabase
      .from('domain_transactions')
      .upsert(transactions)
    
    if (error) {
      console.error('Error bulk updating transactions:', error)
      return false
    }
    
    return true
  }
}

// 验证令牌相关操作
export class VerificationTokenService {
  static async createToken(token: VerificationTokenInsert): Promise<VerificationToken | null> {
    const { data, error } = await supabase
      .from('verification_tokens')
      .insert(token)
      .select()
      .single()
    
    if (error) {
      console.error('Error creating verification token:', error)
      return null
    }
    
    return data
  }

  static async getToken(token: string): Promise<VerificationToken | null> {
    const { data, error } = await supabase
      .from('verification_tokens')
      .select('*')
      .eq('token', token)
      .gt('expires_at', new Date().toISOString())
      .single()
    
    if (error) {
      console.error('Error fetching verification token:', error)
      return null
    }
    
    return data
  }

  static async deleteToken(token: string): Promise<boolean> {
    const { error } = await supabase
      .from('verification_tokens')
      .delete()
      .eq('token', token)
    
    if (error) {
      console.error('Error deleting verification token:', error)
      return false
    }
    
    return true
  }

  static async cleanupExpiredTokens(): Promise<boolean> {
    const { error } = await supabase
      .from('verification_tokens')
      .delete()
      .lt('expires_at', new Date().toISOString())
    
    if (error) {
      console.error('Error cleaning up expired tokens:', error)
      return false
    }
    
    return true
  }
}

// 数据加载函数
export async function loadDomainsFromSupabase(userId: string): Promise<DataServiceResult<Domain[]>> {
  try {
    const { data, error } = await supabase
      .from('domains')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error loading domains from Supabase:', error)
      return {
        success: false,
        error: error.message,
        source: 'supabase'
      }
    }

    return {
      success: true,
      data: data || [],
      source: 'supabase'
    }
  } catch (error) {
    console.error('Error loading domains from Supabase:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      source: 'supabase'
    }
  }
}

export async function loadTransactionsFromSupabase(userId: string): Promise<DataServiceResult<Transaction[]>> {
  try {
    const { data, error } = await supabase
      .from('domain_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error loading transactions from Supabase:', error)
      return {
        success: false,
        error: error.message,
        source: 'supabase'
      }
    }

    return {
      success: true,
      data: data || [],
      source: 'supabase'
    }
  } catch (error) {
    console.error('Error loading transactions from Supabase:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      source: 'supabase'
    }
  }
}
