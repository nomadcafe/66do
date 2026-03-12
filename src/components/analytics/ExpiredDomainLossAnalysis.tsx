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

  const currentYear = new Date().getFullYear().toString();
  const thisYearLoss = lossAnalysis.annualLoss[currentYear] || 0;
  const thisYearCount = lossAnalysis.expiredDomains.filter((d) => d.lossYear === currentYear).length;
  const averageLossPerDomain =
    lossAnalysis.expiredDomains.length > 0
      ? lossAnalysis.totalLoss / lossAnalysis.expiredDomains.length
      : 0;

  const statusCounts = domains.reduce((acc, domain) => {
    acc[domain.status] = (acc[domain.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  if (lossAnalysis.expiredDomains.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-stone-200/80 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-emerald-100 rounded-xl">
              <AlertTriangle className="h-6 w-6 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-stone-900">
                {t('analytics.expiredDomainLoss')}
              </h3>
              <p className="text-sm text-stone-600">{t('analytics.expiredDomainLossDesc')}</p>
            </div>
          </div>
        </div>

        <div className="text-center py-8">
          <div className="inline-flex rounded-2xl bg-emerald-50 p-4 mb-4">
            <AlertTriangle className="h-14 w-14 text-emerald-500" aria-hidden />
          </div>
          <h4 className="text-xl font-semibold text-stone-900 mb-2">{t('analytics.noExpiredDomains')}</h4>
          <p className="text-stone-600 mb-6">{t('analytics.noExpiredDomainsDesc')}</p>

          <div className="bg-stone-50 rounded-xl p-4 max-w-md mx-auto border border-stone-100">
            <h5 className="text-sm font-medium text-stone-700 mb-3">{t('analytics.domainStatusStats')}</h5>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {Object.entries(statusCounts).map(([status, count]) => (
                <div key={status} className="flex justify-between">
                  <span className="text-stone-600">{status}:</span>
                  <span className="font-medium text-stone-900">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-stone-200/80 p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-red-100 rounded-xl">
            <TrendingDown className="h-6 w-6 text-red-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-stone-900">{t('analytics.expiredDomainLoss')}</h3>
            <p className="text-sm text-stone-600">{t('analytics.expiredDomainLossDesc')}</p>
          </div>
        </div>
      </div>
      <p className="text-xs text-stone-500 mb-6 rounded-lg bg-stone-50 border border-stone-100 px-3 py-2">
        {t('analytics.expiredLossDefinition')}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-red-50 rounded-xl p-4 border border-red-100/80">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-red-700 mb-1">{t('analytics.thisYearTotalLoss')}</p>
              <p className="text-2xl font-bold text-red-900">{formatCurrency(thisYearLoss)}</p>
            </div>
            <DollarSign className="h-8 w-8 text-red-500" />
          </div>
        </div>

        <div className="bg-amber-50 rounded-xl p-4 border border-amber-100/80">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-amber-800 mb-1">{t('analytics.expiredDomainsCount')}</p>
              <p className="text-2xl font-bold text-amber-950">{lossAnalysis.expiredDomains.length}</p>
            </div>
            <AlertTriangle className="h-8 w-8 text-amber-600" />
          </div>
        </div>

        <div className="bg-stone-50 rounded-xl p-4 border border-stone-200/80">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-stone-700 mb-1">{t('analytics.averageLossPerDomain')}</p>
              {thisYearCount > 0 ? (
                <p className="text-xs text-stone-600 mb-0.5">{t('analytics.thisYear')}</p>
              ) : null}
              <p className="text-2xl font-bold text-stone-900">
                {formatCurrency(
                  thisYearCount > 0 ? thisYearLoss / thisYearCount : averageLossPerDomain
                )}
              </p>
              {thisYearCount === 0 && lossAnalysis.expiredDomains.length > 0 ? (
                <p className="text-xs text-stone-500 mt-1">{t('analytics.cumulativeAverageHint')}</p>
              ) : null}
            </div>
            <Calendar className="h-8 w-8 text-stone-500" />
          </div>
        </div>
      </div>

      {lossAnalysis.lossByYear.length > 0 && (
        <div className="mb-6">
          <h4 className="text-md font-semibold text-stone-900 mb-4">{t('analytics.annualLossTrend')}</h4>
          <div className="space-y-3">
            {lossAnalysis.lossByYear.map((yearData) => (
              <div
                key={yearData.year}
                className="flex items-center justify-between p-3 bg-stone-50 rounded-xl border border-stone-100"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-3 h-3 bg-red-500 rounded-full" />
                  <span className="font-medium text-stone-900">
                    {yearData.year === 'unknown' ? t('analytics.lossYearUnknown') : yearData.year}
                  </span>
                  <span className="text-sm text-stone-500">
                    ({yearData.domainCount} {t('analytics.domains')})
                  </span>
                </div>
                <span className="font-semibold text-red-600">{formatCurrency(yearData.loss)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h4 className="text-md font-semibold text-stone-900 mb-4">{t('analytics.expiredDomainsDetails')}</h4>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {lossAnalysis.expiredDomains.map((domain) => (
            <div
              key={domain.id}
              className="flex items-center justify-between p-3 bg-stone-50 rounded-xl border border-stone-100"
            >
              <div className="flex items-center space-x-3 min-w-0">
                <div className="w-2 h-2 bg-red-500 rounded-full shrink-0" />
                <span className="font-medium text-stone-900 truncate">{domain.domain_name}</span>
                <span className="text-sm text-stone-500 shrink-0">
                  {domain.expiryDate
                    ? new Date(domain.expiryDate).toLocaleDateString()
                    : t('analytics.expiryDateMissing')}
                </span>
              </div>
              <span className="font-semibold text-red-600 shrink-0 ml-2">
                {formatCurrency(domain.totalInvestment)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
