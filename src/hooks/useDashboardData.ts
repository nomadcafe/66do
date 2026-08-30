import { useState, useEffect, useCallback, useRef } from 'react';
import {
  loadDomainsFromSupabase,
  loadInstallmentReceiptsFromSupabase,
  loadTransactionsFromSupabase,
} from '../lib/supabaseService';
import { supabase } from '../lib/supabase';
import {
  DomainWithTags,
  TransactionWithRequiredFields,
  ensureDomainWithTags,
  ensureTransactionWithRequiredFields
} from '../types/dashboard';
import {
  translateValidationMessages,
  validateDomain,
  validateTransaction
} from '../lib/validation';
import { mergeRenewTransactionDomainUpdates } from '../lib/renewDomainPatch';
import { reconcileOptimisticSave } from '../lib/reconcileOptimisticSave';
import { logger } from '../lib/logger';
import { MAX_BULK_OPERATION_SIZE } from '../lib/constants';

interface LoadOptions {
  showLoading?: boolean;
}

/** 带 HTTP 状态码的保存错误，供上层按状态分流（409 重名 / 401 掉登录）而不是匹配报错文案 */
class SaveRequestError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'SaveRequestError';
    this.status = status;
  }
}

/**
 * 硬刷新后 Supabase 客户端可能尚未恢复 JWT，此时 RLS 会返回空列表，表现为
 * 「交易消失」。所以加载前先确认 session 就绪。
 *
 * 事件驱动而不是轮询：旧实现每 100ms 查一次、最多 40 轮，每轮 getSession() +
 * getUser() 两次调用，最坏情况 80 次 auth 往返才放弃。现在快路径查一次就返回，
 * 没就绪则挂到 onAuthStateChange 上等推送（订阅时 Supabase 会立即补发一次
 * INITIAL_SESSION，所以「订阅建立前刚好就绪」不会被漏掉），超时上限与原来的
 * 40 × 100ms 保持一致。
 */
async function waitForSupabaseSession(userId: string, timeoutMs = 4000): Promise<boolean> {
  // getSession() 可能读到本地缓存；getUser() 会向 Auth 校验 JWT，再查库更不容易空列表
  const isReady = async (session: { user?: { id?: string } } | null): Promise<boolean> => {
    if (session?.user?.id !== userId) return false;
    const { data: { user }, error } = await supabase.auth.getUser();
    return !error && user?.id === userId;
  };

  const { data: { session: current } } = await supabase.auth.getSession();
  if (await isReady(current)) return true;

  return new Promise<boolean>((resolve) => {
    let settled = false;

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      // isReady 是异步的，所以这个回调永远不会同步调到下面的 finish/timer——
      // 即使 Supabase 在订阅瞬间就补发 INITIAL_SESSION，.then 也要等到微任务。
      void isReady(session).then((ready) => {
        if (ready) finish(true);
      });
    });

    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      data.subscription.unsubscribe();
      resolve(ok);
    };

    const timer = setTimeout(() => finish(false), timeoutMs);
  });
}

interface UseDashboardDataReturn {
  domains: DomainWithTags[];
  transactions: TransactionWithRequiredFields[];
  loading: boolean;
  error: string | null;
  setError: (error: string | null) => void;
  loadDashboardData: (options?: LoadOptions) => Promise<void>;
  saveData: (newDomains: DomainWithTags[], newTransactions: TransactionWithRequiredFields[], options?: { domainsOnly?: boolean }) => Promise<void>;
  refreshData: () => Promise<void>;
}

