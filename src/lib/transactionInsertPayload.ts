import type { TransactionInsert, TransactionUpdate } from './supabaseService'

/**
 * 从交易对象构建 domain_transactions 表的 Insert  payload（API 与客户端共用）
 */
export function buildTransactionInsertPayload(
  transaction: Record<string, unknown>,
  userId: string
): TransactionInsert {
  const id =
    typeof transaction.id === 'string' && transaction.id.trim().length > 0
      ? (transaction.id as string).trim()
      : crypto.randomUUID()
  return {
    id,
    user_id: userId,
    domain_id: transaction.domain_id as string,
    type: transaction.type as string,
    amount: Number(transaction.amount),
    currency: (transaction.currency as string) || 'USD',
    date: transaction.date as string,
    platform_fee: transaction.platform_fee != null ? Number(transaction.platform_fee) : null,
    platform_fee_percentage: transaction.platform_fee_percentage != null ? Number(transaction.platform_fee_percentage) : null,
    net_amount: transaction.net_amount != null ? Number(transaction.net_amount) : null,
    category: (transaction.category as string) || null,
    tax_deductible: Boolean(transaction.tax_deductible),
    receipt_url: (transaction.receipt_url as string) || null,
    notes: (transaction.notes as string) || null,
    platform: (transaction.platform as string) || null,
    payment_plan: (transaction.payment_plan as string) || null,
    installment_period: transaction.installment_period != null ? Number(transaction.installment_period) : null,
    downpayment_amount: transaction.downpayment_amount != null ? Number(transaction.downpayment_amount) : null,
    installment_amount: transaction.installment_amount != null ? Number(transaction.installment_amount) : null,
    final_payment_amount: transaction.final_payment_amount != null ? Number(transaction.final_payment_amount) : null,
    total_installment_amount: transaction.total_installment_amount != null ? Number(transaction.total_installment_amount) : null,
    installment_status: (transaction.installment_status as string) || null,
    installment_first_payment_date:
      typeof transaction.installment_first_payment_date === 'string' &&
      transaction.installment_first_payment_date.trim().length > 0
        ? transaction.installment_first_payment_date
        : null,
    platform_fee_type: (transaction.platform_fee_type as string) || null,
    user_input_fee_rate: transaction.user_input_fee_rate != null ? Number(transaction.user_input_fee_rate) : null,
    user_input_surcharge_rate: transaction.user_input_surcharge_rate != null ? Number(transaction.user_input_surcharge_rate) : null,
    afternic_ns_pointed: typeof transaction.afternic_ns_pointed === 'boolean' ? transaction.afternic_ns_pointed : null,
    afternic_premium_addon: typeof transaction.afternic_premium_addon === 'boolean' ? transaction.afternic_premium_addon : null,
    atom_commission_tier:
      typeof transaction.atom_commission_tier === 'string' && transaction.atom_commission_tier.length > 0
        ? transaction.atom_commission_tier
        : null,
    atom_no_coin: typeof transaction.atom_no_coin === 'boolean' ? transaction.atom_no_coin : null,
    atom_custom_commission_rate:
      transaction.atom_custom_commission_rate != null ? Number(transaction.atom_custom_commission_rate) : null,
    escrow_lease_type:
      typeof transaction.escrow_lease_type === 'string' && transaction.escrow_lease_type.length > 0
        ? transaction.escrow_lease_type
        : null,
    escrow_transaction_fee:
      transaction.escrow_transaction_fee != null ? Number(transaction.escrow_transaction_fee) : null,
    // 未记录时整个键都不出现：这样即使数据库还没加上这一列，既有写入路径
    // 也不会因为「写到不存在的列」而整条 update 失败。
    ...(transaction.escrow_holding_fee != null
      ? { escrow_holding_fee: Number(transaction.escrow_holding_fee) }
      : {}),
    renewal_period_years: normalizeExtensionYears(transaction.type, transaction.renewal_period_years)
  }
}

/** renewal_period_years 只对 renew / transfer 有意义（transfer 表示「本次转移额外
 *  加了几年」）。其它类型一律写 null，避免类型改过之后残留旧年数。 */
function normalizeExtensionYears(type: unknown, raw: unknown): number | null {
  if (type !== 'renew' && type !== 'transfer') return null
  if (raw == null) return null
  const y = Math.floor(Number(raw))
  if (!Number.isFinite(y) || y < 1) return null
  return Math.min(10, y)
}

/**
 * 给 domain_transactions UPDATE 用的白名单 payload。和 Insert 同字段集，只是
 * 不强制 id / user_id（路径参数 + RLS 守住）；任何 client-only 字段（receipts、
 * renewal_years_use_custom、extend_domain_expiry_on_renew 之类）在这里被静默丢弃。
 * 此前 PUT 路径直接把 sanitizeTransactionData(...spread) 喂给 supabase update，
 * 一个不存在的列就让 update 失败 → API 回 404。
 */
