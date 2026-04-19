'use client';

import { useState, useMemo, memo, useEffect } from 'react';
import { Search, Filter, Grid, List, Plus, Table } from 'lucide-react';
import DomainCard from './DomainCard';
import DomainTable from './DomainTable';
import { ListPagination } from '../ui/ListPagination';
import { DomainWithTags } from '../../types/dashboard';
import type { TransactionWithRequiredFields } from '../../types/transaction';
import { useI18nContext } from '../../contexts/I18nProvider';

interface DomainListProps {
  domains: DomainWithTags[];
  transactions?: TransactionWithRequiredFields[];
  onEdit: (domain: DomainWithTags) => void;
  onDelete: (id: string) => void;
  onView: (domain: DomainWithTags) => void;
  onAdd: () => void;
}

const DOMAINS_PAGE_SIZE = 24;

const DomainList = memo(function DomainList({ domains, transactions = [], onEdit, onDelete, onView, onAdd }: DomainListProps) {
  const { t } = useI18nContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [tagFilter, setTagFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'table'>('table');
  const [page, setPage] = useState(1);

  const allTags = useMemo(() =>
    [...new Set(domains.flatMap(d => d.tags))].sort(),
  [domains]);

  const filteredDomains = useMemo(() => domains.filter(domain => {
    const tagsArray = domain.tags;
    const matchesSearch = domain.domain_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (domain.registrar || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         tagsArray.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || domain.status === statusFilter;
    const matchesTag = tagFilter === 'all' || tagsArray.includes(tagFilter);
    return matchesSearch && matchesStatus && matchesTag;
  }), [domains, searchTerm, statusFilter, tagFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredDomains.length / DOMAINS_PAGE_SIZE));

  useEffect(() => {
    setPage(1);
  }, [searchTerm, statusFilter, tagFilter]);

  useEffect(() => {
    setPage((p) => (p > totalPages ? totalPages : p));
  }, [totalPages]);

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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-stone-900">{t('domainList.title')}</h2>
          <p className="text-sm text-stone-500 mt-0.5">{t('domainList.subtitle')}</p>
        </div>
        <button
          onClick={onAdd}
          className="inline-flex items-center px-4 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-medium hover:bg-teal-700 transition"
        >
          <Plus className="h-4 w-4 mr-2" />
          {t('domainList.addDomain')}
        </button>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
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
          <Filter className="h-4 w-4 text-stone-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label={t('domainList.allStatus')}
            className="px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            {statusOptions.map(option => (
              <option key={option.value} value={option.value}>
                {t(option.labelKey)}
              </option>
            ))}
          </select>
          {allTags.length > 0 && (
            <select
              value={tagFilter}
              onChange={(e) => setTagFilter(e.target.value)}
              aria-label={t('domainList.allTags')}
              className="px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="all">{t('domainList.allTags')}</option>
              {allTags.map(tag => (
                <option key={tag} value={tag}>{tag}</option>
              ))}
            </select>
          )}
          <div className="flex items-center border border-stone-200 rounded-xl overflow-hidden">
            <button
              onClick={() => setViewMode('table')}
              className={`p-2.5 ${viewMode === 'table' ? 'bg-stone-900 text-white' : 'text-stone-500 hover:bg-stone-100'}`}
              title={t('domainList.tableView')}
            >
              <Table className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2.5 ${viewMode === 'grid' ? 'bg-stone-900 text-white' : 'text-stone-500 hover:bg-stone-100'}`}
              title={t('domainList.gridView')}
            >
              <Grid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2.5 ${viewMode === 'list' ? 'bg-stone-900 text-white' : 'text-stone-500 hover:bg-stone-100'}`}
              title={t('domainList.listView')}
            >
              <List className="h-4 w-4" />
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
            {searchTerm || statusFilter !== 'all' || tagFilter !== 'all' ? t('domainList.noDomainsFound') : t('domainList.noDomainsYet')}
          </h3>
          <p className="text-sm text-stone-500 mb-5 max-w-sm mx-auto">
            {searchTerm || statusFilter !== 'all' || tagFilter !== 'all' ? t('domainList.adjustSearch') : t('domainList.getStarted')}
          </p>
          {!searchTerm && statusFilter === 'all' && tagFilter === 'all' ? (
            <button onClick={onAdd} className="inline-flex items-center px-4 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-medium hover:bg-teal-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2">
              <Plus className="h-4 w-4 mr-2" />
              {t('domainList.addFirstDomain')}
            </button>
          ) : (
            <button
              onClick={() => { setSearchTerm(''); setStatusFilter('all'); setTagFilter('all'); }}
              className="inline-flex items-center px-4 py-2.5 border border-stone-300 bg-white text-stone-700 rounded-xl text-sm font-medium hover:bg-stone-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
            >
              {t('domainList.clearFilters')}
            </button>
          )}
        </div>
      ) : viewMode === 'table' ? (
        <DomainTable
          domains={filteredDomains}
          transactions={transactions}
          onEdit={onEdit}
          onDelete={onDelete}
          onView={onView}
        />
      ) : (
        <>
          <div
            className={
              viewMode === 'grid'
                ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
                : 'space-y-4'
            }
          >
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
