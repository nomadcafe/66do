import type { InstallmentReceiptInsert, InstallmentReceiptUpdate } from './supabaseService'

/** 允许客户端写入的字段。其余（id / user_id / created_at…）由服务端决定。 */
function normalizeAmount(value: unknown): number {
  return Number(value)
}

function normalizePeriodNo(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = Math.floor(Number(value))
  return Number.isFinite(n) ? n : null
}

function normalizeNotes(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

/**
 * installment_receipts 的 Insert payload。user_id 一律取服务端认证出来的值，
 * 不信客户端传的——否则就能替别人写行（RLS 会拦，但不该指望它当第一道）。
 */
export function buildInstallmentReceiptInsertPayload(
  receipt: Record<string, unknown>,
  userId: string
): InstallmentReceiptInsert {
  return {
    transaction_id: receipt.transaction_id as string,
    user_id: userId,
    received_date: receipt.received_date as string,
    amount: normalizeAmount(receipt.amount),
    period_no: normalizePeriodNo(receipt.period_no),
    notes: normalizeNotes(receipt.notes),
  }
}

/**
 * Update payload。刻意不含 transaction_id —— 收款是挂在某笔交易下的，改归属
 * 等于凭空搬账，要换就删了重建。也不含 user_id（路径参数 + RLS 守住）。
 */
export function buildInstallmentReceiptUpdatePayload(
  receipt: Record<string, unknown>
): InstallmentReceiptUpdate {
  const out: InstallmentReceiptUpdate = {}
  if ('received_date' in receipt) out.received_date = receipt.received_date as string
  if ('amount' in receipt) out.amount = normalizeAmount(receipt.amount)
  if ('period_no' in receipt) out.period_no = normalizePeriodNo(receipt.period_no)
  if ('notes' in receipt) out.notes = normalizeNotes(receipt.notes)
  return out
}
