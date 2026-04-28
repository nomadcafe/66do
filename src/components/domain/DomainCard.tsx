'use client';

import { useState, useMemo, memo } from 'react';
import { Globe, Calendar, DollarSign, Tag, Edit, Trash2, Eye, Share2, AlertTriangle } from 'lucide-react';
import DomainShareModal from '../share/DomainShareModal';
import { DomainWithTags } from '../../types/dashboard';
import { useI18nContext } from '../../contexts/I18nProvider';
import { calculateDomainROI } from '../../lib/financialCalculations';
import { totalHoldingCostForDomain } from '../../lib/renewalCostBasis';
import { domainStatusLabel as statusLabel } from '../../lib/domainStatusLabel';
import { daysUntilEffectiveExpiry } from '../../lib/effectiveExpiry';
import type { TransactionWithRequiredFields } from '../../types/transaction';

/** Days past effective expiry after which a still-active domain is "stale".
 *  Picked to avoid noise on weekend/timezone slop and to give the user a
 *  reasonable grace window before yelling at them. */
const STALE_GRACE_DAYS = 14;

interface DomainCardProps {
  domain: DomainWithTags;
  /** 用于基线续费口径；不传则与仅档案一致 */
  transactions?: TransactionWithRequiredFields[];
  onEdit: (domain: DomainWithTags) => void;
  onDelete: (id: string) => void;
  onView: (domain: DomainWithTags) => void;
}

