import { supabase } from './supabase'
import type { Database } from './supabase'
import type { SupabaseClient } from '@supabase/supabase-js'
import { logger } from './logger'
import type { WriteError } from './domainWriteErrors'

type Tables = Database['public']['Tables']

// 类型定义
export type Domain = Tables['domains']['Row']
export type Transaction = Tables['domain_transactions']['Row']
export type InstallmentReceiptRow = Tables['installment_receipts']['Row']

export type DomainInsert = Tables['domains']['Insert']
export type TransactionInsert = Tables['domain_transactions']['Insert']
export type InstallmentReceiptInsert = Tables['installment_receipts']['Insert']

export type DomainUpdate = Tables['domains']['Update']
export type TransactionUpdate = Tables['domain_transactions']['Update']
export type InstallmentReceiptUpdate = Tables['installment_receipts']['Update']

// 数据服务结果类型
export interface DataServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  source: 'supabase' | 'cache';
}

// WriteError / isDuplicateDomainNameError 放在 domainWriteErrors.ts：本文件顶层
// 会实例化 supabase 客户端（需要 env vars），纯判定逻辑单独放才能被单测直接引入。
export type { WriteError } from './domainWriteErrors'

// 域名相关操作
export class DomainService {
  /** PostgREST 默认每页有上限（常见 1000），必须分页否则第 1001 个域名之后全部读不到 */
  private static readonly DOMAIN_PAGE_SIZE = 1000

  /**
   * 分页拉取用户全部域名。错误原样返回，由调用方决定是"当空列表"还是"报失败"——
   * 加载路径要区分这两者，否则一次网络抖动会被当成"用户没有域名"。
   */
  static async listDomainsWithClient(
    client: SupabaseClient<Database>,
    userId: string
  ): Promise<{ data: Domain[]; error: { message: string } | null }> {
    const pageSize = DomainService.DOMAIN_PAGE_SIZE
    const all: Domain[] = []
    for (let from = 0; ; from += pageSize) {
      // 注意：由于 Supabase 类型系统的限制，这里需要使用类型断言
      // 实际运行时类型是正确的，只是 TypeScript 无法正确推断
      const { data, error } = await (client
        .from('domains')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        // created_at 可能撞车（批量导入同一毫秒写入），只按它排序时翻页会重复/漏行；
        // 补一个 id 作为稳定 tiebreaker。
        .order('id', { ascending: false })
        .range(from, from + pageSize - 1) as unknown as Promise<{ data: Domain[] | null; error: { message: string } | null }>)

      if (error) {
        logger.error('Error fetching domains:', error)
        return { data: all, error }
      }
      const batch = (data || []) as Domain[]
      all.push(...batch)
      if (batch.length < pageSize) break
    }
    return { data: all, error: null }
  }

  static async getDomainsWithClient(
    client: SupabaseClient<Database>,
    userId: string
  ): Promise<Domain[]> {
    const { data } = await DomainService.listDomainsWithClient(client, userId)
    return data
  }

  /**
   * 按 id + user_id 取单行。所有权校验/单域名读取都走这里，别再用
   * getDomainsWithClient 拉全表再 find —— 那条路受 PostgREST 1000 行默认上限影响，
   * 第 1001 个域名会被判成"不存在"。
   */
  static async getDomainByIdWithClient(
    client: SupabaseClient<Database>,
    id: string,
    userId: string
  ): Promise<Domain | null> {
    const domainId = typeof id === 'string' ? id.trim() : ''
    if (!domainId) return null

    // 注意：由于 Supabase 类型系统的限制，这里需要使用类型断言
    // 实际运行时类型是正确的，只是 TypeScript 无法正确推断
    const { data, error } = await (client
      .from('domains')
      .select('*')
      .eq('id', domainId)
      .eq('user_id', userId)
      .maybeSingle() as unknown as Promise<{ data: Domain | null; error: { message: string } | null }>)

    if (error) {
      // id 不是合法 uuid 时 Postgres 会报 22P02，这里同样按"查不到"处理
      logger.error('Error fetching domain by id:', error)
      return null
    }

    return (data ?? null) as Domain | null
  }

