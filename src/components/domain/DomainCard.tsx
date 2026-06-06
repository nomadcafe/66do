'use client';

import { useState, useMemo, memo } from 'react';
import { Globe, Calendar, Tag, Edit, Trash2, Eye, Share2, AlertTriangle } from 'lucide-react';
import DomainShareModal from '../share/DomainShareModal';
import { DomainWithTags } from '../../types/dashboard';
import { useI18nContext } from '../../contexts/I18nProvider';
import { calculateDomainROI } from '../../lib/financialCalculations';
import { totalHoldingCostForDomain } from '../../lib/renewalCostBasis';
import { domainStatusLabel as statusLabel } from '../../lib/domainStatusLabel';
import { daysUntilEffectiveExpiry } from '../../lib/effectiveExpiry';
import { isExpiredButNotMarked } from '../../lib/domainLossStatus';
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

  // 与 status chip 滤镜带 + Hero 持仓 donut + DomainTable + IA 状态饼图对齐：
  // active=teal（持有中=品牌主色）, for_sale=amber（待处理）,
  // sold=emerald（已变现=正盈亏色）, expired=rose（损失/告警）。
  // 统一 100/700 强度，跟项目其他地方的 status 色保持一致。
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

  // 左边条颜色：跟 status pill 同语义，更饱和（用 500 而非 100/700 双色）。
  // 让用户扫一列卡片时一眼识别每张的 status，不用读底部 pill 文字。
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
      className={`relative h-full flex flex-col bg-white rounded-2xl border border-stone-200/80 border-l-4 ${getEdgeAccent(
        domain.status
      )} p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 hover:border-stone-300 transition-all duration-200`}
    >
      {/* Actions in top-right. The pr-20 below reserves header space so we
          don't need the backdrop-blur container anymore — actions sit in
          their own clear zone. */}
      <div className="absolute top-3 right-3 flex items-center gap-0.5 z-10">
        <button onClick={() => onView(domain)} className="p-1.5 text-stone-400 hover:text-teal-600 hover:bg-teal-50 rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500" aria-label={`${t('domainList.table.viewDetails')} ${domain.domain_name}`} title={t('domainList.table.viewDetails')}>
          <Eye className="h-4 w-4" />
        </button>
        <button onClick={() => onEdit(domain)} className="p-1.5 text-stone-400 hover:text-teal-600 hover:bg-teal-50 rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500" aria-label={`${t('domainList.table.editDomain')} ${domain.domain_name}`} title={t('domainList.table.editDomain')}>
          <Edit className="h-4 w-4" />
        </button>
        {domain.status === 'sold' && (
          <button onClick={() => setShowShareModal(true)} className="p-1.5 text-stone-400 hover:text-teal-600 hover:bg-teal-50 rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500" aria-label={`${t('domainList.table.shareSale')} ${domain.domain_name}`} title={t('domainList.table.shareSale')}>
            <Share2 className="h-4 w-4" />
          </button>
        )}
        <button onClick={() => onDelete(domain.id)} className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500" aria-label={`${t('domainList.table.deleteDomain')} ${domain.domain_name}`} title={t('domainList.table.deleteDomain')}>
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

      {/* Metadata block: headline = total holding cost (the "what this domain
          actually costs me" number), caption = supporting facts (purchase
          date, original cost, renewal count). DollarSign icons removed —
          tabular nums + the dollar sign in formatCurrency carry the meaning. */}
      <div className="mb-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-500">
          {t('domain.totalHoldingCost')}
        </p>
        <p className="mt-0.5 text-xl font-bold tabular-nums text-stone-900">
          {formatCurrency(totalHoldingCost)}
        </p>
        <p className="mt-1.5 text-xs text-stone-500 flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="inline-flex items-center gap-1">
            <Calendar className="h-3 w-3 flex-shrink-0" />
            {formatDate(domain.purchase_date || '')}
          </span>
          <span className="text-stone-300">·</span>
          <span className="tabular-nums">{formatCurrency(domain.purchase_cost || 0)}</span>
          <span className="text-stone-300">·</span>
          <span>
            {t('domain.renewalCount')}: {domain.renewal_count}
          </span>
        </p>
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

      {domain.status === 'sold' && domain.sale_date && domain.sale_price && (() => {
        const netProfit = domain.sale_price - totalHoldingCost - (domain.platform_fee || 0);
        const roi = calculateDomainROI(domain, transactions);
        const profitPositive = netProfit >= 0;
        return (
          <div
            className={`mb-4 p-4 rounded-xl border ${
              profitPositive
                ? 'bg-emerald-50/70 border-emerald-200/80'
                : 'bg-rose-50/70 border-rose-200/80'
            }`}
          >
            <p
              className={`text-[10px] font-semibold uppercase tracking-[0.14em] ${
                profitPositive ? 'text-emerald-700/80' : 'text-rose-700/80'
              }`}
            >
              {t('domain.netProfit')}
            </p>
            <div className="mt-0.5 flex items-baseline gap-2">
              <p
                className={`text-2xl font-bold tabular-nums ${
                  profitPositive ? 'text-emerald-700' : 'text-rose-700'
                }`}
              >
                {profitPositive ? '+' : '−'}
                {formatCurrency(Math.abs(netProfit))}
              </p>
              <span
                className={`text-xs font-medium tabular-nums ${
                  profitPositive ? 'text-emerald-700/80' : 'text-rose-700/80'
                }`}
              >
                ROI {profitPositive ? '+' : ''}{roi.toFixed(1)}%
              </span>
            </div>
            <p className={`mt-1.5 text-xs ${profitPositive ? 'text-emerald-700/70' : 'text-rose-700/70'}`}>
              {t('domain.salePrice')} {formatCurrency(domain.sale_price)}
              {' · '}
              {formatDate(domain.sale_date)}
            </p>
          </div>
        );
      })()}

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
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5 min-w-0">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(domain.status)}`}>
              {statusLabel(domain.status, t)}
            </span>
            {isExpiredButNotMarked(domain) && (
              <span
                title={t('common.overdueUnrenewedTooltip')}
                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200"
              >
                {t('common.overdueUnrenewed')}
              </span>
            )}
            {(() => {
              // sold 域名如果还在分期收款，加一枚薄荷色 chip 提示。同 DomainTable
              // 的视觉语言一致，让用户扫卡片网格也能一眼看到"还有钱在路上"。
              const activeInstallment = transactions.find(
                (tx) =>
                  tx.domain_id === domain.id &&
                  tx.type === 'sell' &&
                  tx.payment_plan === 'installment' &&
                  tx.installment_status !== 'cancelled' &&
                  tx.installment_status !== 'completed'
              );
              if (!activeInstallment) return null;
              const total = activeInstallment.installment_period ?? 0;
              const paid = activeInstallment.receipts?.length ?? 0;
              if (total > 0 && paid >= total) return null;
              return (
                <span
                  className="inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                  title={t('transaction.installmentConfig')}
                >
                  {t('transaction.installment')} {paid}/{total}
                </span>
              );
            })()}
          </div>
          {domain.status !== 'sold' && (domain.estimated_value || 0) > 0 && (
            <div className="text-right shrink-0">
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