'use client';

import { useState, useMemo, memo } from 'react';
import { Globe, Calendar, DollarSign, Tag, Edit, Trash2, Eye, Share2 } from 'lucide-react';
import DomainShareModal from '../share/DomainShareModal';
import { DomainWithTags } from '../../types/dashboard';
import { useI18nContext } from '../../contexts/I18nProvider';
import { calculateDomainROI } from '../../lib/financialCalculations';


interface DomainCardProps {
  domain: DomainWithTags;
  onEdit: (domain: DomainWithTags) => void;
  onDelete: (id: string) => void;
  onView: (domain: DomainWithTags) => void;
}

const DomainCard = memo(function DomainCard({ domain, onEdit, onDelete, onView }: DomainCardProps) {
  const [showShareModal, setShowShareModal] = useState(false);
  const { t } = useI18nContext();

  // 计算总持有成本 - 使用useMemo优化
  const totalHoldingCost = useMemo(() => {
    const totalRenewalCost = domain.renewal_count * (domain.renewal_cost || 0);
    return (domain.purchase_cost || 0) + totalRenewalCost;
  }, [domain.purchase_cost, domain.renewal_count, domain.renewal_cost]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-emerald-100 text-emerald-800';
      case 'for_sale':
        return 'bg-amber-100 text-amber-800';
      case 'sold':
        return 'bg-teal-100 text-teal-800';
      case 'expired':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-stone-100 text-stone-700';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  return (
    <div
      className="bg-white rounded-2xl border border-stone-200/80 p-5 shadow-sm hover:shadow-md transition-all duration-200 relative group h-full flex flex-col"
    >
      <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
        <button onClick={() => onView(domain)} className="p-1.5 text-stone-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors" title="View Details">
          <Eye className="h-4 w-4" />
        </button>
        <button onClick={() => onEdit(domain)} className="p-1.5 text-stone-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors" title="Edit Domain">
          <Edit className="h-4 w-4" />
        </button>
        {domain.status === 'sold' && (
          <button onClick={() => setShowShareModal(true)} className="p-1.5 text-stone-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors" title="Share Success">
            <Share2 className="h-4 w-4" />
          </button>
        )}
        <button onClick={() => onDelete(domain.id)} className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete Domain">
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
          <p className="text-sm text-gray-500 mt-1 break-words">{domain.registrar}</p>
        </div>
      </div>

      {/* 基本信息 */}
      <div className="space-y-3 mb-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center space-x-2 text-gray-600">
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
                (ROI: {calculateDomainROI(domain).toFixed(1)}%)
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
            {domain.status.replace('_', ' ')}
          </span>
          <div className="text-right">
            <p className="text-xs text-stone-500">Estimated Value</p>
            <p className="text-sm font-semibold text-stone-900">{formatCurrency(domain.estimated_value || 0)}</p>
          </div>
        </div>
      </div>

      {/* Domain Share Modal */}
      <DomainShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        domain={domain}
      />
    </div>
  );
});

export default DomainCard;