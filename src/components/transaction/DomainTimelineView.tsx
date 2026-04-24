'use client';

import { useMemo, useState, useEffect } from 'react';
import {
  ShoppingBag,
  RefreshCw,
  TrendingUp,
  CircleDot,
  ChevronRight,
} from 'lucide-react';
import { useI18nContext } from '../../contexts/I18nProvider';
import type { DomainWithTags } from '../../types/dashboard';
import type { TransactionWithRequiredFields } from '../../types/transaction';
import {
  buildDomainTimelineEvents,
  type DomainTimelineEvent,
  type DomainTimelineKind,
} from '../../lib/domainTimeline';

interface DomainTimelineViewProps {
  domains: DomainWithTags[];
  transactions: TransactionWithRequiredFields[];
  onEditTransaction: (transaction: TransactionWithRequiredFields) => void;
  domainSearch: string;
}

function kindIcon(kind: DomainTimelineKind) {
  switch (kind) {
    case 'purchase':
      return ShoppingBag;
    case 'renew':
      return RefreshCw;
    case 'sell':
      return TrendingUp;
    default:
      return CircleDot;
  }
}

// 与 TransactionList 的 getTypeColor 对齐 3 段语义色：
//   sell (入账)            → emerald
//   purchase / renew (主支出) → stone
//   other (杂项支出)       → amber
// 旧实现用 rose/sky 是孤立色（项目其他地方都没用）且与 list 不一致 ——
// 同一笔续费在 list 是 stone、在 timeline 是 sky，跨视图认不出。
function kindBadgeClass(kind: DomainTimelineKind): string {
  switch (kind) {
    case 'sell':
      return 'bg-emerald-100 text-emerald-700 ring-emerald-200/80';
    case 'purchase':
    case 'renew':
      return 'bg-stone-100 text-stone-700 ring-stone-200/80';
    default:
      return 'bg-amber-50 text-amber-700 ring-amber-200/80';
  }
}

