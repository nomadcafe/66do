import type { DomainWithTags } from '../types/dashboard';
import type { TransactionWithRequiredFields } from '../types/transaction';

export type DomainTimelineKind = 'purchase' | 'renew' | 'sell' | 'other';

export interface DomainTimelineEvent {
  id: string;
  kind: DomainTimelineKind;
  date: string;
  transaction: TransactionWithRequiredFields | null;
  amount: number | null;
  currency: string;
}

const KIND_RANK: Record<DomainTimelineKind, number> = {
  purchase: 0,
  renew: 1,
  sell: 2,
  other: 3,
};

/**
 * 按域名聚合：购入（买入交易或域名档案上的购入日）→ 续费 / 出售 / 其他交易，按日期排序。
 */
export function buildDomainTimelineEvents(
  domain: DomainWithTags,
  transactions: TransactionWithRequiredFields[]
): DomainTimelineEvent[] {
  const txs = transactions
    .filter((t) => t.domain_id === domain.id)
    .sort((a, b) => a.date.localeCompare(b.date));

  const events: DomainTimelineEvent[] = [];

  const buyTxs = txs.filter((t) => t.type === 'buy');
  if (buyTxs.length > 0) {
    for (const t of buyTxs) {
      events.push({
        id: t.id,
        kind: 'purchase',
        date: t.date,
        transaction: t,
        amount: t.amount,
        currency: t.currency,
      });
    }
  } else if (domain.purchase_date && String(domain.purchase_date).trim()) {
    events.push({
      id: `virtual-purchase-${domain.id}`,
      kind: 'purchase',
      date: domain.purchase_date,
      transaction: null,
      amount: domain.purchase_cost ?? null,
      currency: 'USD',
    });
  }

  for (const t of txs.filter((x) => x.type === 'renew')) {
    events.push({
      id: t.id,
      kind: 'renew',
      date: t.date,
      transaction: t,
      amount: t.amount,
      currency: t.currency,
    });
  }

  for (const t of txs.filter((x) => x.type === 'sell')) {
    events.push({
      id: t.id,
      kind: 'sell',
      date: t.date,
      transaction: t,
      amount: t.amount,
      currency: t.currency,
    });
  }

  for (const t of txs.filter(
    (x) => x.type !== 'buy' && x.type !== 'renew' && x.type !== 'sell'
  )) {
    events.push({
      id: t.id,
      kind: 'other',
      date: t.date,
      transaction: t,
      amount: t.amount,
      currency: t.currency,
    });
  }

  events.sort((a, b) => {
    const byDate = a.date.localeCompare(b.date);
    if (byDate !== 0) return byDate;
    return KIND_RANK[a.kind] - KIND_RANK[b.kind];
  });

  return events;
}
