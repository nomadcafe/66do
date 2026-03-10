import { supabase } from './supabase'
import { Database } from './supabase'
import { SupabaseClient } from '@supabase/supabase-js'
import { logger } from './logger'

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
      // Error fetching user - logged via logger if needed
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
        logger.error('Error creating user:', error)
        return null
      }
      
      return data
    } catch (error) {
      logger.error('Error creating user:', error)
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
      logger.error('Error updating user:', error)
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
      logger.error('Error updating email verification:', error)
      return false
    }
    
    return true
  }
}

// 域名相关操作
export class DomainService {
  static async getDomains(userId: string): Promise<Domain[]> {
    return this.getDomainsWithClient(supabase, userId)
  }

  static async getDomainsWithClient(
    client: SupabaseClient<Database>,
    userId: string
  ): Promise<Domain[]> {
    // 注意：由于 Supabase 类型系统的限制，这里需要使用类型断言
    // 实际运行时类型是正确的，只是 TypeScript 无法正确推断
    const { data, error } = await (client
      .from('domains')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }) as unknown as Promise<{ data: Domain[] | null; error: { message: string } | null }>)
    
    if (error) {
      logger.error('Error fetching domains:', error)
      return []
    }
    
    return (data || []) as Domain[]
  }

  static async createDomain(domain: DomainInsert): Promise<Domain | null> {
    return this.createDomainWithClient(supabase, domain)
  }

  static async createDomainWithClient(
    client: SupabaseClient<Database>,
    domain: DomainInsert
  ): Promise<Domain | null> {
    // 注意：由于 Supabase 类型系统的限制，这里需要使用类型断言
    // 实际运行时类型是正确的，只是 TypeScript 无法正确推断
    const { data, error } = await (client
      .from('domains')
      .insert(domain as never)
      .select()
      .single() as unknown as Promise<{ data: Domain | null; error: { message: string; code?: string } | null }>)
    
    if (error) {
      logger.error('Error creating domain:', error)
      return null
    }
    
    return data as Domain
  }

  static async getDomainById(id: string): Promise<Domain | null> {
    const { data, error } = await supabase
      .from('domains')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    
    if (error) {
      logger.error('Error fetching domain:', error)
      return null
    }
    
    return data
  }

  static async updateDomain(id: string, updates: DomainUpdate, userId?: string): Promise<Domain | null> {
    return this.updateDomainWithClient(supabase, id, updates, userId)
  }

  static async updateDomainWithClient(
    client: SupabaseClient<Database>,
    id: string,
    updates: DomainUpdate,
    userId?: string
  ): Promise<Domain | null> {
    // 如果提供了userId，确保只能更新属于该用户的域名
    // 注意：由于 Supabase 类型系统的限制，这里需要使用类型断言
    // 实际运行时类型是正确的，只是 TypeScript 无法正确推断
    let queryBuilder = client
      .from('domains')
      .update(updates as never)
      .eq('id', id)
    
    if (userId) {
      queryBuilder = queryBuilder.eq('user_id', userId) as typeof queryBuilder
    }
    
    const { data, error } = await (queryBuilder
      .select()
      .single() as unknown as Promise<{ data: Domain | null; error: { message: string; code?: string } | null }>)
    
    if (error) {
      logger.error('Error updating domain:', error)
      // 如果是权限错误，记录更详细的信息
      if (error.code === 'PGRST116' || error.message?.includes('Unauthorized')) {
        logger.error('Permission denied: Domain may not belong to user or RLS policy violation')
      }
      return null
    }
    
    return data as Domain
  }

  static async deleteDomain(id: string, userId?: string): Promise<boolean> {
    let query = supabase
      .from('domains')
      .delete()
      .eq('id', id)
    
    // 如果提供了userId，确保只能删除属于该用户的域名
    if (userId) {
      query = query.eq('user_id', userId) as typeof query
    }
    
    const { error } = await query
    
    if (error) {
      logger.error('Error deleting domain:', error)
      return false
    }
    
    return true
  }

  static async bulkUpdateDomains(domains: DomainUpdate[]): Promise<boolean> {
    const { error } = await supabase
      .from('domains')
      .upsert(domains)
    
    if (error) {
      logger.error('Error bulk updating domains:', error)
      return false
    }
    
    return true
  }
}