  static async createDomainWithClient(
    client: SupabaseClient<Database>,
    domain: DomainInsert
  ): Promise<{ data: Domain | null; error: WriteError | null }> {
    // 注意：由于 Supabase 类型系统的限制，这里需要使用类型断言
    // 实际运行时类型是正确的，只是 TypeScript 无法正确推断
    const { data, error } = await (client
      .from('domains')
      .insert(domain as never)
      .select()
      .single() as unknown as Promise<{ data: Domain | null; error: { message: string; code?: string; details?: string } | null }>)

    if (error) {
      logger.error('Error creating domain:', error)
      return {
        data: null,
        error: { message: error.message || error.details || 'Unknown error', code: error.code }
      }
    }

    return { data: data as Domain, error: null }
  }

  /**
   * 批量创建。单次 insert 是一条语句 = 一个隐式事务，要么整批成功要么整批回滚；
   * 循环里逐条 insert 则会在中途失败时留下"客户端收到 400、库里躺着半批"的脏状态。
   */
  static async createDomainsWithClient(
    client: SupabaseClient<Database>,
    domains: DomainInsert[]
  ): Promise<{ data: Domain[]; error: WriteError | null }> {
    if (domains.length === 0) return { data: [], error: null }

    // 注意：由于 Supabase 类型系统的限制，这里需要使用类型断言
    // 实际运行时类型是正确的，只是 TypeScript 无法正确推断
    const { data, error } = await (client
      .from('domains')
      .insert(domains as never)
      .select() as unknown as Promise<{ data: Domain[] | null; error: { message: string; code?: string; details?: string } | null }>)

    if (error) {
      const errMsg = error?.message || error?.details || 'Unknown error'
      logger.error('Error creating domains in bulk:', errMsg)
      return { data: [], error: { message: errMsg, code: error.code } }
    }

    return { data: (data || []) as Domain[], error: null }
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

  static async createTransactionWithClient(
    client: SupabaseClient<Database>,
    transaction: TransactionInsert
  ): Promise<{ data: Transaction | null; error: string | null }> {
    // upsert 而不是 insert：避免「上一次 POST 成功但客户端没收到响应 → 重发」
    // 这类场景拿 409 PK 冲突砸到用户脸上。RLS 还是按 user_id WITH CHECK 守住——
    // 不是自己的行 upsert 也会被拒。onConflict=id 让 PG 走 ON CONFLICT DO UPDATE，
    // 同 id 时刷字段；新 id 时正常 insert。
    const { data, error } = await (client
      .from('domain_transactions')
      .upsert(transaction as never, { onConflict: 'id' })
      .select()
      .single() as unknown as Promise<{ data: Transaction | null; error: { message: string; details?: string } | null }>)

    if (error) {
      const errMsg = error?.message || error?.details || 'Unknown error'
      logger.error('Error creating transaction:', errMsg)
      return { data: null, error: errMsg }
    }

    return { data, error: null }
  }

  /**
   * 批量创建。同 createDomainsWithClient：一次调用一个隐式事务，避免半批写入。
   * 沿用单条版的 upsert(onConflict=id) 语义——重发整批不会被 PK 冲突砸脸。
   */
  static async createTransactionsWithClient(
    client: SupabaseClient<Database>,
    transactions: TransactionInsert[]
  ): Promise<{ data: Transaction[]; error: string | null }> {
    if (transactions.length === 0) return { data: [], error: null }

    const { data, error } = await (client
      .from('domain_transactions')
      .upsert(transactions as never, { onConflict: 'id' })
      .select() as unknown as Promise<{ data: Transaction[] | null; error: { message: string; details?: string } | null }>)

    if (error) {
      const errMsg = error?.message || error?.details || 'Unknown error'
      logger.error('Error creating transactions in bulk:', errMsg)
      return { data: [], error: errMsg }
    }

    return { data: (data || []) as Transaction[], error: null }
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

// 分期到账记录 CRUD
export class InstallmentReceiptService {
  private static readonly PAGE_SIZE = 1000

  static async getReceiptsWithClient(
    client: SupabaseClient<Database>,
    userId: string
  ): Promise<InstallmentReceiptRow[]> {
    const all: InstallmentReceiptRow[] = []
    for (let from = 0; ; from += InstallmentReceiptService.PAGE_SIZE) {
      const { data, error } = await client
        .from('installment_receipts')
        .select('*')
        .eq('user_id', userId)
        .order('received_date', { ascending: true })
        .range(from, from + InstallmentReceiptService.PAGE_SIZE - 1)

      if (error) {
        logger.error('Error fetching installment receipts:', error)
        return all
      }
      const batch = data || []
      all.push(...batch)
      if (batch.length < InstallmentReceiptService.PAGE_SIZE) break
    }
    return all
  }

  /** 按 id + user_id 取单行。PUT / DELETE 用它区分「不存在」和「不是你的」。 */
  static async getReceiptByIdWithClient(
    client: SupabaseClient<Database>,
    id: string,
    userId: string
  ): Promise<InstallmentReceiptRow | null> {
    const receiptId = typeof id === 'string' ? id.trim() : ''
    if (!receiptId) return null

    const { data, error } = await (client
      .from('installment_receipts')
      .select('*')
      .eq('id', receiptId)
      .eq('user_id', userId)
      .maybeSingle() as unknown as Promise<{ data: InstallmentReceiptRow | null; error: { message: string } | null }>)

    if (error) {
      // id 不是合法 uuid 时 Postgres 会报 22P02，这里同样按"查不到"处理
      logger.error('Error fetching installment receipt by id:', error)
      return null
    }
    return data ?? null
  }

  static async createReceiptWithClient(
    client: SupabaseClient<Database>,
    receipt: InstallmentReceiptInsert
  ): Promise<{ data: InstallmentReceiptRow | null; error: string | null }> {
    const { data, error } = await (client
      .from('installment_receipts')
      .insert(receipt as never)
      .select()
      .single() as unknown as Promise<{ data: InstallmentReceiptRow | null; error: { message: string; details?: string } | null }>)

    if (error) {
      const errMsg = error?.message || error?.details || 'Unknown error'
      logger.error('Error creating installment receipt:', errMsg)
      return { data: null, error: errMsg }
    }
    return { data, error: null }
  }

  static async updateReceiptWithClient(
    client: SupabaseClient<Database>,
    id: string,
    updates: InstallmentReceiptUpdate,
    userId?: string
  ): Promise<InstallmentReceiptRow | null> {
    let query = client
      .from('installment_receipts')
      .update(updates as never)
      .eq('id', id)

    if (userId) {
      query = query.eq('user_id', userId) as typeof query
    }

    const { data, error } = await (query
      .select()
      .single() as unknown as Promise<{ data: InstallmentReceiptRow | null; error: { message: string } | null }>)

    if (error) {
      logger.error('Error updating installment receipt:', error)
      return null
    }
    return data
  }

  static async deleteReceiptWithClient(
    client: SupabaseClient<Database>,
    id: string,
    userId?: string
  ): Promise<boolean> {
    let query = client
      .from('installment_receipts')
      .delete()
      .eq('id', id)

    if (userId) {
      query = query.eq('user_id', userId) as typeof query
    }

    const { error } = await query

    if (error) {
      logger.error('Error deleting installment receipt:', error)
      return false
    }
    return true
  }
}

export async function loadInstallmentReceiptsFromSupabase(
  userId: string
): Promise<DataServiceResult<InstallmentReceiptRow[]>> {
  try {
    const data = await InstallmentReceiptService.getReceiptsWithClient(supabase, userId)
    return { success: true, data, source: 'supabase' }
  } catch (error) {
    logger.error('Error loading installment receipts from Supabase:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      source: 'supabase'
    }
  }
}

// 数据加载函数
export async function loadDomainsFromSupabase(userId: string): Promise<DataServiceResult<Domain[]>> {
  try {
    // 走 DomainService 的分页实现：直接 select 会被 PostgREST 截断在 1000 行，
    // dashboard 上表现为"域名凭空少了一批"。
    const { data, error } = await DomainService.listDomainsWithClient(supabase, userId)

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
