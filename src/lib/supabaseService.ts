import { supabase } from './supabase'
import { Database } from './supabase'
import { SupabaseClient } from '@supabase/supabase-js'
import { logger } from './logger'

type Tables = Database['public']['Tables']

// 类型定义
export type Domain = Tables['domains']['Row']
export type Transaction = Tables['domain_transactions']['Row']

export type DomainInsert = Tables['domains']['Insert']
export type TransactionInsert = Tables['domain_transactions']['Insert']

export type DomainUpdate = Tables['domains']['Update']
export type TransactionUpdate = Tables['domain_transactions']['Update']

// 数据服务结果类型
export interface DataServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  source: 'supabase' | 'cache';
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
    return this.deleteDomainWithClient(supabase, id, userId)
  }

  /** 使用带用户 JWT 的 client 执行删除，RLS 才能通过 */
  static async deleteDomainWithClient(
    client: SupabaseClient<Database>,
    id: string,
    userId?: string
  ): Promise<boolean> {
    let query = client.from('domains').delete().eq('id', id)
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

}

// 交易相关操作
export class TransactionService {
  static async getTransactions(userId: string): Promise<Transaction[]> {
    return this.getTransactionsWithClient(supabase, userId)
  }

  /** PostgREST 默认每页有上限（常见 1000），必须分页否则 GET/PUT 用全表扫描会漏掉旧记录 */
  private static readonly TRANSACTION_PAGE_SIZE = 1000

  static async getTransactionByIdWithClient(
    client: SupabaseClient<Database>,
    transactionId: string,
    userId: string
  ): Promise<Transaction | null> {
    const { data, error } = await client
      .from('domain_transactions')
      .select('*')
      .eq('id', transactionId)
      .eq('user_id', userId)
      .maybeSingle()

    if (error) {
      logger.error('Error fetching transaction by id:', error)
      return null
    }
    return data
  }

  static async getTransactionsWithClient(
    client: SupabaseClient<Database>,
    userId: string
  ): Promise<Transaction[]> {
    const pageSize = TransactionService.TRANSACTION_PAGE_SIZE
    const all: Transaction[] = []
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await client
        .from('domain_transactions')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .range(from, from + pageSize - 1)

      if (error) {
        logger.error('Error fetching transactions:', error)
        return all.length > 0 ? all : []
      }
      const batch = data || []
      all.push(...batch)
      if (batch.length < pageSize) break
    }
    return all
  }

  static async createTransaction(transaction: TransactionInsert): Promise<Transaction | null> {
    const { data } = await this.createTransactionWithClient(supabase, transaction)
    return data
  }

  static async createTransactionWithClient(
    client: SupabaseClient<Database>,
    transaction: TransactionInsert
  ): Promise<{ data: Transaction | null; error: string | null }> {
    const { data, error } = await (client
      .from('domain_transactions')
      .insert(transaction as never)
      .select()
      .single() as unknown as Promise<{ data: Transaction | null; error: { message: string; details?: string } | null }>)

    if (error) {
      const errMsg = error?.message || error?.details || 'Unknown error'
      logger.error('Error creating transaction:', errMsg)
      return { data: null, error: errMsg }
    }

    return { data, error: null }
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
    const data = await TransactionService.getTransactionsWithClient(supabase, userId)

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
