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

/**
 * id 不是合法 uuid 时 Postgres 报 22P02（invalid_text_representation）。
 * 这不是故障，是"这个 id 不可能匹配到任何行"，按 0 行处理，让调用方回 403
 * 而不是 500。读路径（getDomainByIdWithClient 等）一直是这么处理的，写路径
 * 去掉前置所有权 SELECT 之后也要自己扛起这一层。
 */
function isMalformedIdError(error: { code?: string } | null): boolean {
  return error?.code === '22P02'
}

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

  /**
   * 按 id + user_id 取单行。所有权校验/单域名读取都走这里，别再用
   * listDomainsWithClient 拉全表再 find —— 那要多翻好几页，且早期版本里的
   * 单页实现会让第 1001 个域名被判成"不存在"。
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

  /**
   * 按 id + user_id 更新。返回值把"没有匹配到行"和"真的出错"分开：前者
   * `{ data: null, error: null }`，调用方回 403；后者带 error，回 500。
   *
   * 语句自带 `.eq('user_id')`，加上 domains 表的 RLS（FOR ALL USING
   * auth.uid() = user_id），归属校验已经在这一条语句里完成了——不需要先
   * SELECT 一次确认"这行是不是你的"再写，那是白白多一次往返。
   */
  static async updateDomainWithClient(
    client: SupabaseClient<Database>,
    id: string,
    updates: DomainUpdate,
    userId?: string
  ): Promise<{ data: Domain | null; error: WriteError | null }> {
    const domainId = typeof id === 'string' ? id.trim() : ''
    if (!domainId) return { data: null, error: null }

    // 注意：由于 Supabase 类型系统的限制，这里需要使用类型断言
    // 实际运行时类型是正确的，只是 TypeScript 无法正确推断
    let queryBuilder = client
      .from('domains')
      .update(updates as never)
      .eq('id', domainId)

    if (userId) {
      queryBuilder = queryBuilder.eq('user_id', userId) as typeof queryBuilder
    }

    // maybeSingle 而不是 single：0 行是"不是你的 / 不存在"这个正常分支，
    // single 会把它变成 PGRST116 错误，和真正的故障混在一起。
    const { data, error } = await (queryBuilder
      .select()
      .maybeSingle() as unknown as Promise<{ data: Domain | null; error: { message: string; code?: string } | null }>)

    if (error) {
      if (isMalformedIdError(error)) return { data: null, error: null }
      logger.error('Error updating domain:', error)
      return { data: null, error: { message: error.message || 'Unknown error', code: error.code } }
    }

    return { data: data ?? null, error: null }
  }

  /**
   * 按 id + user_id 删除，用带用户 JWT 的 client（RLS 才能通过）。
   * 返回真正删掉的行数：0 = 不存在或不是你的，调用方回 403。同 update，
   * 归属校验就在这一条语句里，不需要前置 SELECT。
   */
  static async deleteDomainWithClient(
    client: SupabaseClient<Database>,
    id: string,
    userId?: string
  ): Promise<{ deleted: number; error: WriteError | null }> {
    const domainId = typeof id === 'string' ? id.trim() : ''
    if (!domainId) return { deleted: 0, error: null }

    let query = client.from('domains').delete().eq('id', domainId)
    if (userId) {
      query = query.eq('user_id', userId) as typeof query
    }
    // .select() 让 PostgREST 回传被删掉的行，否则无法区分"删了 1 行"和
    // "条件没匹配到任何行"——后者不是错误，但对调用方是 403。
    const { data, error } = await (query.select('id') as unknown as Promise<{
      data: Array<{ id: string }> | null
      error: { message: string; code?: string } | null
    }>)

    if (error) {
      if (isMalformedIdError(error)) return { deleted: 0, error: null }
      logger.error('Error deleting domain:', error)
      return { deleted: 0, error: { message: error.message || 'Unknown error', code: error.code } }
    }
    return { deleted: data?.length ?? 0, error: null }
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

  /**
   * 分页拉取用户全部交易。与 listDomainsWithClient 同样把 error 原样返回：
   * 半途失败时既不能把已拿到的几页当成完整数据（财务口径会少算），也不能
   * 当成空列表。调用方必须分流「失败」和「真的没有交易」。
   */
  static async listTransactionsWithClient(
    client: SupabaseClient<Database>,
    userId: string
  ): Promise<{ data: Transaction[]; error: { message: string } | null }> {
    const pageSize = TransactionService.TRANSACTION_PAGE_SIZE
    const all: Transaction[] = []
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await client
        .from('domain_transactions')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false })
        // date 是「天」粒度列，同一天多笔交易是常态而非巧合；只按它排序时
        // PostgREST 翻页会重复/漏行。补 id 作为稳定 tiebreaker（domains 那边
        // 同理，见 listDomainsWithClient）。
        .order('id', { ascending: false })
        .range(from, from + pageSize - 1)

      if (error) {
        logger.error('Error fetching transactions:', error)
        return { data: all, error }
      }
      const batch = data || []
      all.push(...batch)
      if (batch.length < pageSize) break
    }
    return { data: all, error: null }
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

  /** 同 DomainService.deleteDomainWithClient：返回真正删掉的行数，0 = 不存在
   *  或不是你的。归属校验由 `.eq('user_id')` + RLS 在这条语句里完成。 */
  static async deleteTransactionWithClient(
    client: SupabaseClient<Database>,
    id: string,
    userId?: string
  ): Promise<{ deleted: number; error: WriteError | null }> {
    const transactionId = typeof id === 'string' ? id.trim() : ''
    if (!transactionId) return { deleted: 0, error: null }

    let query = client
      .from('domain_transactions')
      .delete()
      .eq('id', transactionId)

    if (userId) {
      query = query.eq('user_id', userId) as typeof query
    }

    const { data, error } = await (query.select('id') as unknown as Promise<{
      data: Array<{ id: string }> | null
      error: { message: string; code?: string } | null
    }>)

    if (error) {
      if (isMalformedIdError(error)) return { deleted: 0, error: null }
      logger.error('Error deleting transaction:', error)
      return { deleted: 0, error: { message: error.message || 'Unknown error', code: error.code } }
    }

    return { deleted: data?.length ?? 0, error: null }
  }

}

