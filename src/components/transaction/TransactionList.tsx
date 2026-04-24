'use client';

import { useState, useMemo, memo, useCallback, useEffect } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { Search, Filter, Plus, Edit, Trash2, Calendar, FileText, LayoutList, GitBranch, ArrowUp, ArrowDown } from 'lucide-react';
import { sellGrossUSD, sellNetUSD } from '../../lib/coreCalculations';
import { calculateDomainROI, formatPercentage } from '../../lib/enhancedFinancialMetrics';
import { useI18nContext } from '../../contexts/I18nProvider';
import { DomainWithTags, TransactionWithRequiredFields } from '../../types/dashboard';
import DomainTimelineView from './DomainTimelineView';
import { ListPagination } from '../ui/ListPagination';
import { useDebouncedUrlParam } from '../../hooks/useDebouncedUrlParam';

interface TransactionListProps {
  transactions: TransactionWithRequiredFields[];
  /**
   * Optional installment-adjusted view of transactions for KPI summing
   * (sells with partial / cancelled installments are scaled to actual cash received,
   * platform fees scaled proportionally). Same shape and ids as `transactions`;
   * if omitted, the KPI strip falls back to raw values.
   */
  metricsTransactions?: TransactionWithRequiredFields[];
  domains: DomainWithTags[];
  onEdit: (transaction: TransactionWithRequiredFields) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
}

const TRANSACTIONS_PAGE_SIZE = 30;

