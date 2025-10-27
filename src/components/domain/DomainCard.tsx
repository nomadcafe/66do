'use client';

import { useState } from 'react';
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

export default function DomainCard({ domain, onEdit, onDelete, onView }: DomainCardProps) {
  const [showActions, setShowActions] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const { t } = useI18nContext();

  // 计算总持有成本
  const calculateTotalHoldingCost = () => {
    const totalRenewalCost = domain.renewal_count * (domain.renewal_cost || 0);
    return (domain.purchase_cost || 0) + totalRenewalCost;
  };

  const totalHoldingCost = calculateTotalHoldingCost();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'for_sale':
        return 'bg-yellow-100 text-yellow-800';
      case 'sold':
        return 'bg-blue-100 text-blue-800';
      case 'expired':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
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
      className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3 flex-1">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Globe className="h-5 w-5 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-gray-900 truncate">
              {domain.domain_name}
            </h3>
            <p className="text-sm text-gray-600 mt-1">{domain.registrar}</p>
            
            <div className="flex items-center space-x-4 mt-3">
              <div className="flex items-center space-x-1 text-sm text-gray-600">
                <Calendar className="h-4 w-4" />
                <span>{formatDate(domain.purchase_date || '')}</span>
              </div>
              <div className="flex items-center space-x-1 text-sm text-gray-600">
                <DollarSign className="h-4 w-4" />
                <span>{formatCurrency(domain.purchase_cost || 0)}</span>
              </div>
            </div>

        <div className="flex items-center space-x-4 mt-2">
          <div className="flex items-center space-x-1 text-sm text-gray-600">
            <DollarSign className="h-4 w-4" />
            <span>Renewal: {formatCurrency(domain.renewal_cost || 0)}</span>
          </div>
          <div className="flex items-center space-x-1 text-sm text-gray-600">
            <Calendar className="h-4 w-4" />
            <span>Every {domain.renewal_cycle} year{domain.renewal_cycle > 1 ? 's' : ''}</span>
          </div>
        </div>

        <div className="flex items-center space-x-4 mt-2">
          <div className="flex items-center space-x-1 text-sm text-blue-600">
            <span>{t('domain.renewalCount')}: {domain.renewal_count}</span>
          </div>
          <div className="flex items-center space-x-1 text-sm text-purple-600 font-medium">
            <DollarSign className="h-4 w-4" />
            <span>{t('domain.totalHoldingCost')}: {formatCurrency(totalHoldingCost)}</span>
          </div>
        </div>

        {/* 出售信息显示 */}
        {domain.status === 'sold' && domain.sale_date && domain.sale_price && (
          <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center space-x-2 text-green-800">
              <DollarSign className="h-4 w-4" />
              <span className="font-medium">{t('domain.sold')}</span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center space-x-1">
                <Calendar className="h-4 w-4 text-green-600" />
                <span className="text-green-700">{t('domain.saleDate')}: {formatDate(domain.sale_date)}</span>
              </div>
              <div className="flex items-center space-x-1">
                <DollarSign className="h-4 w-4 text-green-600" />
                <span className="text-green-700 font-medium">{t('domain.salePrice')}: {formatCurrency(domain.sale_price)}</span>
              </div>
            </div>
            <div className="mt-2 text-sm">
              <span className="text-green-700">
                {t('domain.netProfit')}: {formatCurrency(domain.sale_price - totalHoldingCost - (domain.platform_fee || 0))}
              </span>
              <span className="ml-2 text-green-600">
                (ROI: {calculateDomainROI(domain).toFixed(1)}%)
              </span>
            </div>
          </div>
        )}

            {(() => {
              // DomainWithTags已经确保tags是string[]
              const tagsArray = domain.tags;
              
              return tagsArray.length > 0 ? (
                <div className="flex flex-wrap gap-1 mt-3">
                  {tagsArray.map((tag, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-800"
                    >
                      <Tag className="h-3 w-3 mr-1" />
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null;
            })()}

            <div className="flex items-center justify-between mt-4">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(domain.status)}`}>
                {domain.status}
              </span>
              <div className="text-right">
                <p className="text-sm text-gray-600">Estimated Value</p>
                <p className="text-lg font-semibold text-gray-900">
                  {formatCurrency(domain.estimated_value || 0)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {showActions && (
          <div className="flex items-center space-x-2 ml-4">
            <button
              onClick={() => onView(domain)}
              className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
              title="View Details"
            >
              <Eye className="h-4 w-4" />
            </button>
            <button
              onClick={() => onEdit(domain)}
              className="p-2 text-gray-400 hover:text-yellow-600 hover:bg-yellow-50 rounded-lg"
              title="Edit Domain"
            >
              <Edit className="h-4 w-4" />
            </button>
            {domain.status === 'sold' && (
              <button
                onClick={() => setShowShareModal(true)}
                className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg"
                title="Share Success"
              >
                <Share2 className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={() => onDelete(domain.id)}
              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
              title="Delete Domain"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Domain Share Modal */}
      <DomainShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        domain={domain}
      />
    </div>
  );
}