// 分期到账记录 CRUD
export class InstallmentReceiptService {
  private static readonly PAGE_SIZE = 1000

  /**
   * 分页拉取用户全部分期收款。error 原样返回（同 listTransactionsWithClient）：
   * dashboard 确实允许收款加载失败时降级成「分期收款=0」，但那必须是调用方
   * 看到 error 之后的明确选择，而不是这里把半截数据伪装成完整结果。
   */
  static async listReceiptsWithClient(
    client: SupabaseClient<Database>,
    userId: string
  ): Promise<{ data: InstallmentReceiptRow[]; error: { message: string } | null }> {
    const all: InstallmentReceiptRow[] = []
    for (let from = 0; ; from += InstallmentReceiptService.PAGE_SIZE) {
      const { data, error } = await client
        .from('installment_receipts')
        .select('*')
        .eq('user_id', userId)
        .order('received_date', { ascending: true })
        // received_date 同样是「天」粒度，需要 id 作为翻页 tiebreaker
        .order('id', { ascending: true })
        .range(from, from + InstallmentReceiptService.PAGE_SIZE - 1)

      if (error) {
        logger.error('Error fetching installment receipts:', error)
        return { data: all, error }
      }
      const batch = data || []
      all.push(...batch)
      if (batch.length < InstallmentReceiptService.PAGE_SIZE) break
    }
    return { data: all, error: null }
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
    const { data, error } = await InstallmentReceiptService.listReceiptsWithClient(supabase, userId)
    if (error) {
      logger.error('Error loading installment receipts from Supabase:', error)
      return { success: false, error: error.message, source: 'supabase' }
    }
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
    // error 必须显式分流：分页中途失败时把已拿到的几页当成完整数据返回，
    // dashboard 就会拿半截交易去算成本/利润，且界面上毫无提示。
    const { data, error } = await TransactionService.listTransactionsWithClient(supabase, userId)

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
