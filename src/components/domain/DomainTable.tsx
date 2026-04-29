'use client';

import { useState, useMemo, memo, useEffect, useRef, useCallback, Fragment } from 'react';
import { Edit, Trash2, Eye, Share2, Calendar, Tag, Globe, ChevronRight, ChevronDown, Plus, RefreshCw, TrendingUp, FileText, ArrowUp, ArrowDown } from 'lucide-react';
import DomainShareModal from '../share/DomainShareModal';
import { DomainWithTags } from '../../types/dashboard';
import type { TransactionWithRequiredFields } from '../../types/transaction';
import { useI18nContext } from '../../contexts/I18nProvider';
import { calculateDomainROI } from '../../lib/financialCalculations';
import { domainStatusLabel as statusLabel } from '../../lib/domainStatusLabel';
import { ListPagination } from '../ui/ListPagination';

// 共享 sortable header：原本每列各写一份 div + onClick + ↑/↓ 字符，
// 既不可访问（th 不是 button、缺 aria-sort）又散落 60+ 行重复。
// 现统一为带 lucide 箭头 + aria-sort 的 button cell。
function SortableHeader({
  field,
  label,
  sortLabel,
  sortField,
  sortDirection,
  onSort,
}: {
  field: string;
  label: string;
  sortLabel: string;
  sortField: string;
  sortDirection: 'asc' | 'desc';
  onSort: (field: string) => void;
}) {
  const active = sortField === field;
  return (
    <th
      className="px-4 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider"
      aria-sort={active ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button
        type="button"
        onClick={() => onSort(field)}
        aria-label={`${sortLabel} ${label}`}
        className="inline-flex items-center gap-1 uppercase tracking-wider hover:text-stone-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-1 rounded"
      >
        {label}
        {active && (sortDirection === 'asc'
          ? <ArrowUp className="h-3 w-3 text-teal-600" />
          : <ArrowDown className="h-3 w-3 text-teal-600" />)}
      </button>
    </th>
  );
}

interface Domain {
  id: string;
  domain_name: string;
  registrar: string;
  purchase_date: string;
  purchase_cost: number;
  renewal_cost: number;
  renewal_cycle: number;
  renewal_count: number;
  next_renewal_date?: string;
  expiry_date?: string;
  status: 'active' | 'for_sale' | 'sold' | 'expired';
  estimated_value: number;
  sale_date?: string;
  sale_price?: number;
  platform_fee?: number;
  tags: string[] | string;
}

interface DomainTableProps {
  domains: DomainWithTags[];
  transactions?: TransactionWithRequiredFields[];
  onEdit: (domain: DomainWithTags) => void;
  onDelete: (id: string) => void;
  onView: (domain: DomainWithTags) => void;
  /** Quick inline update — parent spreads patch onto domain and persists */
  onUpdateDomain?: (domain: DomainWithTags, patch: Partial<DomainWithTags>) => Promise<void> | void;
}

const TABLE_PAGE_SIZE = 24;

type EditTarget = { id: string; field: 'status' | 'estimated_value' } | null;

const DomainTable = memo(function DomainTable({ domains, transactions = [], onEdit, onDelete, onView, onUpdateDomain }: DomainTableProps) {
  const [sortField, setSortField] = useState('domain_name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [showShareModal, setShowShareModal] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState<DomainWithTags | null>(null);
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<EditTarget>(null);
  const [draftValue, setDraftValue] = useState<string>('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const valueInputRef = useRef<HTMLInputElement>(null);
  const { t, locale } = useI18nContext();

  const beginEditStatus = useCallback((domain: DomainWithTags) => {
    if (!onUpdateDomain) return;
    setEditing({ id: domain.id, field: 'status' });
    setDraftValue(domain.status);
  }, [onUpdateDomain]);

  const beginEditValue = useCallback((domain: DomainWithTags) => {
    if (!onUpdateDomain) return;
    setEditing({ id: domain.id, field: 'estimated_value' });
    setDraftValue(String(domain.estimated_value ?? 0));
    setTimeout(() => valueInputRef.current?.select(), 0);
  }, [onUpdateDomain]);

  const cancelEdit = useCallback(() => {
    setEditing(null);
    setDraftValue('');
  }, []);

  const commitStatus = useCallback(async (domain: DomainWithTags, next: string) => {
    if (!onUpdateDomain) return;
    if (!['active', 'for_sale', 'sold', 'expired'].includes(next)) return;
    if (next === domain.status) { cancelEdit(); return; }
    await onUpdateDomain(domain, { status: next as 'active' | 'for_sale' | 'sold' | 'expired' });
    cancelEdit();
  }, [onUpdateDomain, cancelEdit]);

  const commitValue = useCallback(async (domain: DomainWithTags) => {
    if (!onUpdateDomain) return;
    const parsed = Number(draftValue);
    if (!Number.isFinite(parsed) || parsed < 0) { cancelEdit(); return; }
    if (parsed === (domain.estimated_value ?? 0)) { cancelEdit(); return; }
    await onUpdateDomain(domain, { estimated_value: parsed });
    cancelEdit();
  }, [onUpdateDomain, draftValue, cancelEdit]);

  const transactionsByDomainId = useMemo(() => {
    const map = new Map<string, TransactionWithRequiredFields[]>();
    for (const tx of transactions) {
      if (!tx.domain_id) continue;
      const arr = map.get(tx.domain_id) ?? [];
      arr.push(tx);
      map.set(tx.domain_id, arr);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    }
    return map;
  }, [transactions]);

  const toggleExpand = (id: string) => setExpandedId((curr) => (curr === id ? null : id));

  const sortedDomains = useMemo(() => [...domains].sort((a, b) => {
    if (sortField === 'expiry_date') {
      const aDate = a.expiry_date ? new Date(a.expiry_date).getTime() : Infinity;
      const bDate = b.expiry_date ? new Date(b.expiry_date).getTime() : Infinity;
      return sortDirection === 'asc' ? aDate - bDate : bDate - aDate;
    }

    let aValue: string | number = a[sortField as keyof Domain] as string | number;
    let bValue: string | number = b[sortField as keyof Domain] as string | number;

    if (sortField === 'purchase_cost' || sortField === 'renewal_cost' || sortField === 'estimated_value') {
      aValue = Number(aValue) || 0;
      bValue = Number(bValue) || 0;
    }

    if (sortDirection === 'asc') {
      return aValue > bValue ? 1 : -1;
    } else {
      return aValue < bValue ? 1 : -1;
    }
  }), [domains, sortField, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(sortedDomains.length / TABLE_PAGE_SIZE));

  useEffect(() => {
    setPage(1);
  }, [domains]);

  useEffect(() => {
    setPage((p) => (p > totalPages ? totalPages : p));
  }, [totalPages]);

  const displayedDomains = useMemo(() => {
    const start = (page - 1) * TABLE_PAGE_SIZE;
    return sortedDomains.slice(start, start + TABLE_PAGE_SIZE);
  }, [sortedDomains, page]);

  const paginationRangeSummary =
    sortedDomains.length > TABLE_PAGE_SIZE
      ? t('common.paginationRange')
          .replace('{start}', String((page - 1) * TABLE_PAGE_SIZE + 1))
          .replace(
            '{end}',
            String(Math.min(page * TABLE_PAGE_SIZE, sortedDomains.length))
          )
          .replace('{total}', String(sortedDomains.length))
      : undefined;

  const handleSort = (field: string) => {
    setPage(1);
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // 与 status chip 滤镜带 + Hero 持仓 donut + DomainCard + IA 状态饼图对齐：
  // active=teal, for_sale=amber, sold=emerald, expired=rose，统一 100/700。
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-teal-100 text-teal-700';
      case 'for_sale':
        return 'bg-amber-100 text-amber-700';
      case 'sold':
        return 'bg-emerald-100 text-emerald-700';
      case 'expired':
        return 'bg-rose-100 text-rose-700';
      default:
        return 'bg-stone-100 text-stone-700';
    }
  };

  // const calculateTotalHoldingCost = (domain: DomainWithTags) => {
  //   const totalRenewalCost = domain.renewal_count * (domain.renewal_cost || 0);
  //   return (domain.purchase_cost || 0) + totalRenewalCost;
  // };

  const localeTag = locale === 'zh' ? 'zh-CN' : 'en-US';
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat(localeTag, {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };
  const formatDateLocale = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(localeTag);
  };


  const getDaysUntilExpiry = (expiryDate?: string) => {
    if (!expiryDate) return null;
    const today = new Date();
    const expiry = new Date(expiryDate);
    const diffTime = expiry.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getExpiryStatus = (domain: DomainWithTags) => {
    // 已出售的域名不显示过期信息
    if (domain.status === 'sold') return null;
    
    if (!domain.expiry_date) return null;
    const days = getDaysUntilExpiry(domain.expiry_date);
    if (days === null) return null;
    
    if (days < 0) return { text: t('domainList.table.expiredText'), color: 'text-rose-700' };
    if (days <= 30) return { text: `${days}d`, color: 'text-rose-600' };
    if (days <= 90) return { text: `${days}d`, color: 'text-amber-600' };
    return { text: `${days}d`, color: 'text-emerald-600' };
  };

  return (
    <div className="space-y-4">
      {/* Table */}
      <div className="bg-white rounded-2xl border border-stone-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-stone-50 border-b border-stone-200">
              <tr>
                <th aria-label={t('domainList.table.expandHistory')} className="w-8 px-2 py-3" />
                <SortableHeader
                  field="domain_name"
                  label={t('domainList.table.domainName')}
                  sortLabel={t('domainList.table.sortBy')}
                  sortField={sortField}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                />
                <SortableHeader
                  field="status"
                  label={t('domainList.table.status')}
                  sortLabel={t('domainList.table.sortBy')}
                  sortField={sortField}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                />
                <SortableHeader
                  field="purchase_cost"
                  label={t('domainList.table.cost')}
                  sortLabel={t('domainList.table.sortBy')}
                  sortField={sortField}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                />
                <SortableHeader
                  field="estimated_value"
                  label={t('domainList.table.value')}
                  sortLabel={t('domainList.table.sortBy')}
                  sortField={sortField}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                />
                <SortableHeader
                  field="expiry_date"
                  label={t('domainList.table.expiry')}
                  sortLabel={t('domainList.table.sortBy')}
                  sortField={sortField}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                />
                <th className="px-4 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">
                  {t('domainList.table.roi')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">
                  {t('domainList.table.tags')}
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-stone-500 uppercase tracking-wider">
                  {t('domainList.table.actions')}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-stone-200">
              {displayedDomains.map((domain) => {
                const roi = calculateDomainROI(domain, transactions);
                const expiryStatus = getExpiryStatus(domain);
                const isExpanded = expandedId === domain.id;
                const isEditingStatus = editing?.id === domain.id && editing.field === 'status';
                const isEditingValue = editing?.id === domain.id && editing.field === 'estimated_value';
                const domainEvents = transactionsByDomainId.get(domain.id) ?? [];

                return (
                  <Fragment key={domain.id}>
                  <tr className="hover:bg-stone-50/80">
                    <td className="w-8 px-2 py-3 align-top">
                      <button
                        type="button"
                        onClick={() => toggleExpand(domain.id)}
                        aria-expanded={isExpanded}
                        aria-label={isExpanded ? t('domainList.table.collapseHistory') : t('domainList.table.expandHistory')}
                        className="text-stone-400 hover:text-stone-700 p-1 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-1"
                      >
                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Globe className="w-4 h-4 text-stone-400" />
                        <div>
                          <div className="font-medium text-stone-900">{domain.domain_name}</div>
                          <div className="text-sm text-stone-500">{domain.registrar}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {isEditingStatus ? (
                        <select
                          autoFocus
                          value={draftValue}
                          onChange={(e) => { setDraftValue(e.target.value); commitStatus(domain, e.target.value); }}
                          onBlur={cancelEdit}
                          onKeyDown={(e) => { if (e.key === 'Escape') cancelEdit(); }}
                          className="text-xs font-medium rounded-full border border-stone-300 bg-white px-2 py-1 focus:outline-none focus:ring-2 focus:ring-teal-500"
                        >
                          <option value="active">{t('common.active')}</option>
                          <option value="for_sale">{t('common.forSale')}</option>
                          <option value="sold">{t('common.sold')}</option>
                          <option value="expired">{t('common.expired')}</option>
                        </select>
                      ) : (
                        <button
                          type="button"
                          onClick={() => beginEditStatus(domain)}
                          disabled={!onUpdateDomain}
                          title={onUpdateDomain ? t('domainList.table.clickToChangeStatus') : undefined}
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(domain.status)} ${onUpdateDomain ? 'cursor-pointer hover:ring-2 hover:ring-stone-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500' : 'cursor-default'}`}
                        >
                          {statusLabel(domain.status, t)}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-stone-900">{formatCurrency(domain.purchase_cost || 0)}</div>
                      {domain.renewal_count > 0 && (
                        <div className="text-xs text-stone-500">
                          +{domain.renewal_count} {t('domain.renewals')}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {domain.status === 'sold' && domain.sale_price ? (
                        <div>
                          <div className="text-sm font-medium text-emerald-600">{formatCurrency(domain.sale_price)}</div>
                          <div className="text-xs text-stone-500">{t('domainList.table.sold')}</div>
                        </div>
                      ) : isEditingValue ? (
                        <input
                          ref={valueInputRef}
                          type="number"
                          min="0"
                          step="1"
                          value={draftValue}
                          onChange={(e) => setDraftValue(e.target.value)}
                          onBlur={() => commitValue(domain)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') { e.preventDefault(); commitValue(domain); }
                            if (e.key === 'Escape') cancelEdit();
                          }}
                          className="w-24 text-sm rounded border border-stone-300 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-teal-500"
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => beginEditValue(domain)}
                          disabled={!onUpdateDomain}
                          title={onUpdateDomain ? t('domainList.table.clickToUpdateValue') : undefined}
                          className={`text-sm text-stone-900 ${onUpdateDomain ? 'cursor-pointer hover:bg-stone-100 rounded px-1 -mx-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500' : 'cursor-default'}`}
                        >
                          {formatCurrency(domain.estimated_value || 0)}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {expiryStatus && domain.expiry_date ? (
                        <div>
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-stone-400" />
                            <span className={`text-sm font-medium ${expiryStatus.color}`}>
                              {expiryStatus.text}
                            </span>
                          </div>
                          <p className="text-xs text-stone-500 mt-0.5 tabular-nums">
                            {formatDateLocale(domain.expiry_date)}
                          </p>
                        </div>
                      ) : (
                        <span className="text-sm text-stone-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className={`text-sm font-medium ${roi >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {roi >= 0 ? '+' : ''}{roi.toFixed(1)}%
                      </div>
                    </td>
                    <td className="px-4 py-3 max-w-xs">
                      <div className="flex flex-wrap gap-1">
                        {domain.tags.map((tag, index) => (
                          <span key={index} className="inline-flex items-center px-2 py-0.5 rounded-md text-xs bg-stone-100 text-stone-700">
                            <Tag className="w-3 h-3 mr-1" />
                            {tag}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => onView(domain)}
                          className="p-1 text-stone-400 hover:text-teal-600 transition-colors"
                          title={t('domainList.table.viewDetails')}
                          aria-label={`${t('domainList.table.viewDetails')} ${domain.domain_name}`}
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onEdit(domain)}
                          className="p-1 text-stone-400 hover:text-teal-600 transition-colors"
                          title={t('domainList.table.editDomain')}
                          aria-label={`${t('domainList.table.editDomain')} ${domain.domain_name}`}
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        {domain.status === 'sold' && (
                          <button
                            onClick={() => {
                              setSelectedDomain(domain);
                              setShowShareModal(true);
                            }}
                            className="p-1 text-stone-400 hover:text-teal-600 transition-colors"
                            title={t('domainList.table.shareSale')}
                            aria-label={`${t('domainList.table.shareSale')} ${domain.domain_name}`}
                          >
                            <Share2 className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => onDelete(domain.id)}
                          className="p-1 text-stone-400 hover:text-rose-600 transition-colors"
                          title={t('domainList.table.deleteDomain')}
                          aria-label={`${t('domainList.table.deleteDomain')} ${domain.domain_name}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr className="bg-stone-50/50">
                      <td colSpan={9} className="px-4 py-4">
                        {domainEvents.length === 0 ? (
                          <p className="text-sm text-stone-500 italic">{t('timeline.noEvents')}</p>
                        ) : (
                          <ol className="space-y-2">
                            {domainEvents.map((tx) => {
                              const tone = tx.type;
                              const Icon = tone === 'sell' ? TrendingUp : tone === 'renew' ? RefreshCw : tone === 'buy' ? Plus : FileText;
                              // 与 TransactionList / DomainTimelineView 对齐 3 段语义色：
                              // sell=emerald (入账)，buy/renew=stone (主支出)，其他=amber (杂项)。
                              const iconBg =
                                tone === 'sell' ? 'bg-emerald-100 text-emerald-700' :
                                tone === 'buy' || tone === 'renew' ? 'bg-stone-100 text-stone-700' :
                                'bg-amber-50 text-amber-700';
                              const sign = tone === 'sell' ? '+' : '-';
                              const amount = tx.amount ?? 0;
                              const dateStr = tx.date ? formatDateLocale(tx.date) : '';
                              return (
                                <li key={tx.id} className="flex items-center gap-3 text-sm">
                                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${iconBg}`}>
                                    <Icon className="h-3.5 w-3.5" />
                                  </span>
                                  <span className="font-medium text-stone-900 capitalize">{t(`transaction.${tx.type}`)}</span>
                                  <span className="text-stone-500">{dateStr}</span>
                                  <span className={`ml-auto font-semibold tabular-nums ${tone === 'sell' ? 'text-emerald-700' : 'text-stone-900'}`}>
                                    {sign}{formatCurrency(amount)}
                                  </span>
                                  {tx.notes && (
                                    <span className="text-xs text-stone-500 truncate max-w-[40%]">· {tx.notes}</span>
                                  )}
                                </li>
                              );
                            })}
                          </ol>
                        )}
                      </td>
                    </tr>
                  )}
                  </Fragment>
                );
              })}
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

      {/* Empty State */}
      {sortedDomains.length === 0 && (
        <div className="text-center py-12">
          <Globe className="mx-auto h-12 w-12 text-stone-400" />
          <h3 className="mt-2 text-sm font-medium text-stone-900">No domains found</h3>
          <p className="mt-1 text-sm text-stone-500">
            Get started by adding your first domain.
          </p>
        </div>
      )}

      {/* Share Modal */}
      {showShareModal && selectedDomain && (
        <DomainShareModal
          isOpen={showShareModal}
          domain={selectedDomain}
          transactions={transactions}
          onClose={() => {
            setShowShareModal(false);
            setSelectedDomain(null);
          }}
        />
      )}
    </div>
  );
});

export default DomainTable;