export function buildTransactionUpdatePayload(
  transaction: Record<string, unknown>
): TransactionUpdate {
  const out: TransactionUpdate = {}
  if (typeof transaction.domain_id === 'string') out.domain_id = transaction.domain_id
  if (typeof transaction.type === 'string') out.type = transaction.type
  if ('amount' in transaction) out.amount = Number(transaction.amount)
  if ('currency' in transaction)
    out.currency = (transaction.currency as string) || 'USD'
  if ('date' in transaction) out.date = transaction.date as string
  if ('platform_fee' in transaction)
    out.platform_fee = transaction.platform_fee != null ? Number(transaction.platform_fee) : null
  if ('platform_fee_percentage' in transaction)
    out.platform_fee_percentage =
      transaction.platform_fee_percentage != null
        ? Number(transaction.platform_fee_percentage)
        : null
  if ('net_amount' in transaction)
    out.net_amount = transaction.net_amount != null ? Number(transaction.net_amount) : null
  if ('category' in transaction)
    out.category = (transaction.category as string) || null
  if ('tax_deductible' in transaction)
    out.tax_deductible = Boolean(transaction.tax_deductible)
  if ('receipt_url' in transaction)
    out.receipt_url = (transaction.receipt_url as string) || null
  if ('notes' in transaction) out.notes = (transaction.notes as string) || null
  if ('platform' in transaction)
    out.platform = (transaction.platform as string) || null
  if ('payment_plan' in transaction)
    out.payment_plan = (transaction.payment_plan as string) || null
  if ('installment_period' in transaction)
    out.installment_period =
      transaction.installment_period != null ? Number(transaction.installment_period) : null
  if ('downpayment_amount' in transaction)
    out.downpayment_amount =
      transaction.downpayment_amount != null ? Number(transaction.downpayment_amount) : null
  if ('installment_amount' in transaction)
    out.installment_amount =
      transaction.installment_amount != null ? Number(transaction.installment_amount) : null
  if ('final_payment_amount' in transaction)
    out.final_payment_amount =
      transaction.final_payment_amount != null ? Number(transaction.final_payment_amount) : null
  if ('total_installment_amount' in transaction)
    out.total_installment_amount =
      transaction.total_installment_amount != null
        ? Number(transaction.total_installment_amount)
        : null
  if ('installment_status' in transaction)
    out.installment_status = (transaction.installment_status as string) || null
  if ('installment_first_payment_date' in transaction) {
    const v = transaction.installment_first_payment_date
    out.installment_first_payment_date =
      typeof v === 'string' && v.trim().length > 0 ? v : null
  }
  if ('platform_fee_type' in transaction)
    out.platform_fee_type = (transaction.platform_fee_type as string) || null
  if ('user_input_fee_rate' in transaction)
    out.user_input_fee_rate =
      transaction.user_input_fee_rate != null ? Number(transaction.user_input_fee_rate) : null
  if ('user_input_surcharge_rate' in transaction)
    out.user_input_surcharge_rate =
      transaction.user_input_surcharge_rate != null
        ? Number(transaction.user_input_surcharge_rate)
        : null
  if ('afternic_ns_pointed' in transaction)
    out.afternic_ns_pointed =
      typeof transaction.afternic_ns_pointed === 'boolean' ? transaction.afternic_ns_pointed : null
  if ('afternic_premium_addon' in transaction)
    out.afternic_premium_addon =
      typeof transaction.afternic_premium_addon === 'boolean'
        ? transaction.afternic_premium_addon
        : null
  if ('atom_commission_tier' in transaction) {
    const v = transaction.atom_commission_tier
    out.atom_commission_tier = typeof v === 'string' && v.length > 0 ? v : null
  }
  if ('atom_no_coin' in transaction)
    out.atom_no_coin =
      typeof transaction.atom_no_coin === 'boolean' ? transaction.atom_no_coin : null
  if ('atom_custom_commission_rate' in transaction)
    out.atom_custom_commission_rate =
      transaction.atom_custom_commission_rate != null
        ? Number(transaction.atom_custom_commission_rate)
        : null
  if ('escrow_lease_type' in transaction) {
    const v = transaction.escrow_lease_type
    out.escrow_lease_type = typeof v === 'string' && v.length > 0 ? v : null
  }
  if ('escrow_transaction_fee' in transaction)
    out.escrow_transaction_fee =
      transaction.escrow_transaction_fee != null
        ? Number(transaction.escrow_transaction_fee)
        : null
  // 同 insert：只有真的记了值才写这一列
  if ('escrow_holding_fee' in transaction && transaction.escrow_holding_fee != null)
    out.escrow_holding_fee = Number(transaction.escrow_holding_fee)
  const extendableType = transaction.type === 'renew' || transaction.type === 'transfer'
  if (extendableType && 'renewal_period_years' in transaction) {
    out.renewal_period_years = normalizeExtensionYears(
      transaction.type,
      transaction.renewal_period_years
    )
  } else if (!extendableType && 'type' in transaction) {
    // 类型改成了不会延长到期的类型：把 renewal_period_years 清掉
    out.renewal_period_years = null
  }
  return out
}
