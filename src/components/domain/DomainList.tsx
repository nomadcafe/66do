'use client';

import { useMemo, memo, useEffect, useCallback, useState } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { Search, Filter, Grid, Plus, Table } from 'lucide-react';
import DomainCard from './DomainCard';
import DomainTable from './DomainTable';
import { ListPagination } from '../ui/ListPagination';
import { DomainWithTags } from '../../types/dashboard';
import type { TransactionWithRequiredFields } from '../../types/transaction';
import { useI18nContext } from '../../contexts/I18nProvider';
import { useDebouncedUrlParam } from '../../hooks/useDebouncedUrlParam';

interface DomainListProps {
  domains: DomainWithTags[];
  transactions?: TransactionWithRequiredFields[];
  onEdit: (domain: DomainWithTags) => void;
  onDelete: (id: string) => void;
  onView: (domain: DomainWithTags) => void;
  onAdd: () => void;
  onUpdateDomain?: (domain: DomainWithTags, patch: Partial<DomainWithTags>) => Promise<void> | void;
  // The set of domain ids that count as "stuck" (held >1y, not sold). Computed
  // upstream where we already have transactionsForMetrics in scope, so the
  // briefing card and this list filter agree by construction.
  stuckDomainIds?: Set<string>;
}

const DOMAINS_PAGE_SIZE = 24;

