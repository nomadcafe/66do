import { DomainExpiryManager } from './domainExpiryManager';
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

/**
 * 对「本次保存中应生效的 renew 交易」依次应用到期延长与 renewal_count+1（与 DomainExpiryManager 一致）。
 * 跳过：已存在且类型仍为 renew 的同 id 交易（编辑续费金额/日期时不重复延长）；从其他类型改为 renew 的会应用一次。
 */
export function mergeRenewTransactionDomainUpdates(
  domains: DomainWithTags[],
  newTransactions: TransactionWithRequiredFields[],
  existingTransactions: TransactionWithRequiredFields[]
): DomainWithTags[] {
  const byId = new Map(domains.map((d) => [d.id, { ...d }]));
  const mgr = new DomainExpiryManager();

  for (const tx of newTransactions) {
    if (tx.type !== 'renew') continue;
    if (tx.extend_domain_expiry_on_renew === false) continue;

    const existingSameId = existingTransactions.find((t) => t.id === tx.id);
    // 新建 renew：无同 id。编辑 renew：同 id 且原为 renew → 不再延长到期（避免重复 +N 年）。
    // 编辑时从非 renew 改为 renew：同 id 但旧类型非 renew → 仍需应用一次延长。
    if (existingSameId && existingSameId.type === 'renew') continue;

    const cur = byId.get(tx.domain_id);
    if (!cur) continue;

    const years = tx.renewal_period_years ?? cur.renewal_cycle ?? 1;
    const renewed = mgr.handleDomainRenewal(toDomainForExpiry(cur), years);
    byId.set(cur.id, {
      ...cur,
      expiry_date: renewed.expiry_date ?? cur.expiry_date,
      renewal_count: renewed.renewal_count ?? cur.renewal_count,
      updated_at: new Date().toISOString(),
    });
  }

  return domains.map((d) => byId.get(d.id) ?? d);
}
