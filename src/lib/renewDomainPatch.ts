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
 * 对「本次保存中新建的 renew 交易」依次应用到期延长与 renewal_count+1（与 DomainExpiryManager 一致）。
 */
export function mergeRenewTransactionDomainUpdates(
  domains: DomainWithTags[],
  newTransactions: TransactionWithRequiredFields[],
  existingTransactions: TransactionWithRequiredFields[]
): DomainWithTags[] {
  const byId = new Map(domains.map((d) => [d.id, { ...d }]));
  const mgr = new DomainExpiryManager();

  for (const tx of newTransactions) {
    if (existingTransactions.some((t) => t.id === tx.id)) continue;
    if (tx.type !== 'renew') continue;
    if (tx.extend_domain_expiry_on_renew === false) continue;

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