const DomainCard = memo(function DomainCard({ domain, transactions = [], onEdit, onDelete, onView }: DomainCardProps) {
  const [showShareModal, setShowShareModal] = useState(false);
  const { t, locale } = useI18nContext();
  const localeTag = locale === 'zh' ? 'zh-CN' : 'en-US';

  // 计算总持有成本 - 使用useMemo优化
  const totalHoldingCost = useMemo(
    () => totalHoldingCostForDomain(domain, transactions),
    [domain, transactions]
  );

  // "Stale": still-listed domain whose effective expiry is well past today.
  // Most likely the user renewed at the registrar without recording the
  // renew transaction here — we can't know which way to fix it, so prompt.
  const staleDaysPastExpiry = useMemo(() => {
    if (domain.status !== 'active' && domain.status !== 'for_sale') return null;
    const days = daysUntilEffectiveExpiry(domain);
    if (days === null) return null;
    if (days >= -STALE_GRACE_DAYS) return null;
    return -days; // positive number of days past expiry
  }, [domain]);

  // 与 InvestmentAnalytics 状态饼图 + DomainTable 对齐：3 段语义色
  // (active emerald / for_sale amber / sold teal / expired rose)，统一
  // 100/700 强度。原 sold=teal-100/800 太重 + expired 用 red 而非项目
  // 调色板里的 rose；Table 上又是 stone/rose 50/700 一套，两边漂移。
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-emerald-100 text-emerald-700';
      case 'for_sale':
        return 'bg-amber-100 text-amber-700';
      case 'sold':
        return 'bg-teal-100 text-teal-700';
      case 'expired':
        return 'bg-rose-100 text-rose-700';
      default:
        return 'bg-stone-100 text-stone-700';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(localeTag);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat(localeTag, {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  return (
    <div
      className="bg-white rounded-2xl border border-stone-200/80 p-5 shadow-sm hover:shadow-md transition-all duration-200 relative h-full flex flex-col"
    >
      {/* Actions always visible — touch-friendly. On a translucent backdrop so they remain legible over content. */}
      <div className="absolute top-3 right-3 flex items-center gap-0.5 z-10 bg-white/80 backdrop-blur-sm rounded-lg p-0.5 border border-stone-200/60">
        <button onClick={() => onView(domain)} className="p-1.5 text-stone-500 hover:text-teal-600 hover:bg-teal-50 rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500" aria-label={`${t('domainList.table.viewDetails')} ${domain.domain_name}`} title={t('domainList.table.viewDetails')}>
          <Eye className="h-4 w-4" />
        </button>
        <button onClick={() => onEdit(domain)} className="p-1.5 text-stone-500 hover:text-teal-600 hover:bg-teal-50 rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500" aria-label={`${t('domainList.table.editDomain')} ${domain.domain_name}`} title={t('domainList.table.editDomain')}>
          <Edit className="h-4 w-4" />
        </button>
        {domain.status === 'sold' && (
          <button onClick={() => setShowShareModal(true)} className="p-1.5 text-stone-500 hover:text-teal-600 hover:bg-teal-50 rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500" aria-label={`${t('domainList.table.shareSale')} ${domain.domain_name}`} title={t('domainList.table.shareSale')}>
            <Share2 className="h-4 w-4" />
          </button>
        )}
        <button onClick={() => onDelete(domain.id)} className="p-1.5 text-stone-500 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500" aria-label={`${t('domainList.table.deleteDomain')} ${domain.domain_name}`} title={t('domainList.table.deleteDomain')}>
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="flex items-start gap-3 mb-4 pr-20">
        <div className="p-2 bg-stone-100 rounded-xl flex-shrink-0">
          <Globe className="h-5 w-5 text-stone-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-stone-900 break-words leading-tight">
            {domain.domain_name}
          </h3>
          <p className="text-sm text-stone-500 mt-1 break-words">{domain.registrar}</p>
        </div>
      </div>

      {/* 基本信息 */}
      <div className="space-y-3 mb-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center space-x-2 text-stone-600">
            <Calendar className="h-4 w-4 flex-shrink-0" />
            <span className="truncate">{formatDate(domain.purchase_date || '')}</span>
          </div>
          <div className="flex items-center space-x-2 text-stone-600">
            <DollarSign className="h-4 w-4 flex-shrink-0" />
            <span className="truncate">{formatCurrency(domain.purchase_cost || 0)}</span>
          </div>
        </div>

        <div className="flex items-center space-x-4 text-sm text-stone-600">
          <div className="flex items-center space-x-1">
            <span>{t('domain.renewalCount')}: {domain.renewal_count}</span>
          </div>
          <div className="flex items-center space-x-1 text-teal-600 font-medium">
            <DollarSign className="h-4 w-4" />
            <span className="truncate">{t('domain.totalHoldingCost')}: {formatCurrency(totalHoldingCost)}</span>
          </div>
        </div>
      </div>

      {staleDaysPastExpiry !== null && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200/80 rounded-xl">
          <div className="flex items-start gap-2 text-amber-800">
            <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">
                {t('domain.staleExpiryTitle')
                  .replace('{days}', String(staleDaysPastExpiry))}
              </p>
              <p className="text-xs text-amber-700 mt-1">
                {t('domain.staleExpiryHint')}
              </p>
              <button
                onClick={() => onEdit(domain)}
                className="mt-2 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-amber-100 text-amber-800 hover:bg-amber-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
              >
                <Edit className="h-3 w-3" />
                {t('domain.staleExpiryAction')}
              </button>
            </div>
          </div>
        </div>
      )}

      {domain.status === 'sold' && domain.sale_date && domain.sale_price && (
        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200/80 rounded-xl">
          <div className="flex items-center space-x-2 text-emerald-800 mb-2">
            <DollarSign className="h-4 w-4" />
            <span className="font-medium">{t('domain.sold')}</span>
          </div>
          <div className="grid grid-cols-1 gap-2 text-sm">
            <div className="flex items-center space-x-1">
              <Calendar className="h-4 w-4 text-emerald-600" />
              <span className="text-emerald-700">{t('domain.saleDate')}: {formatDate(domain.sale_date)}</span>
            </div>
            <div className="flex items-center space-x-1">
              <DollarSign className="h-4 w-4 text-emerald-600" />
              <span className="text-emerald-700 font-medium">{t('domain.salePrice')}: {formatCurrency(domain.sale_price)}</span>
            </div>
            <div className="text-sm">
              <span className="text-emerald-700">
                {t('domain.netProfit')}: {formatCurrency(domain.sale_price - totalHoldingCost - (domain.platform_fee || 0))}
              </span>
              <span className="ml-2 text-emerald-600">
                (ROI: {calculateDomainROI(domain, transactions).toFixed(1)}%)
              </span>
            </div>
          </div>
        </div>
      )}

      {(() => {
        const tagsArray = domain.tags;
        return tagsArray.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {tagsArray.map((tag, index) => (
              <span key={index} className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs bg-stone-100 text-stone-700">
                <Tag className="h-3 w-3 mr-1" />
                {tag}
              </span>
            ))}
          </div>
        ) : null;
      })()}

      <div className="mt-auto">
        <div className="flex items-center justify-between">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(domain.status)}`}>
            {statusLabel(domain.status, t)}
          </span>
          {domain.status !== 'sold' && (domain.estimated_value || 0) > 0 && (
            <div className="text-right">
              <p className="text-xs text-stone-500">{t('domainList.table.estimatedValue')}</p>
              <p className="text-sm font-semibold text-stone-900">{formatCurrency(domain.estimated_value!)}</p>
            </div>
          )}
        </div>
      </div>

      {/* Domain Share Modal */}
      <DomainShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        domain={domain}
        transactions={transactions}
      />
    </div>
  );
});

export default DomainCard;