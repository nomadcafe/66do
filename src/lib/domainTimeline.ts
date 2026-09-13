import type { DomainWithTags } from '../types/dashboard';
import type { TransactionWithRequiredFields } from '../types/transaction';
import { expandRenewalEvents } from './expandRenewalEvents';
import { localCalendarDateISO } from './localCalendarDate';

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
 *
 * 续费包含两类，和成本基准同源：
 *   - renew 交易：有金额有备注，可点进去编辑；
 *   - 档案续费：renewal_count 减去已有 renew 交易条数的那部分，日期从到期日
 *     倒推。CSV 导入的域名通常只填了 renewal_count + renewal_cost，一条 renew
 *     交易都没有——只列交易的话，这条时间线上"购入 → 出售"中间一片空白，而
 *     这些续费明明进了持有成本。购入那一档早就有同样的虚拟事件兜底
 *     （没有 buy 交易时用档案上的购入日 / 成本），续费这边只是一直没补上。
 *
 * 去重由 expandRenewalEvents 内部保证（archiveCount = renewal_count − 已知
 * 交易条数），所以两类加起来不会把同一次续费算两遍。projected（还没发生的
 * 预估续费）不进时间线——这是一条历史轨迹，不是预测。
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

  // 档案续费（没有对应 renew 交易的那些）→ 虚拟事件
  const archiveRenewals = expandRenewalEvents(domain, transactions).filter(
    (e) => e.source === 'archive'
  );
  archiveRenewals.forEach((e, i) => {
    const iso = localCalendarDateISO(e.date);
    events.push({
      id: `virtual-renew-${domain.id}-${iso}-${i}`,
      kind: 'renew',
      date: iso,
      transaction: null,
      amount: e.amount,
      currency: 'USD',
    });
  });

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
