'use client';

import React from 'react';
import { calculateExpiredDomainLoss, formatCurrency } from '../../lib/financialCalculations';
import { useI18nContext } from '../../contexts/I18nProvider';
import { TrendingDown, Calendar, DollarSign, AlertTriangle } from 'lucide-react';

interface ExpiredDomainLossAnalysisProps {
  domains: Array<{
    id: string;
    domain_name: string;
    purchase_cost?: number | null;
    renewal_cost?: number | null;
    renewal_count: number;
    status: string;
    expiry_date?: string | null;
    purchase_date?: string | null;
  }>;
}

export default function ExpiredDomainLossAnalysis({ domains }: ExpiredDomainLossAnalysisProps) {
  const { t } = useI18nContext();
  const lossAnalysis = calculateExpiredDomainLoss(domains);

  // 统计域名状态
  const statusCounts = domains.reduce((acc, domain) => {
    acc[domain.status] = (acc[domain.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  if (lossAnalysis.expiredDomains.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <AlertTriangle className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                {t('analytics.expiredDomainLoss')}
              </h3>
              <p className="text-sm text-gray-600">
                {t('analytics.expiredDomainLossDesc')}
              </p>
            </div>
          </div>
        </div>

        <div className="text-center py-8">
          <AlertTriangle className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h4 className="text-xl font-semibold text-gray-900 mb-2">
            {t('analytics.noExpiredDomains')}
          </h4>
          <p className="text-gray-600 mb-6">
            {t('analytics.noExpiredDomainsDesc')}
          </p>
          
          {/* 显示域名状态统计 */}
          <div className="bg-gray-50 rounded-lg p-4 max-w-md mx-auto">
            <h5 className="text-sm font-medium text-gray-700 mb-3">{t('analytics.domainStatusStats')}</h5>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {Object.entries(statusCounts).map(([status, count]) => (
                <div key={status} className="flex justify-between">
                  <span className="text-gray-600">{status}:</span>
                  <span className="font-medium">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-red-100 rounded-lg">
            <TrendingDown className="h-6 w-6 text-red-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {t('analytics.expiredDomainLoss')}
            </h3>
            <p className="text-sm text-gray-600">
              {t('analytics.expiredDomainLossDesc')}
            </p>
          </div>
        </div>
      </div>

      {/* 总损失统计 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-red-50 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-red-600 mb-1">
                {t('analytics.totalLoss')}
              </p>
              <p className="text-2xl font-bold text-red-900">
                {formatCurrency(lossAnalysis.totalLoss)}
              </p>
            </div>
            <DollarSign className="h-8 w-8 text-red-500" />
          </div>
        </div>

        <div className="bg-orange-50 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-orange-600 mb-1">
                {t('analytics.expiredDomainsCount')}
              </p>
              <p className="text-2xl font-bold text-orange-900">
                {lossAnalysis.expiredDomains.length}
              </p>
            </div>
            <AlertTriangle className="h-8 w-8 text-orange-500" />
          </div>
        </div>

        <div className="bg-blue-50 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-600 mb-1">
                {t('analytics.averageLossPerDomain')}
              </p>
              <p className="text-2xl font-bold text-blue-900">
                {formatCurrency(lossAnalysis.totalLoss / lossAnalysis.expiredDomains.length)}
              </p>
            </div>
            <Calendar className="h-8 w-8 text-blue-500" />
          </div>
        </div>
      </div>

      {/* 年度损失趋势 */}
      {lossAnalysis.lossByYear.length > 0 && (
        <div className="mb-6">
          <h4 className="text-md font-semibold text-gray-900 mb-4">
            {t('analytics.annualLossTrend')}
          </h4>
          <div className="space-y-3">
            {lossAnalysis.lossByYear.map((yearData) => (
              <div key={yearData.year} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <span className="font-medium text-gray-900">{yearData.year}</span>
                  <span className="text-sm text-gray-600">
                    ({yearData.domainCount} {t('analytics.domains')})
                  </span>
                </div>
                <span className="font-semibold text-red-600">
                  {formatCurrency(yearData.loss)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 过期域名详情 */}
      <div>
        <h4 className="text-md font-semibold text-gray-900 mb-4">
          {t('analytics.expiredDomainsDetails')}
        </h4>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {lossAnalysis.expiredDomains.map((domain, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                <span className="font-medium text-gray-900">{domain.domain_name}</span>
                <span className="text-sm text-gray-500">
                  {new Date(domain.expiryDate).toLocaleDateString()}
                </span>
              </div>
              <span className="font-semibold text-red-600">
                {formatCurrency(domain.totalInvestment)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
