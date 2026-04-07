/**
 * 续费持有成本口径：
 * - 未设置 baseline_renewal_as_of：仅 renewal_count × renewal_cost（与历史行为一致，不叠加 renew 交易以免双算）。
 * - 已设置 baseline_renewal_as_of：档案估算 + 基线日及之后的 renew 交易金额（按自然日 date >= 基线日）。
 */

export type RenewalCostTx = {
  domain_id: string;
  type: string;
  date: string;
  amount: number;
};

export type DomainRenewalCostFields = {
  id: string;
  renewal_count?: number | null;
  renewal_cost?: number | null;
  baseline_renewal_as_of?: string | null;
};

export function archiveRenewalCost(domain: {
  renewal_count?: number | null;
  renewal_cost?: number | null;
}): number {
  return (domain.renewal_count ?? 0) * (Number(domain.renewal_cost) || 0);
}

export function incrementalRenewalFromTransactions(
  domainId: string,
  baselineDate: string | null | undefined,
  transactions: RenewalCostTx[]
): number {
  if (baselineDate == null || String(baselineDate).trim() === '') return 0;
  const b = String(baselineDate).slice(0, 10);
  let sum = 0;
  for (const t of transactions) {
    if (t.domain_id !== domainId || t.type !== 'renew') continue;
    const d = String(t.date).slice(0, 10);
    if (d.length < 10 || b.length < 10) continue;
    if (d >= b) sum += Number(t.amount) || 0;
  }
  return sum;
}

export function totalRenewalCostForHolding(
  domain: DomainRenewalCostFields,
  transactions: RenewalCostTx[]
): number {
  const archive = archiveRenewalCost(domain);
  if (domain.baseline_renewal_as_of) {
    return archive + incrementalRenewalFromTransactions(domain.id, domain.baseline_renewal_as_of, transactions);
  }
  return archive;
}

export function totalHoldingCostForDomain(
  domain: DomainRenewalCostFields & { purchase_cost?: number | null },
  transactions: RenewalCostTx[]
): number {
  return (Number(domain.purchase_cost) || 0) + totalRenewalCostForHolding(domain, transactions);
}
