/**
 * 保存前的变更检测签名。
 *
 * useDashboardData.saveData 只把「签名跟服务端那份不一样」的行发出去。所以
 * 签名里漏掉一个可持久化字段的后果是：用户**只**改了那个字段时，签名没变，
 * 这一行被判定为"没动过"，整笔编辑静默丢失——不报错、不提示，重新加载才发现
 * 白改了。
 *
 * 实际漏过两个：escrow_holding_fee 和 installment_first_payment_date，两个都
 * 在分期配置面板里改得到。只调这两项之一保存，改动直接消失。
 *
 * 抽到这里而不是留在 hook 里，是为了能被测试直接拿来跟 build*InsertPayload
 * 的字段集对拍（见 changeSignature.test.ts）——那份 payload 是"哪些字段真的
 * 会落库"的唯一事实来源，两边对不上就让 CI 失败，而不是等用户发现编辑没保存。
 */

import type { DomainWithTags } from '../types/dashboard';
import type { TransactionWithRequiredFields } from '../types/transaction';

export const domainChangeSignature = (domain: DomainWithTags) => JSON.stringify({
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
export const transactionChangeSignature = (transaction: TransactionWithRequiredFields) => JSON.stringify({
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
  // 这两个是漏掉的：都在分期配置面板里改得到，只改它们之一时签名不变，
  // 整笔编辑被当成"没动过"静默丢弃。
  escrow_holding_fee: transaction.escrow_holding_fee ?? null,
  installment_first_payment_date: transaction.installment_first_payment_date || null,
  extend_domain_expiry_on_renew: transaction.extend_domain_expiry_on_renew ?? null,
  renewal_years_use_custom: transaction.renewal_years_use_custom ?? null,
});
