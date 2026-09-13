'use client';

import { useState, useMemo, memo, useEffect, useRef, useCallback, Fragment } from 'react';
import { Edit, Trash2, Eye, Share2, Calendar, Tag, Globe, ChevronRight, ChevronDown, Plus, RefreshCw, TrendingUp, FileText, ArrowUp, ArrowDown } from 'lucide-react';
import DomainShareModal from '../share/DomainShareModal';
import { DomainWithTags } from '../../types/dashboard';
import type { TransactionWithRequiredFields } from '../../types/transaction';
import { useI18nContext } from '../../contexts/I18nProvider';
import { calculateDomainROI } from '../../lib/financialCalculations';
import { domainStatusLabel as statusLabel } from '../../lib/domainStatusLabel';
import { isExpiredButNotMarked } from '../../lib/domainLossStatus';
import { daysUntilEffectiveExpiry } from '../../lib/effectiveExpiry';
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

type EditableMoneyField = 'estimated_value' | 'purchase_cost' | 'renewal_cost';
type EditTarget = { id: string; field: 'status' | EditableMoneyField } | null;

const DomainTable = memo(function DomainTable({ domains, transactions = [], onEdit, onDelete, onView, onUpdateDomain }: DomainTableProps) {
  // 每个域名当下还在分期收款的摘要（找一次，行渲染直接读 map）。chip 文案
  // 只显示 paid/total，不带金额——表格里多一个货币会让第三列变拥挤。
  const activeInstallmentByDomain = useMemo(() => {
    const map = new Map<string, { paid: number; total: number }>();
    for (const tx of transactions) {
      if (tx.type !== 'sell') continue;
      if (tx.payment_plan !== 'installment') continue;
      if (tx.installment_status === 'cancelled' || tx.installment_status === 'completed') continue;
      const total = tx.installment_period ?? 0;
      const paid = tx.receipts?.length ?? 0;
      if (total > 0 && paid >= total) continue;
      // 同一域名理论上只有一条 active；多于一条时取最新交易日。
      const existing = map.get(tx.domain_id);
      if (!existing) {
        map.set(tx.domain_id, { paid, total });
      }
    }
    return map;
  }, [transactions]);

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

  // 通用化"begin a money cell edit"——estimated_value / purchase_cost /
  // renewal_cost 三个字段在 UX 上完全一致（点击 → 数字输入框 → blur 提交 /
  // Enter 提交 / Escape 取消），所以收成一份。CSV 导入后用户主要是来这里
  // 批量补 purchase_cost 的，所以 input 默认全选当前值方便覆盖。
  const beginEditMoney = useCallback((domain: DomainWithTags, field: EditableMoneyField) => {
    if (!onUpdateDomain) return;
    setEditing({ id: domain.id, field });
    setDraftValue(String(domain[field] ?? 0));
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

  const commitMoney = useCallback(async (domain: DomainWithTags, field: EditableMoneyField) => {
    if (!onUpdateDomain) return;
    const parsed = Number(draftValue);
    if (!Number.isFinite(parsed) || parsed < 0) { cancelEdit(); return; }
    const current = (domain[field] as number | null) ?? 0;
    if (parsed === current) { cancelEdit(); return; }
    await onUpdateDomain(domain, { [field]: parsed } as Partial<DomainWithTags>);
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

  // Tab / Shift+Tab：保存当前 cell 的值，焦点跳到上 / 下一行同一列继续编辑。
  // CSV 导入完用户最痛的场景就是顺着列一行行填 purchase_cost / renewal_cost；
  // 没 Tab 就要每行 click，体验差一档。跨页时 cancelEdit 让用户主动翻页——
  // 避免编辑焦点跳到屏幕外的不可见行。
  // 不用 useCallback —— 这函数仅在 keydown 事件中调用一次，且依赖的
  // displayedDomains / draftValue 每次 render 都变；包 useCallback 反而搞复杂。
  const handleMoneyKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    domain: DomainWithTags,
    field: EditableMoneyField
  ) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitMoney(domain, field);
      return;
    }
    if (e.key === 'Escape') {
      cancelEdit();
      return;
    }
    if (e.key !== 'Tab') return;

    e.preventDefault();
    // commit 当前值（不调 cancelEdit，下面会 setEditing 到下一行）
    const parsed = Number(draftValue);
    const current = (domain[field] as number | null) ?? 0;
    if (
      onUpdateDomain &&
      Number.isFinite(parsed) &&
      parsed >= 0 &&
      parsed !== current
    ) {
      void onUpdateDomain(domain, { [field]: parsed } as Partial<DomainWithTags>);
    }
    const idx = displayedDomains.findIndex((d) => d.id === domain.id);
    const dir = e.shiftKey ? -1 : 1;
    const target = displayedDomains[idx + dir];
    if (target) {
      setEditing({ id: target.id, field });
      setDraftValue(String((target[field] as number | null) ?? 0));
      setTimeout(() => valueInputRef.current?.select(), 0);
    } else {
      cancelEdit();
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

  // 行首左边条颜色：用饱和度 500 与 DomainCard 边条同源，让用户扫一列表格
  // 时一眼读到 status，不用回到第三列读 pill。
  const getEdgeAccent = (status: string) => {
    switch (status) {
      case 'active':
        return 'border-l-teal-500';
      case 'for_sale':
        return 'border-l-amber-500';
      case 'sold':
        return 'border-l-emerald-500';
      case 'expired':
        return 'border-l-rose-400';
      default:
        return 'border-l-stone-300';
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


  // 走和 dashboard 到期提醒同一个实现，否则两处会差一天：这里原本是
  // `ceil((new Date(expiry) - now) / 一天)`，expiry 按 UTC 午夜解析、now 是
  // 真实时刻，得数会随一天中的时刻跳变（JST 早上 9 点前多一天，纽约晚上 7 点
  // 后少一天），于是表格徽章显示 26 天而到期卡片说 25 天。
  // 只传 expiry_date：保持"表格读字面字段、没填就不显示"的原有语义，不引入
  // getEffectiveExpiry 的兜底链。
  const getDaysUntilExpiry = (expiryDate?: string) =>
    daysUntilEffectiveExpiry({ expiry_date: expiryDate ?? null });

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
                <th
                  aria-label={t('domainList.table.expandHistory')}
                  className="w-8 px-2 py-3 border-l-4 border-l-transparent"
                />
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
                const isEditingCost = editing?.id === domain.id && editing.field === 'purchase_cost';
                const isEditingRenewal = editing?.id === domain.id && editing.field === 'renewal_cost';
                const domainEvents = transactionsByDomainId.get(domain.id) ?? [];

                return (
                  <Fragment key={domain.id}>
                  <tr className="hover:bg-stone-50/60 transition-colors">
                    <td className={`w-8 px-2 py-3 align-top border-l-4 ${getEdgeAccent(domain.status)}`}>
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
                      <div className="flex flex-wrap items-center gap-1.5">
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
                        {isExpiredButNotMarked(domain) && (
                          <span
                            title={t('common.overdueUnrenewedTooltip')}
                            className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200"
                          >
                            {t('common.overdueUnrenewed')}
                          </span>
                        )}
                        {(() => {
                          const inst = activeInstallmentByDomain.get(domain.id);
                          if (!inst) return null;
                          return (
                            <span
                              className="inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                              title={t('transaction.installmentConfig')}
                            >
                              {t('transaction.installment')} {inst.paid}/{inst.total}
                            </span>
                          );
                        })()}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {/* purchase_cost / renewal_cost 是两个独立财务概念
                          （一次性买入 vs 年度续费），共用 Cost 列时必须挂明确
                          标签——否则用户看到两行数字会以为重复填了。Buy/Renew
                          二字标签足够区分，统一固定宽度让数字纵向对齐，扫起来
                          像一张迷你财务卡。空值斜体灰显示 "Set" 邀请填写。 */}
                      <div className="flex items-center gap-2">
                        <span className="w-10 text-[10px] font-semibold uppercase tracking-wide text-stone-400">
                          {t('domainList.table.costLabelBuy')}
                        </span>
                        {isEditingCost ? (
                          <input
                            ref={valueInputRef}
                            // type="text"：原生 number 的 .value 会把 "9." 这种
                            // 输入中间态读成空字符串，草稿被清掉，$9.88 最后落成 $88
                            type="text"
                            inputMode="decimal"
                            value={draftValue}
                            onChange={(e) => setDraftValue(e.target.value)}
                            onBlur={() => commitMoney(domain, 'purchase_cost')}
                            onKeyDown={(e) => handleMoneyKeyDown(e, domain, 'purchase_cost')}
                            className="w-24 text-sm rounded border border-stone-300 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-teal-500"
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => beginEditMoney(domain, 'purchase_cost')}
                            disabled={!onUpdateDomain}
                            title={onUpdateDomain ? t('domainList.table.clickToUpdateCost') : undefined}
                            className={`text-sm ${onUpdateDomain ? 'cursor-pointer hover:bg-stone-100 rounded px-1 -mx-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500' : 'cursor-default'} ${
                              domain.purchase_cost && domain.purchase_cost > 0
                                ? 'text-stone-900'
                                : 'text-stone-400 italic'
                            }`}
                          >
                            {domain.purchase_cost && domain.purchase_cost > 0
                              ? formatCurrency(domain.purchase_cost)
                              : t('domainList.table.costNotSet')}
                          </button>
                        )}
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="w-10 text-[10px] font-semibold uppercase tracking-wide text-stone-400">
                          {t('domainList.table.costLabelRenew')}
                        </span>
                        {isEditingRenewal ? (
                          <input
                            ref={valueInputRef}
                            // type="text"：原生 number 的 .value 会把 "9." 这种
                            // 输入中间态读成空字符串，草稿被清掉，$9.88 最后落成 $88
                            type="text"
                            inputMode="decimal"
                            value={draftValue}
                            onChange={(e) => setDraftValue(e.target.value)}
                            onBlur={() => commitMoney(domain, 'renewal_cost')}
                            onKeyDown={(e) => handleMoneyKeyDown(e, domain, 'renewal_cost')}
                            className="w-20 text-xs rounded border border-stone-300 px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-teal-500"
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => beginEditMoney(domain, 'renewal_cost')}
                            disabled={!onUpdateDomain}
                            title={onUpdateDomain ? t('domainList.table.clickToUpdateRenewalCost') : undefined}
                            className={`text-xs ${onUpdateDomain ? 'cursor-pointer hover:bg-stone-100 rounded px-1 -mx-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500' : 'cursor-default'} ${
                              domain.renewal_cost && domain.renewal_cost > 0
                                ? 'text-stone-600'
                                : 'text-stone-400 italic'
                            }`}
                          >
                            {domain.renewal_cost && domain.renewal_cost > 0
                              ? `${formatCurrency(domain.renewal_cost)}/yr`
                              : t('domainList.table.costNotSet')}
                          </button>
                        )}
                        {domain.renewal_count > 0 && (
                          <span className="text-[11px] text-stone-400">
                            · +{domain.renewal_count} {t('domain.renewals')}
                          </span>
                        )}
                      </div>
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
                          type="text"
                          inputMode="decimal"
                          value={draftValue}
                          onChange={(e) => setDraftValue(e.target.value)}
                          onBlur={() => commitMoney(domain, 'estimated_value')}
                          onKeyDown={(e) => handleMoneyKeyDown(e, domain, 'estimated_value')}
                          className="w-24 text-sm rounded border border-stone-300 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-teal-500"
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => beginEditMoney(domain, 'estimated_value')}
                          disabled={!onUpdateDomain}
                          title={onUpdateDomain ? t('domainList.table.clickToUpdateValue') : undefined}
                          className={`text-sm ${onUpdateDomain ? 'cursor-pointer hover:bg-stone-100 rounded px-1 -mx-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500' : 'cursor-default'} ${
                            domain.estimated_value && domain.estimated_value > 0
                              ? 'text-stone-900'
                              : 'text-stone-400 italic'
                          }`}
                        >
                          {domain.estimated_value && domain.estimated_value > 0
                            ? formatCurrency(domain.estimated_value)
                            : t('domainList.table.costNotSet')}
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
                      <td
                        colSpan={9}
                        className={`px-4 py-4 border-l-4 ${getEdgeAccent(domain.status)}`}
                      >
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