const DomainList = memo(function DomainList({ domains, transactions = [], onEdit, onDelete, onView, onAdd, onUpdateDomain, stuckDomainIds }: DomainListProps) {
  const { t } = useI18nContext();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // search / status / tag / view / page persisted in URL via dm* prefixed params (domain).
  // Defaults are omitted to keep URLs clean.
  const urlSearchTerm = searchParams.get('dmq') ?? '';
  const statusFilter = searchParams.get('dmstatus') ?? 'all';
  const tagFilter = searchParams.get('dmtag') ?? 'all';
  // Stuck filter is driven from the WeeklyBriefing "Worth a review" card so
  // clicking Review actually narrows the list to those domains instead of
  // dumping the user into the full table. Only meaningful when the parent
  // passed stuckDomainIds (i.e. when we're on the dashboard).
  const stuckFilter = searchParams.get('dmstuck') === '1';
  const viewMode: 'grid' | 'table' = searchParams.get('dmview') === 'grid' ? 'grid' : 'table';
  const pageRaw = Math.max(1, Number(searchParams.get('dmpage')) || 1);

  const updateParams = useCallback((updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v === null || v === '' || v === undefined) params.delete(k);
      else params.set(k, v);
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [searchParams, pathname, router]);

  // Input state is local + debounced to URL. Binding value={urlSearchTerm}
  // directly drops characters on fast typing because every keystroke does a
  // router.replace(). `searchTerm` is what we filter on -- updates instantly.
  const writeSearchParam = useCallback(
    (v: string | null) => updateParams({ dmq: v, dmpage: null }),
    [updateParams]
  );
  const [searchTerm, setSearchTerm] = useDebouncedUrlParam(urlSearchTerm, writeSearchParam);

  const setStatusFilter = (s: string) => updateParams({ dmstatus: s === 'all' ? null : s, dmpage: null });
  const setTagFilter = (s: string) => updateParams({ dmtag: s === 'all' ? null : s, dmpage: null });
  const setViewMode = (m: 'grid' | 'table') => updateParams({ dmview: m === 'table' ? null : m });
  const setPage = (n: number) => updateParams({ dmpage: n <= 1 ? null : String(n) });
  const clearStuckFilter = () => updateParams({ dmstuck: null, dmpage: null });

  // Force card (grid) view on mobile — wide table is unusable on phone.
  // Track viewport so the effective render mode flips at lg breakpoint regardless of URL.
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 1023px)');
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  const effectiveView: 'grid' | 'table' = isMobile ? 'grid' : viewMode;

  const allTags = useMemo(() =>
    [...new Set(domains.flatMap(d => d.tags))].sort(),
  [domains]);

  // dmstuck=1 only does something when the parent supplied stuckDomainIds.
  // If absent (e.g. a future caller forgets to pass it), fall back to no-op
  // rather than silently filtering everything to empty.
  const stuckFilterActive = stuckFilter && !!stuckDomainIds;

  const filteredDomains = useMemo(() => domains.filter(domain => {
    const tagsArray = domain.tags;
    const matchesSearch = domain.domain_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (domain.registrar || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         tagsArray.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || domain.status === statusFilter;
    const matchesTag = tagFilter === 'all' || tagsArray.includes(tagFilter);
    const matchesStuck = !stuckFilterActive || stuckDomainIds!.has(domain.id);
    return matchesSearch && matchesStatus && matchesTag && matchesStuck;
  }), [domains, searchTerm, statusFilter, tagFilter, stuckFilterActive, stuckDomainIds]);

  const totalPages = Math.max(1, Math.ceil(filteredDomains.length / DOMAINS_PAGE_SIZE));
  const page = Math.min(pageRaw, totalPages);

  // Normalize stale page values from shared links (URL > available pages).
  useEffect(() => {
    if (pageRaw > totalPages) updateParams({ dmpage: null });
  }, [pageRaw, totalPages, updateParams]);

  const paginatedDomains = useMemo(() => {
    const start = (page - 1) * DOMAINS_PAGE_SIZE;
    return filteredDomains.slice(start, start + DOMAINS_PAGE_SIZE);
  }, [filteredDomains, page]);

  const paginationRangeSummary =
    filteredDomains.length > DOMAINS_PAGE_SIZE
      ? t('common.paginationRange')
          .replace('{start}', String((page - 1) * DOMAINS_PAGE_SIZE + 1))
          .replace(
            '{end}',
            String(Math.min(page * DOMAINS_PAGE_SIZE, filteredDomains.length))
          )
          .replace('{total}', String(filteredDomains.length))
      : undefined;

  const statusOptions = [
    { value: 'all', labelKey: 'domainList.allStatus' as const },
    { value: 'active', labelKey: 'common.active' as const },
    { value: 'for_sale', labelKey: 'common.forSale' as const },
    { value: 'sold', labelKey: 'common.sold' as const },
    { value: 'expired', labelKey: 'common.expired' as const }
  ];

  // Per-status counts for the chip strip — drives the filter UI directly so the
  // user can scan portfolio composition + filter in one gesture (replaces the
  // previous dropdown select that hid both the counts and the saturation).
  const statusCounts = useMemo(() => {
    let active = 0, forSale = 0, sold = 0, expired = 0;
    for (const d of domains) {
      if (d.status === 'active') active++;
      else if (d.status === 'for_sale') forSale++;
      else if (d.status === 'sold') sold++;
      else if (d.status === 'expired') expired++;
    }
    return { all: domains.length, active, for_sale: forSale, sold, expired };
  }, [domains]);

  // Chip palette — keep saturation tied to status semantics:
  // - active = teal (positive ongoing), for_sale = amber (action / attention),
  // - sold = emerald (success / done), expired = rose (loss / alert),
  // - all = stone (neutral).
  const chipPalette: Record<string, { active: string; idle: string }> = {
    all: {
      active: 'bg-stone-900 text-white border-stone-900',
      idle: 'bg-white text-stone-700 border-stone-200 hover:border-stone-300',
    },
    active: {
      active: 'bg-teal-600 text-white border-teal-600',
      idle: 'bg-teal-50 text-teal-700 border-teal-100 hover:border-teal-200',
    },
    for_sale: {
      active: 'bg-amber-500 text-white border-amber-500',
      idle: 'bg-amber-50 text-amber-700 border-amber-100 hover:border-amber-200',
    },
    sold: {
      active: 'bg-emerald-600 text-white border-emerald-600',
      idle: 'bg-emerald-50 text-emerald-700 border-emerald-100 hover:border-emerald-200',
    },
    expired: {
      active: 'bg-rose-500 text-white border-rose-500',
      idle: 'bg-rose-50 text-rose-700 border-rose-100 hover:border-rose-200',
    },
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-stone-900">{t('domainList.title')}</h2>
        <p className="text-sm text-stone-500 mt-0.5">{t('domainList.subtitle')}</p>
      </div>

      {/* "Stuck" filter banner — visible only when the WeeklyBriefing
          "Worth a review" card drove the user here with ?dmstuck=1. Spelled
          out so it's obvious *why* the list is suddenly short, and gives a
          one-tap way back to the full list. */}
      {stuckFilterActive && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50/70 px-3.5 py-2 text-sm text-amber-900">
          <span>{t('domainList.stuckFilterBanner')}</span>
          <button
            type="button"
            onClick={clearStuckFilter}
            className="rounded-md px-2 py-1 text-xs font-medium text-amber-900 underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
          >
            {t('domainList.clearFilters')}
          </button>
        </div>
      )}

      {/* Status chip strip — primary filter, replaces the old dropdown.
          Each chip shows count and is colored by status semantics; brings
          saturated color onto the homepage and surfaces composition at a glance. */}
      <div
        role="tablist"
        aria-label={t('domainList.allStatus')}
        className="flex flex-wrap items-center gap-2"
      >
        {statusOptions.map((option) => {
          const isActive = statusFilter === option.value;
          const palette = chipPalette[option.value] ?? chipPalette.all;
          const count = statusCounts[option.value as keyof typeof statusCounts] ?? 0;
          const showCount = option.value === 'all' || count > 0;
          return (
            <button
              key={option.value}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setStatusFilter(option.value)}
              className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-1 ${
                isActive ? palette.active : palette.idle
              }`}
            >
              <span>{t(option.labelKey)}</span>
              {showCount && (
                <span
                  className={`tabular-nums text-xs ${
                    isActive ? 'opacity-90' : 'opacity-70'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
            <input
              type="search"
              aria-label={t('domainList.searchPlaceholder')}
              placeholder={t('domainList.searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          {allTags.length > 0 && (
            <>
              <Filter className="h-4 w-4 text-stone-400" />
              <select
                value={tagFilter}
                onChange={(e) => setTagFilter(e.target.value)}
                aria-label={t('domainList.allTags')}
                className="px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="all">{t('domainList.allTags')}</option>
                {allTags.map((tag) => (
                  <option key={tag} value={tag}>
                    {tag}
                  </option>
                ))}
              </select>
            </>
          )}
          {/* Toggle hidden on mobile — cards are always used there */}
          <div className="hidden lg:flex items-center border border-stone-200 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              aria-pressed={viewMode === 'table'}
              className={`p-2.5 ${viewMode === 'table' ? 'bg-stone-900 text-white' : 'text-stone-500 hover:bg-stone-100'} focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-inset`}
              title={t('domainList.tableView')}
            >
              <Table className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              aria-pressed={viewMode === 'grid'}
              className={`p-2.5 ${viewMode === 'grid' ? 'bg-stone-900 text-white' : 'text-stone-500 hover:bg-stone-100'} focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-inset`}
              title={t('domainList.gridView')}
            >
              <Grid className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <p className="text-sm text-stone-500">
        {t('domainList.showingCount').replace('{filtered}', String(filteredDomains.length)).replace('{total}', String(domains.length))}
      </p>

      {filteredDomains.length === 0 ? (
        <div className="text-center py-14 bg-white rounded-2xl border border-stone-200/80 shadow-sm">
          <Search className="h-10 w-10 mx-auto text-stone-300 mb-4" />
          <h3 className="text-base font-semibold text-stone-900 mb-2">
            {searchTerm || statusFilter !== 'all' || tagFilter !== 'all' || stuckFilterActive ? t('domainList.noDomainsFound') : t('domainList.noDomainsYet')}
          </h3>
          <p className="text-sm text-stone-500 mb-5 max-w-sm mx-auto">
            {searchTerm || statusFilter !== 'all' || tagFilter !== 'all' || stuckFilterActive ? t('domainList.adjustSearch') : t('domainList.getStarted')}
          </p>
          {!searchTerm && statusFilter === 'all' && tagFilter === 'all' && !stuckFilterActive ? (
            <button onClick={onAdd} className="inline-flex items-center px-4 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-medium hover:bg-teal-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2">
              <Plus className="h-4 w-4 mr-2" />
              {t('domainList.addFirstDomain')}
            </button>
          ) : (
            <button
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('all');
                setTagFilter('all');
                if (stuckFilterActive) clearStuckFilter();
              }}
              className="inline-flex items-center px-4 py-2.5 border border-stone-300 bg-white text-stone-700 rounded-xl text-sm font-medium hover:bg-stone-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
            >
              {t('domainList.clearFilters')}
            </button>
          )}
        </div>
      ) : effectiveView === 'table' ? (
        <DomainTable
          domains={filteredDomains}
          transactions={transactions}
          onEdit={onEdit}
          onDelete={onDelete}
          onView={onView}
          onUpdateDomain={onUpdateDomain}
        />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {paginatedDomains.map((domain) => (
              <DomainCard
                key={domain.id}
                domain={domain}
                transactions={transactions}
                onEdit={onEdit}
                onDelete={onDelete}
                onView={onView}
              />
            ))}
          </div>
          <ListPagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={setPage}
            rangeSummary={paginationRangeSummary}
          />
        </>
      )}
    </div>
  );
});

export default DomainList;