// 交易相关操作
export class TransactionService {
  static async getTransactions(userId: string): Promise<Transaction[]> {
    return this.getTransactionsWithClient(supabase, userId)
  }

  static async getTransactionsWithClient(
    client: SupabaseClient<Database>,
    userId: string
  ): Promise<Transaction[]> {
    const { data, error } = await client
      .from('domain_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false })

    if (error) {
      logger.error('Error fetching transactions:', error)
      return []
    }

    return data || []
  }

  static async createTransaction(transaction: TransactionInsert): Promise<Transaction | null> {
    return this.createTransactionWithClient(supabase, transaction)
  }

  static async createTransactionWithClient(
    client: SupabaseClient<Database>,
    transaction: TransactionInsert
  ): Promise<Transaction | null> {
    const { data, error } = await (client
      .from('domain_transactions')
      .insert(transaction as never)
      .select()
      .single() as unknown as Promise<{ data: Transaction | null; error: { message: string } | null }>)

    if (error) {
      logger.error('Error creating transaction:', error)
      return null
    }

    return data
  }

  static async updateTransaction(id: string, updates: TransactionUpdate, userId?: string): Promise<Transaction | null> {
    return this.updateTransactionWithClient(supabase, id, updates, userId)
  }

  static async updateTransactionWithClient(
    client: SupabaseClient<Database>,
    id: string,
    updates: TransactionUpdate,
    userId?: string
  ): Promise<Transaction | null> {
    let query = client
      .from('domain_transactions')
      .update(updates as never)
      .eq('id', id)

    if (userId) {
      query = query.eq('user_id', userId) as typeof query
    }

    const { data, error } = await (query
      .select()
      .single() as unknown as Promise<{ data: Transaction | null; error: { message: string } | null }>)

    if (error) {
      logger.error('Error updating transaction:', error)
      return null
    }

    return data
  }

  static async deleteTransaction(id: string, userId?: string): Promise<boolean> {
    return this.deleteTransactionWithClient(supabase, id, userId)
  }

  static async deleteTransactionWithClient(
    client: SupabaseClient<Database>,
    id: string,
    userId?: string
  ): Promise<boolean> {
    let query = client
      .from('domain_transactions')
      .delete()
      .eq('id', id)

    if (userId) {
      query = query.eq('user_id', userId) as typeof query
    }

    const { error } = await query

    if (error) {
      logger.error('Error deleting transaction:', error)
      return false
    }

    return true
  }

  static async bulkUpdateTransactions(transactions: TransactionUpdate[], userId?: string): Promise<boolean> {
    return this.bulkUpdateTransactionsWithClient(supabase, transactions, userId)
  }

  static async bulkUpdateTransactionsWithClient(
    client: SupabaseClient<Database>,
    transactions: TransactionUpdate[],
    userId?: string
  ): Promise<boolean> {
    const validatedTransactions = userId
      ? transactions.map(t => ({ ...t, user_id: userId }))
      : transactions

    const { error } = await client
      .from('domain_transactions')
      .upsert(validatedTransactions as never)

    if (error) {
      logger.error('Error bulk updating transactions:', error)
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
      logger.error('Error creating verification token:', error)
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
      logger.error('Error fetching verification token:', error)
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
      logger.error('Error deleting verification token:', error)
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
      logger.error('Error cleaning up expired tokens:', error)
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
      logger.error('Error loading domains from Supabase:', error)
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
    logger.error('Error loading domains from Supabase:', error)
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
      logger.error('Error loading transactions from Supabase:', error)
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
    logger.error('Error loading transactions from Supabase:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      source: 'supabase'
    }
  }
}
