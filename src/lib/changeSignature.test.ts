/**
 * 变更签名必须覆盖每一个可持久化字段。
 *
 * useDashboardData.saveData 只把「签名跟服务端那份不一样」的行发出去。签名里
 * 漏一个字段的后果不是报错，是**静默丢编辑**：用户只改了那个字段，签名没变，
 * 这一行被判定成"没动过"，压根不发请求。界面上一切正常，刷新才发现白改了。
 *
 * 实际漏过两个 —— escrow_holding_fee 和 installment_first_payment_date，
 * 都在分期配置面板里改得到。
 *
 * 手写枚举迟早会再漂一次，所以这里不只测那两个字段，而是拿
 * build*InsertPayload 的输出做对拍：那份 payload 是"哪些字段真的会落库"的
 * 唯一事实来源。以后往表里加列、往 payload 里加字段而忘了加签名，这条直接
 * 失败，而不是等用户报"我改的东西没保存"。
 */
import { describe, it, expect } from 'vitest';
import { domainChangeSignature, transactionChangeSignature } from './changeSignature';
import { buildTransactionInsertPayload } from './transactionInsertPayload';
import { buildDomainInsertPayload } from './domainPayloads';
import type { DomainWithTags } from '../types/dashboard';
import type { TransactionWithRequiredFields } from '../types/transaction';

/** id / user_id 由服务端和路径参数决定，不参与"用户改了什么"的比较。 */
const SERVER_OWNED = new Set(['user_id']);

const keysOf = (sig: string) => new Set(Object.keys(JSON.parse(sig)));

/**
 * 对拍用的"每个字段都有值"的交易。
 *
 * 必须填满：签名是 JSON.stringify 出来的，值为 undefined 的键会被整个丢掉
 * （`currency: transaction.currency` 没有 `|| null` 兜底，就是这种）。拿稀疏
 * 对象去比较，会把"签名里没写这个字段"和"这个字段恰好是 undefined"混为一谈。
 */
const fullTx = {
  id: 't1', domain_id: 'd1', type: 'sell', amount: 1000, currency: 'USD',
  date: '2026-01-01', platform_fee: 10, platform_fee_percentage: 1,
  net_amount: 990, notes: 'n', category: 'c', receipt_url: 'https://e.com/r',
  platform: 'Sedo', payment_plan: 'installment', installment_period: 12,
  downpayment_amount: 100, installment_amount: 75, final_payment_amount: 75,
  total_installment_amount: 900, installment_status: 'active',
  installment_first_payment_date: '2026-02-01', platform_fee_type: 'standard',
  user_input_fee_rate: 10, user_input_surcharge_rate: 1,
  afternic_ns_pointed: true, afternic_premium_addon: false,
  atom_commission_tier: 'a', atom_no_coin: false, atom_custom_commission_rate: 5,
  escrow_lease_type: 'x', escrow_transaction_fee: 3, escrow_holding_fee: 2,
  renewal_period_years: 1,
} as unknown as TransactionWithRequiredFields;

const fullDomain = {
  id: 'd1', domain_name: 'x.com', status: 'active', registrar: 'NC',
  purchase_date: '2025-01-01', purchase_cost: 100, renewal_cost: 12,
  renewal_cycle: 1, renewal_count: 2, baseline_renewal_as_of: '2025-01-01',
  registration_date: '2025-01-01', next_renewal_date: '2027-01-01',
  expiry_date: '2027-01-01', estimated_value: 5000, sale_date: '2026-01-01',
  sale_price: 9000, platform_fee: 900, tags: ['a'],
} as unknown as DomainWithTags;

describe('交易签名 vs 落库字段', () => {
  it('payload 里的每个字段都在签名里', () => {
    const persisted = Object.keys(buildTransactionInsertPayload(fullTx as never, 'u1'))
      .filter((k) => !SERVER_OWNED.has(k));
    const signed = keysOf(transactionChangeSignature(fullTx));
    const missing = persisted.filter((k) => !signed.has(k));
    expect(missing).toEqual([]);
  });

  it('只改 escrow_holding_fee 也能被检测到', () => {
    const base = { id: 't1', domain_id: 'd1', type: 'sell', amount: 1, date: '2026-01-01' } as unknown as TransactionWithRequiredFields;
    const edited = { ...base, escrow_holding_fee: 25 } as TransactionWithRequiredFields;
    expect(transactionChangeSignature(edited)).not.toBe(transactionChangeSignature(base));
  });

  it('只改 installment_first_payment_date 也能被检测到', () => {
    const base = { id: 't1', domain_id: 'd1', type: 'sell', amount: 1, date: '2026-01-01' } as unknown as TransactionWithRequiredFields;
    const edited = { ...base, installment_first_payment_date: '2026-06-01' } as TransactionWithRequiredFields;
    expect(transactionChangeSignature(edited)).not.toBe(transactionChangeSignature(base));
  });

  it('什么都没改时签名相同（否则每次保存都全量发）', () => {
    const tx = { id: 't1', domain_id: 'd1', type: 'sell', amount: 1, date: '2026-01-01', notes: 'x' } as unknown as TransactionWithRequiredFields;
    expect(transactionChangeSignature({ ...tx })).toBe(transactionChangeSignature(tx));
  });

  it('改了金额当然要检测到', () => {
    const base = { id: 't1', domain_id: 'd1', type: 'sell', amount: 1, date: '2026-01-01' } as unknown as TransactionWithRequiredFields;
    expect(transactionChangeSignature({ ...base, amount: 2 } as TransactionWithRequiredFields))
      .not.toBe(transactionChangeSignature(base));
  });
});

describe('域名签名 vs 落库字段', () => {
  it('payload 里的每个字段都在签名里', () => {
    const persisted = Object.keys(buildDomainInsertPayload(fullDomain as never, 'u1'))
      .filter((k) => !SERVER_OWNED.has(k));
    const signed = keysOf(domainChangeSignature(fullDomain));
    const missing = persisted.filter((k) => !signed.has(k));
    expect(missing).toEqual([]);
  });

  it('改了估值能检测到', () => {
    const base = { id: 'd1', domain_name: 'x.com', status: 'active', tags: [] } as unknown as DomainWithTags;
    expect(domainChangeSignature({ ...base, estimated_value: 5000 } as DomainWithTags))
      .not.toBe(domainChangeSignature(base));
  });

  it('改了标签能检测到', () => {
    const base = { id: 'd1', domain_name: 'x.com', status: 'active', tags: [] } as unknown as DomainWithTags;
    expect(domainChangeSignature({ ...base, tags: ['a'] } as DomainWithTags))
      .not.toBe(domainChangeSignature(base));
  });
});
