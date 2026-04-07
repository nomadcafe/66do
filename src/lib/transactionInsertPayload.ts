import type { TransactionInsert } from './supabaseService'

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
    exchange_rate: Number(transaction.exchange_rate) || 1,
    date: transaction.date as string,
    base_amount: transaction.base_amount != null ? Number(transaction.base_amount) : null,
    platform_fee: transaction.platform_fee != null ? Number(transaction.platform_fee) : null,
    platform_fee_percentage: transaction.platform_fee_percentage != null ? Number(transaction.platform_fee_percentage) : null,
    net_amount: transaction.net_amount != null ? Number(transaction.net_amount) : null,
    category: (transaction.category as string) || null,
    tax_deductible: Boolean(transaction.tax_deductible),
    receipt_url: (transaction.receipt_url as string) || null,
    notes: (transaction.notes as string) || null,
    payment_plan: (transaction.payment_plan as string) || null,
    installment_period: transaction.installment_period != null ? Number(transaction.installment_period) : null,
    downpayment_amount: transaction.downpayment_amount != null ? Number(transaction.downpayment_amount) : null,
    installment_amount: transaction.installment_amount != null ? Number(transaction.installment_amount) : null,
    final_payment_amount: transaction.final_payment_amount != null ? Number(transaction.final_payment_amount) : null,
    total_installment_amount: transaction.total_installment_amount != null ? Number(transaction.total_installment_amount) : null,
    paid_periods: transaction.paid_periods != null ? Number(transaction.paid_periods) : null,
    installment_status: (transaction.installment_status as string) || null,
    platform_fee_type: (transaction.platform_fee_type as string) || null,
    user_input_fee_rate: transaction.user_input_fee_rate != null ? Number(transaction.user_input_fee_rate) : null,
    user_input_surcharge_rate: transaction.user_input_surcharge_rate != null ? Number(transaction.user_input_surcharge_rate) : null,
    renewal_period_years:
      transaction.type === 'renew' && transaction.renewal_period_years != null
        ? Math.max(1, Math.min(10, Math.floor(Number(transaction.renewal_period_years))))
        : null
  }
}