export function useDashboardData(
  userId: string | undefined,
  sessionToken: string | undefined,
  refreshToken: string | undefined,
  t: (key: string) => string
): UseDashboardDataReturn {
  const [domains, setDomains] = useState<DomainWithTags[]>([]);
  const [transactions, setTransactions] = useState<TransactionWithRequiredFields[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // t 只用来翻错误文案，但它的引用会随 locale / i18n isLoading 变化。若直接进
  // useCallback 依赖，首屏 isLoading true→false 就会重建 loadDashboardData，
  // 触发挂载 effect 再跑一遍——domains + transactions + receipts 全量重拉；
  // 切换中英文同理。放进 ref 里读，依赖里摘掉。
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  }, [t]);

  const loadDashboardData = useCallback(async (options: LoadOptions = {}) => {
    if (!userId) return;

    const { showLoading = true } = options;

    try {
      if (showLoading) setLoading(true);
      setError(null);

      const sessionReady = await waitForSupabaseSession(userId);
      if (!sessionReady) {
        // 不打 userId 进日志——UUID 是 PII；Vercel server log 留痕没必要
        // 引入额外暴露面。如果将来真的需要按用户区分这条 error 再加 hash 后缀。
        logger.error('Dashboard load: Supabase session not ready');
        setError(tRef.current('common.authError') || 'Please sign in again to load your data.');
        if (showLoading) setLoading(false);
        return;
      }

      // 不再走内存 cache 捷径：曾导致刷新后仍展示旧列表或 session 未就绪时空列表被当作有效数据
      logger.log('Loading data from Supabase database...');
      const [domainsResult, transactionsResult, receiptsResult] = await Promise.all([
        loadDomainsFromSupabase(userId),
        loadTransactionsFromSupabase(userId),
        loadInstallmentReceiptsFromSupabase(userId),
      ]);
      if (!domainsResult.success || !transactionsResult.success) {
        throw new Error('Failed to load data from Supabase database');
      }
      // installment_receipts 加载失败不阻塞 dashboard——退化成"分期收款=0"，UI
      // 仍可用，避免一个非核心表故障让所有数据空白。
      const receipts = receiptsResult.success ? (receiptsResult.data || []) : [];
      const receiptsByTx = new Map<string, typeof receipts>();
      for (const r of receipts) {
        const list = receiptsByTx.get(r.transaction_id) || [];
        list.push(r);
        receiptsByTx.set(r.transaction_id, list);
      }
      const typedDomains = (domainsResult.data || []).map(ensureDomainWithTags);
      const typedTransactions = (transactionsResult.data || []).map((tx) => {
        const ensured = ensureTransactionWithRequiredFields(tx);
        const txReceipts = receiptsByTx.get(ensured.id);
        return txReceipts && txReceipts.length > 0
          ? { ...ensured, receipts: txReceipts.map((r) => ({
              id: r.id,
              transaction_id: r.transaction_id,
              received_date: r.received_date,
              amount: Number(r.amount),
              period_no: r.period_no ?? null,
              notes: r.notes ?? null,
              created_at: r.created_at,
              updated_at: r.updated_at,
            })) }
          : ensured;
      });
      setDomains(typedDomains);
      setTransactions(typedTransactions);
      logger.log('Data loaded from Supabase database successfully');
    } catch (error) {
      logger.error('Error loading data from Supabase:', error);
      setError(tRef.current('common.dataLoadFailed'));
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [userId]);

  const saveData = useCallback(async (
    newDomains: DomainWithTags[],
    newTransactions: TransactionWithRequiredFields[],
    options?: { domainsOnly?: boolean }
  ) => {
    if (!userId) return;

    const domainsOnly = options?.domainsOnly === true;

    const domainsForSave = domainsOnly
      ? newDomains
      : mergeRenewTransactionDomainUpdates(newDomains, newTransactions, transactions);

    // 先乐观更新，再校验与持久化：新增/编辑后立即反映到 UI。
    // 保存前留一份快照 + 逐行记录哪些真的落库了，失败时按行对账回滚（见 catch）。
    const previousDomains = domains;
    const previousTransactions = transactions;
    const savedDomainIds = new Set<string>();
    const savedTransactionIds = new Set<string>();
    // 服务端回写的交易行。声明在 try 外面，catch 里的对账回滚也要读它。
    const serverTransactionsById = new Map<string, TransactionWithRequiredFields>();

    setDomains(domainsForSave);
    if (!domainsOnly) setTransactions(newTransactions);

    try {
      // 优先用浏览器内 getSession()（可自动刷新过期的 access_token）；页面 props 里的 token 可能已过期
      const { data: { session: liveSession } } = await supabase.auth.getSession();
      const accessToken =
        liveSession?.access_token ?? sessionToken ?? null;
      const refreshTok =
        liveSession?.refresh_token ?? refreshToken ?? null;
      if (!accessToken) {
        setError(tRef.current('common.authError') || 'Please sign in again to save.');
        throw new Error('No access token for save');
      }

      const toDomainSignature = (domain: DomainWithTags) => JSON.stringify({
        id: domain.id,
        domain_name: domain.domain_name,
        status: domain.status,
        renewal_cycle: domain.renewal_cycle ?? 1,
        renewal_count: domain.renewal_count ?? 0,
        registrar: domain.registrar || null,
        purchase_date: domain.purchase_date || null,
        purchase_cost: domain.purchase_cost || null,
        renewal_cost: domain.renewal_cost || null,
        baseline_renewal_as_of: domain.baseline_renewal_as_of || null,
        registration_date: domain.registration_date || null,
        next_renewal_date: domain.next_renewal_date || null,
        expiry_date: domain.expiry_date || null,
        estimated_value: domain.estimated_value || null,
        sale_date: domain.sale_date || null,
        sale_price: domain.sale_price || null,
        platform_fee: domain.platform_fee || null,
        tags: JSON.stringify(domain.tags || []),
      });
      const toTransactionSignature = (transaction: TransactionWithRequiredFields) => JSON.stringify({
        id: transaction.id,
        domain_id: transaction.domain_id,
        type: transaction.type,
        amount: transaction.amount,
        currency: transaction.currency,
        platform_fee: transaction.platform_fee || null,
        platform_fee_percentage: transaction.platform_fee_percentage || null,
        net_amount: transaction.net_amount || null,
        date: transaction.date,
        notes: transaction.notes || null,
        platform: transaction.platform || null,
        category: transaction.category || null,
        tax_deductible: transaction.tax_deductible ?? false,
        receipt_url: transaction.receipt_url || null,
        payment_plan: transaction.payment_plan || null,
        installment_period: transaction.installment_period || null,
        downpayment_amount: transaction.downpayment_amount || null,
        installment_amount: transaction.installment_amount || null,
        final_payment_amount: transaction.final_payment_amount || null,
        total_installment_amount: transaction.total_installment_amount || null,
        installment_status: transaction.installment_status || null,
        platform_fee_type: transaction.platform_fee_type || null,
        user_input_fee_rate: transaction.user_input_fee_rate || null,
        user_input_surcharge_rate: transaction.user_input_surcharge_rate || null,
        afternic_ns_pointed: transaction.afternic_ns_pointed ?? null,
        afternic_premium_addon: transaction.afternic_premium_addon ?? null,
        atom_commission_tier: transaction.atom_commission_tier ?? null,
        atom_no_coin: transaction.atom_no_coin ?? null,
        atom_custom_commission_rate: transaction.atom_custom_commission_rate ?? null,
        escrow_lease_type: transaction.escrow_lease_type ?? null,
        escrow_transaction_fee: transaction.escrow_transaction_fee ?? null,
        renewal_period_years: transaction.renewal_period_years ?? null,
        extend_domain_expiry_on_renew: transaction.extend_domain_expiry_on_renew ?? null,
        renewal_years_use_custom: transaction.renewal_years_use_custom ?? null,
      });

      const existingDomainMap = new Map(domains.map((d) => [d.id, d]));
      const changedDomains = domainsForSave.filter((domain) => {
        const existing = existingDomainMap.get(domain.id);
        if (!existing) return true;
        return toDomainSignature(existing) !== toDomainSignature(domain);
      });

      const existingTransactionMap = new Map(transactions.map((tx) => [tx.id, tx]));
      const changedTransactions = domainsOnly
        ? []
        : newTransactions.filter((transaction) => {
            const existing = existingTransactionMap.get(transaction.id);
            if (!existing) return true;
            return toTransactionSignature(existing) !== toTransactionSignature(transaction);
          });

      logger.log(
        domainsOnly
          ? `Saving changed domains to Supabase... (${changedDomains.length})`
          : `Saving changed data to Supabase... (${changedDomains.length} domains, ${changedTransactions.length} transactions)`
      );

      for (const domain of changedDomains) {
        const validation = validateDomain(domain);
        if (!validation.valid) {
          const msgs = translateValidationMessages(validation.errors, tRef.current);
          throw new Error(`Domain validation failed: ${msgs.join(', ')}`);
        }
      }

      if (!domainsOnly) {
        for (const transaction of changedTransactions) {
          const validation = validateTransaction(transaction);
          if (!validation.valid) {
            const msgs = translateValidationMessages(validation.errors, tRef.current);
            throw new Error(`Transaction validation failed: ${msgs.join(', ')}`);
          }
        }
      }

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      };
      // 只走 header，不进 body。服务端唯一的用途是 auth-helper 在 access_token
      // 过期时拿它换一个新的（getAuthInfoFromRequest 读的是 header）；曾经 POST
      // body 里也带一份，那是给 createAuthenticatedSupabaseClient 的 setSession
      // 用的，setSession 删掉后 body 里那份就是纯粹多暴露一次长效凭证了。
      if (refreshTok) (headers as Record<string, string>)['X-Refresh-Token'] = refreshTok;

      // 把 domain row 序列化成 API 期望的 payload 形态。提出来好让单条
      // POST / 批量 POST / 单条 PUT 三条路径共用，避免漂移。registration_date
      // 不能漏（之前漏过：CSV 导入填了的注册日期会被默默丢掉）。
      const buildPayload = (domain: DomainWithTags) => ({
        ...domain,
        id: domain.id,
        domain_name: domain.domain_name,
        status: domain.status,
        renewal_cycle: domain.renewal_cycle ?? 1,
        renewal_count: domain.renewal_count ?? 0,
        registrar: domain.registrar || null,
        purchase_date: domain.purchase_date || null,
        purchase_cost: domain.purchase_cost || null,
        renewal_cost: domain.renewal_cost || null,
        baseline_renewal_as_of: domain.baseline_renewal_as_of || null,
        registration_date: domain.registration_date || null,
        next_renewal_date: domain.next_renewal_date || null,
        expiry_date: domain.expiry_date || null,
        estimated_value: domain.estimated_value || null,
        sale_date: domain.sale_date || null,
        sale_price: domain.sale_price || null,
        platform_fee: domain.platform_fee || null,
        // tags 列已迁移到 jsonb（migrate_tags_to_jsonb.sql）。直接传数组，
        // supabase-js 会原样作为 jsonb 写入。**不要**再 JSON.stringify——那
        // 会变成 string-of-array-of-strings，在 jsonb 列里形成双重编码。
        tags: domain.tags,
      });

      const handleSaveResponseError = async (
        response: Response,
        op: 'add' | 'update',
        entity: 'domain' | 'transaction' = 'domain'
      ): Promise<never> => {
        const errorData = await response.json().catch(() => ({}));
        const details = errorData.details
          ? (Array.isArray(errorData.details)
              ? translateValidationMessages(errorData.details, tRef.current).join('; ')
              : String(errorData.details))
          : (errorData.error || response.statusText);
        throw new SaveRequestError(`Failed to ${op} ${entity}: ${details}`, response.status);
      };

      // 拆分：已存在的（PUT 一条条更新）vs 新建的（多条用 bulk POST 节省
      // rate-limit 槽位）。背景：userWrite rate limit 是 60/min/user，CSV
      // 导入 100+ 行时单条 POST 会从第 61 行开始 429 失败。bulk POST 全批
      // 共享 1 个 rate-limit 检查，223 行 → 3 批 → 3 个槽位，绝对够用。
      const existingChanges = changedDomains.filter((d) => existingDomainMap.has(d.id));
      const newChanges = changedDomains.filter((d) => !existingDomainMap.has(d.id));

      // 先处理 update（PUT 没有批量端点，逐条来；但更新通常远少于新增）。
      for (const domain of existingChanges) {
        const response = await fetch(`/api/domains/${domain.id}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(buildPayload(domain)),
        });
        if (!response.ok) {
          await handleSaveResponseError(response, 'update');
        }
        savedDomainIds.add(domain.id);
      }

      if (newChanges.length === 1) {
        // 单条新增走单条 POST：保留 server 端的"按 name 去重 / 409"语义，
        // 防止用户从 form 里手填一个重名域名时静默插入重复。
        const response = await fetch('/api/domains', {
          method: 'POST',
          headers,
          body: JSON.stringify({ domain: buildPayload(newChanges[0]) }),
        });
        if (!response.ok) {
          await handleSaveResponseError(response, 'add');
        }
        savedDomainIds.add(newChanges[0].id);
      } else if (newChanges.length > 1) {
        // 多条新增走 bulk POST，按 MAX_BULK_OPERATION_SIZE 分批。CSV 导入
        // 已经在客户端 mergeWithExisting 阶段按 name 去过重了，bulk 端点没
        // server-side 去重也 OK——能进到这条路的 newChanges 都是真新行。
        for (let i = 0; i < newChanges.length; i += MAX_BULK_OPERATION_SIZE) {
          const chunk = newChanges.slice(i, i + MAX_BULK_OPERATION_SIZE);
          const response = await fetch('/api/domains', {
            method: 'POST',
            headers,
            body: JSON.stringify({ domains: chunk.map(buildPayload) }),
          });
          if (!response.ok) {
            await handleSaveResponseError(response, 'add');
          }
          chunk.forEach((d) => savedDomainIds.add(d.id));
        }
      }

      if (domainsOnly) {
        logger.log('Domains saved successfully');
        return;
      }

      // 增量保存 transactions（仅新增/变更）。全部走 /api/transactions —— 之前
      // 新增是在浏览器里直连 Supabase，绕过了服务端的 validateTransaction、
      // 域名归属校验和写入限流，而删除/更新却走 API，同一个 hook 两套路径。
      // 剥掉所有「Transaction 类型上有、但 domain_transactions 表没有」的纯客户端
      // 字段。整个对象 spread 出去，服务端 buildTransactionInsertPayload 只按
      // whitelist 取字段，但 PUT 路径的 update 写到不存在的列会失败 → 回 404。
      // 每多挂一个内存字段都要在这儿加进 omit 列表：
      //   - receipts:                 来自 installment_receipts 子表的 view
      //   - renewal_years_use_custom: TransactionForm 的 UI toggle
      //   - extend_domain_expiry_on_renew: merger 用的延期 flag
      const toTransactionPayload = (transaction: TransactionWithRequiredFields) => {
        const {
          receipts: _receipts,
          renewal_years_use_custom: _useCustom,
          extend_domain_expiry_on_renew: _extendExpiry,
          ...txWithoutClientOnly
        } = transaction;
        return {
          ...txWithoutClientOnly,
          platform_fee: transaction.platform_fee || null,
          platform_fee_percentage: transaction.platform_fee_percentage || null,
          net_amount: transaction.net_amount || null,
          category: transaction.category || null,
          tax_deductible: transaction.tax_deductible ?? false,
          receipt_url: transaction.receipt_url || null,
          notes: transaction.notes || null
        };
      };

      const recordServerTransaction = (row: unknown) => {
        if (!row) return;
        const ensured = ensureTransactionWithRequiredFields(row as TransactionWithRequiredFields);
        serverTransactionsById.set(ensured.id, ensured);
      };

      const postTransactions = async (body: Record<string, unknown>): Promise<unknown> => {
        const response = await fetch('/api/transactions', {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });
        if (!response.ok) {
          await handleSaveResponseError(response, 'add', 'transaction');
        }
        const json = await response.json().catch(() => ({}));
        return json?.data;
      };

      const existingTxChanges = changedTransactions.filter((t) => existingTransactionMap.has(t.id));
      const newTxChanges = changedTransactions.filter((t) => !existingTransactionMap.has(t.id));

      // 更新：PUT 没有批量端点，逐条来（更新通常远少于新增）
      for (const transaction of existingTxChanges) {
        const transactionPayload = toTransactionPayload(transaction);
        const response = await fetch(`/api/transactions/${transaction.id}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(transactionPayload)
        });
        if (response.ok) {
          savedTransactionIds.add(transaction.id);
          continue;
        }

        if (response.status === 404 || response.status === 403) {
          // 交易在本地存在但远端缺失（例如历史保存中断）时回退为创建，避免持续
          // 404/403 卡死。POST 服务端走的是 upsert(onConflict=id)，所以「行其实
          // 存在、404 是 RLS 在 token 刷新瞬间误返」这种情况会变成一次 UPDATE，
          // 不再需要客户端手工识别主键冲突再补 UPDATE。
          //
          // 仍未解决的老问题：若 404 是误报且该行的 id 与本地不同，这里会插出
          // 一条「逻辑重复但 UUID 不同」的记录。drop_renewal_cost_history
          // migration（commit 3bd5888）清掉的两条孤儿疑似经此路径产生。真要根治
          // 得在服务端按 (domain_id, date, type, amount) 查一遍。
          recordServerTransaction(await postTransactions({ transaction: transactionPayload }));
          savedTransactionIds.add(transaction.id);
          continue;
        }

        await handleSaveResponseError(response, 'update', 'transaction');
      }

      // 新增：单条走单条 POST；多条走 bulk 并按 MAX_BULK_OPERATION_SIZE 分批。
      // 与域名同样的理由：userWrite rate limit 是 60/min/user，CSV 导入的交易
      // 逐条 POST 会从第 61 条开始 429，bulk 全批共享 1 个槽位。
      if (newTxChanges.length === 1) {
        recordServerTransaction(
          await postTransactions({ transaction: toTransactionPayload(newTxChanges[0]) })
        );
        savedTransactionIds.add(newTxChanges[0].id);
      } else if (newTxChanges.length > 1) {
        for (let i = 0; i < newTxChanges.length; i += MAX_BULK_OPERATION_SIZE) {
          const chunk = newTxChanges.slice(i, i + MAX_BULK_OPERATION_SIZE);
          const created = await postTransactions({
            transactions: chunk.map(toTransactionPayload),
          });
          if (Array.isArray(created)) created.forEach(recordServerTransaction);
          chunk.forEach((t) => savedTransactionIds.add(t.id));
        }
      }

      if (serverTransactionsById.size > 0) {
        setTransactions(
          newTransactions.map((t) => serverTransactionsById.get(t.id) ?? t)
        );
      }

      logger.log('Data saved to Supabase database successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const status = error instanceof SaveRequestError ? error.status : undefined;
      // 按状态码判定，不再匹配报错文案——文案已经 i18n 化，中英文各是一套字符串
      const isDuplicateDomain = status === 409;

      if (isDuplicateDomain) {
        logger.log('Add domain skipped: domain already in portfolio');
      } else {
        logger.error('Error saving data to Supabase:', error);
      }

      // 保存失败时不重新拉取（避免用一次网络抖动把用户正在编辑的内容冲掉），
      // 但要按行对账回滚乐观更新，否则失败的行会被下次 diff 当成「已保存」而
      // 永远不再重发 —— 理由详见 reconcileOptimisticSave 的注释。
      setDomains(reconcileOptimisticSave(domainsForSave, previousDomains, savedDomainIds));
      if (!domainsOnly) {
        setTransactions(
          reconcileOptimisticSave(
            newTransactions,
            previousTransactions,
            savedTransactionIds,
            serverTransactionsById
          )
        );
      }

      const isNetworkError = errorMessage.includes('fetch') || errorMessage.includes('network');
      const isAuthError =
        status === 401 || errorMessage.includes('401') || errorMessage.includes('Unauthorized');

      if (isAuthError) {
        setError(tRef.current('common.authError') || 'Authentication failed. Please log in again.');
      } else if (isNetworkError) {
        setError(tRef.current('common.networkError') || 'Network error. Please check your connection and try again.');
      } else if (isDuplicateDomain) {
        setError(tRef.current('dashboard.domainAlreadyExistsDesc') || tRef.current('dashboard.domainAlreadyExists') || errorMessage);
      } else {
        setError(tRef.current('common.dataSaveFailed') || `Failed to save data: ${errorMessage}`);
      }

      throw error;
    }
  }, [userId, sessionToken, refreshToken, domains, transactions]);

  const refreshData = useCallback(async () => {
    await loadDashboardData({ showLoading: true });
  }, [loadDashboardData]);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      setDomains([]);
      setTransactions([]);
      return;
    }
    loadDashboardData({ showLoading: true });
  }, [loadDashboardData, userId]);

  return {
    domains,
    transactions,
    loading,
    error,
    setError,
    loadDashboardData,
    saveData,
    refreshData
  };
}

