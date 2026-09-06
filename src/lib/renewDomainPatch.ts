import { handleDomainRenewal } from './domainExpiryManager';
import type { Domain } from '../types/domain';
import type { DomainWithTags } from '../types/dashboard';
import type { TransactionWithRequiredFields } from '../types/transaction';

function toDomainForExpiry(d: DomainWithTags): Domain {
  return {
    id: d.id,
    domain_name: d.domain_name,
    registrar: d.registrar ?? '',
    purchase_date: d.purchase_date ?? '',
    purchase_cost: d.purchase_cost ?? 0,
    renewal_cost: d.renewal_cost ?? 0,
    renewal_cycle: d.renewal_cycle ?? 1,
    renewal_count: d.renewal_count ?? 0,
    expiry_date: d.expiry_date ?? undefined,
    status: d.status as Domain['status'],
    estimated_value: d.estimated_value ?? 0,
    sale_date: d.sale_date ?? undefined,
    sale_price: d.sale_price ?? undefined,
    platform_fee: d.platform_fee ?? undefined,
    tags: d.tags,
    created_at: d.created_at ?? undefined,
    updated_at: d.updated_at ?? undefined,
    next_renewal_date: d.next_renewal_date ?? undefined,
  };
}

/** 会延长到期日的交易类型。renew 之外，transfer 也可以：注册商转入通常自带
 *  +1 年，但不是必然（同注册商内部转移、push 就没有），所以 transfer 只在用户
 *  显式填了 renewal_period_years 时才延长。 */
const EXPIRY_EXTENDING_TYPES = new Set<TransactionWithRequiredFields['type']>(['renew', 'transfer']);

/** 这笔交易应给到期日加几年。renew 缺省回落到域名续费周期；transfer 缺省为 0（不延长）。 */
export function expiryExtensionYears(
  tx: Pick<TransactionWithRequiredFields, 'type' | 'renewal_period_years'>,
  domainRenewalCycle?: number | null
): number {
  if (!EXPIRY_EXTENDING_TYPES.has(tx.type)) return 0;
  if (tx.type === 'transfer') {
    const y = Math.floor(Number(tx.renewal_period_years) || 0);
    return y > 0 ? y : 0;
  }
  return Math.max(1, Math.floor(Number(tx.renewal_period_years) || domainRenewalCycle || 1));
}

/**
 * 对「本次保存中应生效的 renew / transfer 交易」依次应用到期延长。
 * - renew：延长 renewal_period_years（缺省 renewal_cycle）年，并 renewal_count+1。
 * - transfer：仅当填了 renewal_period_years > 0 时延长同样年数，但**不动
 *   renewal_count** —— 那个字段是「续费次数」，同时也是档案续费成本
 *   （renewal_count × renewal_cost）的乘数，转移一次就 +1 会凭空多算一笔续费。
 * 跳过：已存在且类型未变的同 id 交易（编辑金额/日期时不重复延长）；改变了类型的会应用一次。
 */
export function mergeRenewTransactionDomainUpdates(
  domains: DomainWithTags[],
  newTransactions: TransactionWithRequiredFields[],
  existingTransactions: TransactionWithRequiredFields[]
): DomainWithTags[] {
  const byId = new Map(domains.map((d) => [d.id, { ...d }]));

  for (const tx of newTransactions) {
    if (!EXPIRY_EXTENDING_TYPES.has(tx.type)) continue;
    if (tx.extend_domain_expiry_on_renew === false) continue;

    const existingSameId = existingTransactions.find((t) => t.id === tx.id);
    // 新建：无同 id。编辑且类型未变 → 不再延长到期（避免重复 +N 年）。
    // 编辑时类型变了（如 fee → renew、renew → transfer）：仍需应用一次延长。
    if (existingSameId && existingSameId.type === tx.type) continue;

    const cur = byId.get(tx.domain_id);
    if (!cur) continue;

    const years = expiryExtensionYears(tx, cur.renewal_cycle);
    if (years <= 0) continue;

    const renewed = handleDomainRenewal(toDomainForExpiry(cur), years);
    byId.set(cur.id, {
      ...cur,
      expiry_date: renewed.expiry_date ?? cur.expiry_date,
      // handleDomainRenewal 会把 next_renewal_date 清掉（续费后 expiry_date 才是
      // 权威值）。这里必须跟着传，否则那个陈旧日期原封不动留在库里。
      next_renewal_date: renewed.next_renewal_date ?? null,
      // transfer 不是续费，不计入 renewal_count（见上方注释）
      renewal_count: tx.type === 'renew' ? renewed.renewal_count ?? cur.renewal_count : cur.renewal_count,
      updated_at: new Date().toISOString(),
    });
  }

  return domains.map((d) => byId.get(d.id) ?? d);
}