export default function DomainTimelineView({
  domains,
  transactions,
  onEditTransaction,
  domainSearch,
}: DomainTimelineViewProps) {
  const { t, locale } = useI18nContext();
  const localeTag = locale === 'zh' ? 'zh-CN' : 'en-US';

  const filteredDomains = useMemo(() => {
    const q = domainSearch.trim().toLowerCase();
    if (!q) return domains;
    return domains.filter((d) => d.domain_name.toLowerCase().includes(q));
  }, [domains, domainSearch]);

  const [selectedId, setSelectedId] = useState('');

  useEffect(() => {
    if (filteredDomains.length === 0) {
      setSelectedId('');
      return;
    }
    if (!selectedId || !filteredDomains.some((d) => d.id === selectedId)) {
      setSelectedId(filteredDomains[0].id);
    }
  }, [filteredDomains, selectedId]);

  const selectedDomain = filteredDomains.find((d) => d.id === selectedId) ?? null;

  const events: DomainTimelineEvent[] = useMemo(() => {
    if (!selectedDomain) return [];
    return buildDomainTimelineEvents(selectedDomain, transactions);
  }, [selectedDomain, transactions]);

  const formatMoney = (amount: number | null, currency: string) => {
    if (amount == null || Number.isNaN(amount)) return '—';
    return new Intl.NumberFormat(localeTag, {
      style: 'currency',
      currency: currency || 'USD',
    }).format(amount);
  };

  const formatDate = (d: string) => {
    try {
      return new Date(d).toLocaleDateString(localeTag);
    } catch {
      return d;
    }
  };

  const labelForEvent = (ev: DomainTimelineEvent) => {
    if (ev.kind === 'other' && ev.transaction) {
      const ty = ev.transaction.type;
      const keys: Record<string, string> = {
        transfer: 'transaction.transfer',
        fee: 'transaction.fee',
        marketing: 'transaction.marketing',
        advertising: 'transaction.advertising',
      };
      const k = keys[ty];
      return k ? t(k) : t('timeline.other');
    }
    switch (ev.kind) {
      case 'purchase':
        return t('timeline.purchase');
      case 'renew':
        return t('timeline.renew');
      case 'sell':
        return t('timeline.sell');
      default:
        return t('timeline.other');
    }
  };

  if (domains.length === 0) {
    return (
      <div className="text-center py-14 bg-white rounded-2xl border border-stone-200/80 shadow-sm">
        <p className="text-sm text-stone-500">{t('timeline.noDomains')}</p>
      </div>
    );
  }

  if (filteredDomains.length === 0) {
    return (
      <div className="text-center py-14 bg-white rounded-2xl border border-stone-200/80 shadow-sm">
        <p className="text-sm text-stone-500">{t('timeline.noDomainMatch')}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className="lg:col-span-4 space-y-2">
        <p className="text-xs font-medium uppercase tracking-wider text-stone-500 px-1">
          {t('timeline.selectDomain')}
        </p>
        <div className="bg-white rounded-2xl border border-stone-200/80 shadow-sm max-h-[min(420px,50vh)] overflow-y-auto">
          <ul className="divide-y divide-stone-100">
            {filteredDomains.map((d) => {
              const active = d.id === selectedId;
              return (
                <li key={d.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(d.id)}
                    className={`w-full text-left px-4 py-3 flex items-center gap-2 text-sm transition ${
                      active
                        ? 'bg-teal-50 text-teal-900 font-medium'
                        : 'text-stone-700 hover:bg-stone-50'
                    }`}
                  >
                    <span className="truncate flex-1">{d.domain_name}</span>
                    <ChevronRight
                      className={`h-4 w-4 shrink-0 ${active ? 'text-teal-600' : 'text-stone-300'}`}
                    />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <div className="lg:col-span-8">
        {selectedDomain && (
          <h3 className="mb-4 text-lg font-semibold text-stone-900">{selectedDomain.domain_name}</h3>
        )}

        {events.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-stone-200 bg-stone-50/80 px-6 py-12 text-center">
            <p className="text-sm text-stone-600">{t('timeline.noEvents')}</p>
          </div>
        ) : (
          <div className="relative pl-2">
            <div
              className="absolute left-[19px] top-3 bottom-3 w-px bg-stone-200"
              aria-hidden
            />
            <ul className="space-y-0">
              {events.map((ev, index) => {
                const Icon = kindIcon(ev.kind);
                const isLast = index === events.length - 1;
                const clickable = ev.transaction != null;
                const Row = (
                  <div
                    className={`flex gap-4 pb-8 ${isLast ? 'pb-2' : ''} ${
                      clickable ? 'cursor-pointer group' : ''
                    }`}
                    onClick={() => {
                      if (ev.transaction) onEditTransaction(ev.transaction);
                    }}
                    onKeyDown={(e) => {
                      if (!clickable) return;
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onEditTransaction(ev.transaction!);
                      }
                    }}
                    role={clickable ? 'button' : undefined}
                    tabIndex={clickable ? 0 : undefined}
                  >
                    <div
                      className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ring-2 ring-white shadow-sm ${kindBadgeClass(ev.kind)}`}
                    >
                      <Icon className="h-4 w-4" aria-hidden />
                    </div>
                    <div className="min-w-0 flex-1 pt-0.5">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                        <span
                          className={`text-sm font-semibold text-stone-900 ${clickable ? 'group-hover:text-teal-700' : ''}`}
                        >
                          {labelForEvent(ev)}
                        </span>
                        <span className="text-xs text-stone-500">{formatDate(ev.date)}</span>
                      </div>
                      <p className="text-base font-medium text-stone-800 mt-1">
                        {formatMoney(ev.amount, ev.currency)}
                      </p>
                      {!ev.transaction && ev.kind === 'purchase' && (
                        <p className="text-xs text-stone-500 mt-1">{t('timeline.virtualPurchaseHint')}</p>
                      )}
                      {ev.transaction?.notes && (
                        <p className="text-xs text-stone-500 mt-1 line-clamp-2">{ev.transaction.notes}</p>
                      )}
                      {clickable && (
                        <p className="text-xs text-teal-600 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          {t('timeline.openTransaction')} →
                        </p>
                      )}
                    </div>
                  </div>
                );
                return <li key={ev.id}>{Row}</li>;
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