const TransactionList = memo(function TransactionList({
  transactions,
  metricsTransactions,
  domains,
  onEdit,
  onDelete,
  onAdd 
}: TransactionListProps) {
  const { t, locale } = useI18nContext();
  const localeTag = locale === 'zh' ? 'zh-CN' : 'en-US';
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // viewMode stays in component state (ephemeral pref, not worth persisting in URL)
  const [viewMode, setViewMode] = useState<'list' | 'timeline'>('list');

  // search/type/sort/page derived from URL (namespaced as tx* to avoid colliding with other components)
  type SortField = 'date' | 'amount' | 'type';
  type SortDir = 'asc' | 'desc';
  const urlSearchTerm = searchParams.get('txq') ?? '';
  const typeFilter = searchParams.get('txtype') ?? 'all';
  const sortField: SortField = ((): SortField => {
    const raw = searchParams.get('txsort');
    return raw === 'amount' || raw === 'type' ? raw : 'date';
  })();
  const sortDir: SortDir = searchParams.get('txdir') === 'asc' ? 'asc' : 'desc';
  const pageRaw = Math.max(1, Number(searchParams.get('txpage')) || 1);

  const updateParams = useCallback((updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v === null || v === '' || v === undefined) params.delete(k);
      else params.set(k, v);
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [searchParams, pathname, router]);

  // Input state is local + debounced to URL. See DomainList for details --
  // binding value= directly to a URL param drops keystrokes on fast typing.
  const writeSearchParam = useCallback(
    (v: string | null) => updateParams({ txq: v, txpage: null }),
    [updateParams]
  );
  const [searchTerm, setSearchTerm] = useDebouncedUrlParam(urlSearchTerm, writeSearchParam);

  const setTypeFilter = (s: string) => updateParams({ txtype: s === 'all' ? null : s, txpage: null });
  const setPage = (n: number) => updateParams({ txpage: n <= 1 ? null : String(n) });

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      const nextDir: SortDir = sortDir === 'asc' ? 'desc' : 'asc';
      // 'date desc' is the implicit default — omit when matching to keep URL clean
      const dirParam = field === 'date' && nextDir === 'desc' ? null : nextDir;
      updateParams({ txdir: dirParam, txpage: null });
    } else {
      const defaultDir: SortDir = field === 'date' ? 'desc' : 'asc';
      updateParams({
        txsort: field === 'date' ? null : field,
        txdir: field === 'date' && defaultDir === 'desc' ? null : defaultDir,
        txpage: null,
      });
    }
  };

  // 按"金钱方向"3 段着色：入账绿、主支出中性 stone、杂项支出 amber。
  // 旧实现给 7 个 type 各分一种孤立色（红/绿/蓝/黄/灰/紫/粉），其中 buy
  // 用红色像"危险"，但买入只是常规支出，配色没有信息量反而误导。
  const getTypeColor = (type: string) => {
    switch (type) {
      case 'sell':
        return 'bg-emerald-100 text-emerald-700';
      case 'buy':
      case 'renew':
        return 'bg-stone-100 text-stone-700';
      case 'transfer':
      case 'fee':
      case 'marketing':
      case 'advertising':
        return 'bg-amber-50 text-amber-700';
      default:
        return 'bg-stone-100 text-stone-700';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'buy': return t('transaction.buy');
      case 'sell': return t('transaction.sell');
      case 'renew': return t('transaction.renew');
      case 'transfer': return t('transaction.transfer');
      case 'fee': return t('transaction.fee');
      case 'marketing': return t('transaction.marketing');
      case 'advertising': return t('transaction.advertising');
      default: return type;
    }
  };

  const formatCurrency = useCallback((amount: number, currency: string) => {
    return new Intl.NumberFormat(localeTag, {
      style: 'currency',
      currency: currency
    }).format(amount);
  }, [localeTag]);

  const formatDate = useCallback((dateString: string) => {
    return new Date(dateString).toLocaleDateString(localeTag);
  }, [localeTag]);

  // domainById：行渲染需要拿完整 domain 对象算 ROI（旧逻辑每行 .find 是
  // O(n×m)）。原 domainMap 只存 id→name，独立留一份完整对象的 Map，
  // getDomainName 改走它，避免维护两份索引。
  const domainById = useMemo(() => {
    const map = new Map<string, DomainWithTags>();
    domains.forEach((d) => map.set(d.id, d));
    return map;
  }, [domains]);

  const getDomainName = useCallback((domainId: string) => {
    return domainById.get(domainId)?.domain_name || t('transactionList.unknownDomain');
  }, [domainById, t]);

  const filteredTransactions = useMemo(() => {
    const filtered = transactions.filter(transaction => {
      const matchesSearch =
        getDomainName(transaction.domain_id).toLowerCase().includes(searchTerm.toLowerCase()) ||
        (transaction.notes || '').toLowerCase().includes(searchTerm.toLowerCase());

      const matchesType = typeFilter === 'all' || transaction.type === typeFilter;

      return matchesSearch && matchesType;
    });
    const sorted = filtered.slice().sort((a, b) => {
      let cmp = 0;
      if (sortField === 'date') {
        cmp = (a.date || '').localeCompare(b.date || '');
      } else if (sortField === 'amount') {
        cmp = sellGrossUSD(a) - sellGrossUSD(b);
      } else {
        cmp = a.type.localeCompare(b.type);
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [transactions, getDomainName, searchTerm, typeFilter, sortField, sortDir]);

  // Period KPIs reflecting the *visible* (filtered) set, computed from installment-adjusted
  // amounts (when parent supplies metricsTransactions). Inflow uses sellNetUSD — actual cash
  // collected after platform fees and after scaling for partial / cancelled installments —
  // mirroring the Insights "Total Revenue" definition. "Net" here is window cash flow,
  // not the all-time Net Profit (that would require holding-cost calculations across history).
  const metricsById = useMemo(() => {
    const map = new Map<string, TransactionWithRequiredFields>();
    const source = metricsTransactions ?? transactions;
    for (const tx of source) map.set(tx.id, tx);
    return map;
  }, [metricsTransactions, transactions]);

  const periodMetrics = useMemo(() => {
    let inflow = 0;
    let outflow = 0;
    for (const tx of filteredTransactions) {
      const adj = metricsById.get(tx.id) ?? tx;
      if (tx.type === 'sell') {
        const v = sellNetUSD(adj);
        if (Number.isFinite(v)) inflow += v;
      } else {
        const v = Number(adj.base_amount ?? adj.amount ?? 0);
        if (Number.isFinite(v)) outflow += v;
      }
    }
    return { inflow, outflow, net: inflow - outflow, count: filteredTransactions.length };
  }, [filteredTransactions, metricsById]);

  const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / TRANSACTIONS_PAGE_SIZE));
  const page = Math.min(pageRaw, totalPages);

  // If the URL points beyond available pages (e.g. a stale shared link), normalize the URL once.
  useEffect(() => {
    if (pageRaw > totalPages) updateParams({ txpage: null });
  }, [pageRaw, totalPages, updateParams]);

  const paginatedTransactions = useMemo(() => {
    const start = (page - 1) * TRANSACTIONS_PAGE_SIZE;
    return filteredTransactions.slice(start, start + TRANSACTIONS_PAGE_SIZE);
  }, [filteredTransactions, page]);

  const paginationRangeSummary =
    filteredTransactions.length > TRANSACTIONS_PAGE_SIZE
      ? t('common.paginationRange')
          .replace('{start}', String((page - 1) * TRANSACTIONS_PAGE_SIZE + 1))
          .replace(
            '{end}',
            String(Math.min(page * TRANSACTIONS_PAGE_SIZE, filteredTransactions.length))
          )
          .replace('{total}', String(filteredTransactions.length))
      : undefined;

  const typeOptions = [
    { value: 'all', labelKey: 'transactionList.allTypes' as const },
    { value: 'buy', labelKey: 'transaction.buy' as const },
    { value: 'sell', labelKey: 'transaction.sell' as const },
    { value: 'renew', labelKey: 'transaction.renew' as const },
    { value: 'transfer', labelKey: 'transaction.transfer' as const },
    { value: 'fee', labelKey: 'transaction.fee' as const },
    { value: 'marketing', labelKey: 'transaction.marketing' as const },
    { value: 'advertising', labelKey: 'transaction.advertising' as const }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-stone-900">{t('transactionList.title')}</h2>
          <p className="text-sm text-stone-500 mt-0.5">{t('transactionList.subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl border border-stone-200 bg-stone-50/80 p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition ${
                viewMode === 'list'
                  ? 'bg-white text-stone-900 shadow-sm'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <LayoutList className="h-4 w-4" />
              {t('transactionList.viewList')}
            </button>
            <button
              type="button"
              onClick={() => setViewMode('timeline')}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition ${
                viewMode === 'timeline'
                  ? 'bg-white text-stone-900 shadow-sm'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <GitBranch className="h-4 w-4" />
              {t('transactionList.viewTimeline')}
            </button>
          </div>
          <button
            onClick={onAdd}
            className="inline-flex items-center px-4 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-medium hover:bg-teal-700 transition"
          >
            <Plus className="h-4 w-4 mr-2" />
            {t('transactionList.addTransaction')}
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
            <input
              type="search"
              aria-label={t('transactionList.searchPlaceholder')}
              placeholder={t('transactionList.searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            />
          </div>
        </div>
        {viewMode === 'list' && (
          <div className="flex flex-wrap items-center gap-3">
            <Filter className="h-4 w-4 text-stone-400" />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              aria-label={t('transactionList.allTypes')}
              className="px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              {typeOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {t(option.labelKey)}
                </option>
              ))}
            </select>
            {/* Sort dropdown — mobile only (desktop uses clickable column headers) */}
            <select
              value={`${sortField}-${sortDir}`}
              onChange={(e) => {
                const [field, dir] = e.target.value.split('-') as [SortField, SortDir];
                updateParams({
                  txsort: field === 'date' ? null : field,
                  txdir: (field === 'date' && dir === 'desc') ? null : dir,
                  txpage: null,
                });
              }}
              aria-label={t('transactionList.sortBy')}
              className="lg:hidden px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="date-desc">{t('transactionList.sortByDate')} · {t('transactionList.sortDesc')}</option>
              <option value="date-asc">{t('transactionList.sortByDate')} · {t('transactionList.sortAsc')}</option>
              <option value="amount-desc">{t('transactionList.sortByAmount')} · {t('transactionList.sortDesc')}</option>
              <option value="amount-asc">{t('transactionList.sortByAmount')} · {t('transactionList.sortAsc')}</option>
              <option value="type-asc">{t('transactionList.sortByType')} · {t('transactionList.sortAsc')}</option>
              <option value="type-desc">{t('transactionList.sortByType')} · {t('transactionList.sortDesc')}</option>
            </select>
          </div>
        )}
      </div>

      {viewMode === 'timeline' && (
        <p className="text-sm text-stone-500">{t('timeline.searchHint')}</p>
      )}

      {viewMode === 'list' && filteredTransactions.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 rounded-2xl border border-stone-200/80 bg-white shadow-sm divide-y sm:divide-y-0 sm:divide-x divide-stone-100">
          <div className="p-4">
            <p className="text-[10px] font-medium uppercase tracking-wider text-stone-500">{t('transactionList.kpiInflow')}</p>
            <p className="mt-0.5 text-lg font-bold text-emerald-700 tabular-nums">+{formatCurrency(periodMetrics.inflow, 'USD')}</p>
          </div>
          <div className="p-4">
            <p className="text-[10px] font-medium uppercase tracking-wider text-stone-500">{t('transactionList.kpiOutflow')}</p>
            <p className="mt-0.5 text-lg font-bold text-rose-700 tabular-nums">-{formatCurrency(periodMetrics.outflow, 'USD')}</p>
          </div>
          <div className="p-4">
            <p className="text-[10px] font-medium uppercase tracking-wider text-stone-500">{t('transactionList.kpiNet')}</p>
            <p className={`mt-0.5 text-lg font-bold tabular-nums ${periodMetrics.net >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
              {periodMetrics.net >= 0 ? '+' : '-'}{formatCurrency(Math.abs(periodMetrics.net), 'USD')}
            </p>
          </div>
          <div className="p-4">
            <p className="text-[10px] font-medium uppercase tracking-wider text-stone-500">{t('transactionList.kpiCount')}</p>
            <p className="mt-0.5 text-lg font-bold text-stone-900 tabular-nums">{periodMetrics.count}</p>
          </div>
        </div>
      )}

      {viewMode === 'list' && (
        <p className="text-sm text-stone-500">
          {t('transactionList.showingCount').replace('{filtered}', String(filteredTransactions.length)).replace('{total}', String(transactions.length))}
        </p>
      )}

      {viewMode === 'timeline' ? (
        <DomainTimelineView
          domains={domains}
          transactions={transactions}
          onEditTransaction={onEdit}
          domainSearch={searchTerm}
        />
      ) : filteredTransactions.length === 0 ? (
        <div className="text-center py-14 bg-white rounded-2xl border border-stone-200/80 shadow-sm">
          <FileText className="h-10 w-10 mx-auto text-stone-300 mb-4" />
          <h3 className="text-base font-semibold text-stone-900 mb-2">
            {searchTerm || typeFilter !== 'all' ? t('transactionList.noTransactionsFound') : t('transactionList.noTransactionsYet')}
          </h3>
          <p className="text-sm text-stone-500 mb-5 max-w-sm mx-auto">
            {searchTerm || typeFilter !== 'all' ? t('transactionList.adjustSearch') : t('transactionList.getStarted')}
          </p>
          {!searchTerm && typeFilter === 'all' ? (
            <button
              onClick={onAdd}
              className="inline-flex items-center px-4 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-medium hover:bg-teal-700 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
            >
              <Plus className="h-4 w-4 mr-2" />
              {t('transactionList.addFirstTransaction')}
            </button>
          ) : (
            <button
              onClick={() => { setSearchTerm(''); setTypeFilter('all'); }}
              className="inline-flex items-center px-4 py-2.5 border border-stone-300 bg-white text-stone-700 rounded-xl text-sm font-medium hover:bg-stone-100 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
            >
              {t('transactionList.clearFilters')}
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {/* Mobile: stacked cards (table is unreadable below lg) */}
          <div className="lg:hidden space-y-2">
            {paginatedTransactions.map((transaction) => {
              const isSell = transaction.type === 'sell';
              const amountColor = isSell ? 'text-emerald-700' : 'text-stone-900';
              const sign = isSell ? '+' : '-';
              const grossAmt = sellGrossUSD(transaction);
              const hasPlatformFee = isSell && transaction.platform_fee != null && transaction.platform_fee > 0;
              const isInstallment = isSell && transaction.payment_plan === 'installment';
              const domain = isSell ? domainById.get(transaction.domain_id) : null;
              const sellRoi = isSell && domain ? calculateDomainROI(domain, [transaction]) : null;
              return (
                <article key={transaction.id} className="bg-white rounded-2xl border border-stone-200/80 shadow-sm p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-stone-900 break-words">
                        {getDomainName(transaction.domain_id)}
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-stone-500">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full font-medium ${getTypeColor(transaction.type)}`}>
                          {getTypeLabel(transaction.type)}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(transaction.date)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5 flex-shrink-0">
                      <button
                        onClick={() => onEdit(transaction)}
                        aria-label={`${t('common.edit')} ${getDomainName(transaction.domain_id)}`}
                        className="p-2 text-stone-500 hover:text-teal-600 hover:bg-teal-50 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => onDelete(transaction.id)}
                        aria-label={`${t('common.delete')} ${getDomainName(transaction.domain_id)}`}
                        className="p-2 text-stone-500 hover:text-rose-600 hover:bg-rose-50 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 flex items-baseline flex-wrap gap-x-2 gap-y-1">
                    <span className={`text-base font-bold tabular-nums ${amountColor}`}>
                      {sign}{formatCurrency(grossAmt, transaction.currency)}
                    </span>
                    {sellRoi !== null && (
                      <span className={`text-xs font-medium tabular-nums ${sellRoi.roi >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        ROI {sellRoi.roi >= 0 ? '+' : ''}{formatPercentage(sellRoi.roi)}
                      </span>
                    )}
                  </div>
                  {hasPlatformFee && (
                    <div className="mt-0.5 text-xs text-stone-500 tabular-nums">
                      {t('transaction.netIncome')}: {formatCurrency(sellNetUSD(transaction), transaction.currency)}
                    </div>
                  )}
                  {isInstallment && (
                    <div className="mt-0.5 text-xs text-stone-500">
                      {transaction.installment_status === 'cancelled'
                        ? `${t('transaction.installment')} · ${t('transaction.cancelled')}`
                        : `${t('transaction.installment')} ${transaction.paid_periods ?? 0}/${transaction.installment_period ?? 0}`}
                    </div>
                  )}
                  {transaction.notes && (
                    <div className="mt-2 text-xs text-stone-600 break-words">{transaction.notes}</div>
                  )}
                </article>
              );
            })}
          </div>
          {/* Desktop: full table */}
          <div className="hidden lg:block bg-white rounded-2xl border border-stone-200/80 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-stone-200">
                <thead className="bg-stone-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">
                      {t('transactionList.domain')}
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider"
                      aria-sort={sortField === 'type' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    >
                      <button
                        type="button"
                        onClick={() => toggleSort('type')}
                        aria-label={`${t('transactionList.sortBy')} ${t('transactionList.type')}`}
                        className="inline-flex items-center gap-1 uppercase tracking-wider hover:text-stone-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-1 rounded"
                      >
                        {t('transactionList.type')}
                        {sortField === 'type' && (sortDir === 'asc' ? <ArrowUp className="h-3 w-3 text-teal-600" /> : <ArrowDown className="h-3 w-3 text-teal-600" />)}
                      </button>
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider"
                      aria-sort={sortField === 'amount' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    >
                      <button
                        type="button"
                        onClick={() => toggleSort('amount')}
                        aria-label={`${t('transactionList.sortBy')} ${t('transactionList.amount')}`}
                        className="inline-flex items-center gap-1 uppercase tracking-wider hover:text-stone-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-1 rounded"
                      >
                        {t('transactionList.amount')}
                        {sortField === 'amount' && (sortDir === 'asc' ? <ArrowUp className="h-3 w-3 text-teal-600" /> : <ArrowDown className="h-3 w-3 text-teal-600" />)}
                      </button>
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider"
                      aria-sort={sortField === 'date' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    >
                      <button
                        type="button"
                        onClick={() => toggleSort('date')}
                        aria-label={`${t('transactionList.sortBy')} ${t('transactionList.date')}`}
                        className="inline-flex items-center gap-1 uppercase tracking-wider hover:text-stone-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-1 rounded"
                      >
                        {t('transactionList.date')}
                        {sortField === 'date' && (sortDir === 'asc' ? <ArrowUp className="h-3 w-3 text-teal-600" /> : <ArrowDown className="h-3 w-3 text-teal-600" />)}
                      </button>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">
                      {t('transactionList.notes')}
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-stone-500 uppercase tracking-wider">
                      {t('transactionList.actions')}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-stone-200">
                  {paginatedTransactions.map((transaction) => (
                  <tr key={transaction.id} className="hover:bg-stone-50/80">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-stone-900">
                        {getDomainName(transaction.domain_id)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTypeColor(transaction.type)}`}>
                        {getTypeLabel(transaction.type)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          {(() => {
                            const isSell = transaction.type === 'sell';
                            const isInflow = isSell;
                            const amountColor = isInflow ? 'text-emerald-700' : 'text-stone-900';
                            const sign = isInflow ? '+' : '-';
                            const grossAmt = sellGrossUSD(transaction);
                            const hasPlatformFee = isSell && transaction.platform_fee != null && transaction.platform_fee > 0;
                            const isInstallment = isSell && transaction.payment_plan === 'installment';
                            const domain = isSell ? domainById.get(transaction.domain_id) : null;
                            const sellRoi = isSell && domain ? calculateDomainROI(domain, [transaction]) : null;
                            return (
                              <>
                                <span className={`text-sm font-semibold tabular-nums ${amountColor}`}>
                                  {sign}{formatCurrency(grossAmt, transaction.currency)}
                                </span>
                                {hasPlatformFee && (
                                  <span className="mt-0.5 text-xs text-stone-500 tabular-nums">
                                    {t('transaction.netIncome')}: {formatCurrency(sellNetUSD(transaction), transaction.currency)}
                                  </span>
                                )}
                                {isInstallment && (
                                  <span className="mt-0.5 text-xs text-stone-500">
                                    {transaction.installment_status === 'cancelled'
                                      ? `${t('transaction.installment')} · ${t('transaction.cancelled')}`
                                      : `${t('transaction.installment')} ${transaction.paid_periods ?? 0}/${transaction.installment_period ?? 0}`}
                                  </span>
                                )}
                                {sellRoi !== null && (
                                  <span className={`mt-0.5 text-xs font-medium tabular-nums ${sellRoi.roi >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                    ROI {sellRoi.roi >= 0 ? '+' : ''}{formatPercentage(sellRoi.roi)}
                                  </span>
                                )}
                              </>
                            );
                          })()}
                        </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Calendar className="h-4 w-4 text-stone-400 mr-1" />
                        <span className="text-sm text-stone-900">
                          {formatDate(transaction.date)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-stone-700 max-w-xs truncate">
                        {transaction.notes || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-0.5">
                        <button
                          onClick={() => onEdit(transaction)}
                          aria-label={`${t('common.edit')} ${getDomainName(transaction.domain_id)}`}
                          className="p-2 text-stone-500 hover:text-teal-600 hover:bg-teal-50 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => onDelete(transaction.id)}
                          aria-label={`${t('common.delete')} ${getDomainName(transaction.domain_id)}`}
                          className="p-2 text-stone-500 hover:text-rose-600 hover:bg-rose-50 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <ListPagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={setPage}
            rangeSummary={paginationRangeSummary}
          />
        </div>
      )}
    </div>
  );
});

export default TransactionList;
