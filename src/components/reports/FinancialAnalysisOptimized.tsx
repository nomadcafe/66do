'use client';

import { useState } from 'react';
import { DomainWithTags, TransactionWithRequiredFields } from '../../types/dashboard';
import { 
  TrendingUp, 
  DollarSign, 
  CheckCircle,
  XCircle,
  Target
} from 'lucide-react';
import { useComprehensiveFinancialAnalysis } from '../../hooks/useFinancialCalculations';
// import { Domain } from '../../types/domain';
// import { DomainTransaction as Transaction } from '../../types/domain';
import { useI18nContext } from '../../contexts/I18nProvider';

interface FinancialAnalysisProps {
  domains: DomainWithTags[];
  transactions: TransactionWithRequiredFields[];
}

interface AnalysisResult {
  overall: {
    totalInvestment: number;
    totalRevenue: number;
    totalProfit: number;
    roi: number;
    profitMargin: number;
    annualizedReturn: number;
    sharpeRatio: number;
    maxDrawdown: number;
    volatility: number;
    winRate: number;
    avgHoldingPeriod: number;
    bestPerformingDomain: string;
    worstPerformingDomain: string;
  };
  performance: {
    domainPerformance: Array<{
      domain: DomainWithTags;
      profit: number;
      roi: number;
    }>;
    bestDomain: string;
    worstDomain: string;
    avgRoi: number;
    totalDomains: number;
    soldDomains: number;
    activeDomains: number;
  };
  recommendationKeys: Array<'negativeRoi' | 'lowWinRate' | 'longHolding' | 'performingWell'>;
}

export default function FinancialAnalysis({ domains, transactions }: FinancialAnalysisProps) {
  const { t } = useI18nContext();
  const [selectedMetric, setSelectedMetric] = useState('overall');
  
  // 使用共享的计算逻辑
  const financialAnalysis = useComprehensiveFinancialAnalysis(domains, transactions);
  
  const recommendationKeys: Array<'negativeRoi' | 'lowWinRate' | 'longHolding' | 'performingWell'> = [];
  if (financialAnalysis.basic.roi < 0) recommendationKeys.push('negativeRoi');
  if (financialAnalysis.advanced.winRate < 50) recommendationKeys.push('lowWinRate');
  if (financialAnalysis.advanced.avgHoldingPeriod > 365) recommendationKeys.push('longHolding');
  if (recommendationKeys.length === 0) recommendationKeys.push('performingWell');

  const domainPerf = financialAnalysis.domainPerformance;
  const avgRoi =
    domainPerf.length > 0
      ? domainPerf.reduce((sum, p) => sum + p.roi, 0) / domainPerf.length
      : 0;

  const analysisResult: AnalysisResult = {
    overall: {
      totalInvestment: financialAnalysis.basic.totalInvestment,
      totalRevenue: financialAnalysis.basic.totalRevenue,
      totalProfit: financialAnalysis.basic.totalProfit,
      roi: financialAnalysis.basic.roi,
      profitMargin: financialAnalysis.basic.profitMargin,
      annualizedReturn: financialAnalysis.advanced.annualizedReturn,
      sharpeRatio: financialAnalysis.advanced.sharpeRatio,
      maxDrawdown: financialAnalysis.advanced.maxDrawdown,
      volatility: financialAnalysis.advanced.volatility,
      winRate: financialAnalysis.advanced.winRate,
      avgHoldingPeriod: financialAnalysis.advanced.avgHoldingPeriod,
      bestPerformingDomain: financialAnalysis.advanced.bestPerformingDomain,
      worstPerformingDomain: financialAnalysis.advanced.worstPerformingDomain
    },
    performance: {
      domainPerformance: financialAnalysis.domainPerformance,
      bestDomain: financialAnalysis.advanced.bestPerformingDomain,
      worstDomain: financialAnalysis.advanced.worstPerformingDomain,
      avgRoi,
      totalDomains: domains.length,
      soldDomains: domains.filter(d => d.status === 'sold').length,
      activeDomains: domains.filter(d => d.status === 'active').length
    },
    recommendationKeys
  };

  const getPerformanceIcon = (roi: number) => {
    if (roi > 50) {
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    } else if (roi > 0) {
      return <Target className="h-5 w-5 text-yellow-500" />;
    } else {
      return <XCircle className="h-5 w-5 text-red-500" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* 分析头部 */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{t('reports.financialAnalysis')}</h2>
            <p className="text-gray-600">{t('reports.advancedPortfolioAnalysis')}</p>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setSelectedMetric('overall')}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                selectedMetric === 'overall' 
                  ? 'bg-blue-100 text-blue-700' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
{t('reports.overall')}
            </button>
            <button
              onClick={() => setSelectedMetric('performance')}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                selectedMetric === 'performance' 
                  ? 'bg-blue-100 text-blue-700' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
{t('reports.performance')}
            </button>
          </div>
        </div>
      </div>

      {/* 总体指标 */}
      {selectedMetric === 'overall' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="flex items-center">
              <DollarSign className="h-8 w-8 text-green-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Investment</p>
                <p className="text-2xl font-bold text-gray-900">
                  ${analysisResult.overall.totalInvestment.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="flex items-center">
              <TrendingUp className="h-8 w-8 text-blue-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                <p className="text-2xl font-bold text-gray-900">
                  ${analysisResult.overall.totalRevenue.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="flex items-center">
              <Target className="h-8 w-8 text-purple-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">ROI</p>
                <p className={`text-2xl font-bold ${
                  analysisResult.overall.roi >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {analysisResult.overall.roi.toFixed(1)}%
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="flex items-center">
              <Target className="h-8 w-8 text-orange-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Win Rate</p>
                <p className={`text-2xl font-bold ${
                  analysisResult.overall.winRate >= 50 ? 'text-green-600' :
                  analysisResult.overall.winRate >= 30 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {analysisResult.overall.winRate.toFixed(1)}%
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 表现分析 */}
      {selectedMetric === 'performance' && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Domain Performance</h3>
          <div className="space-y-4">
            {analysisResult.performance.domainPerformance.slice(0, 10).map((item, index) => (
              <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  {getPerformanceIcon(item.roi)}
                  <div>
                    <p className="font-medium text-gray-900">{item.domain.domain_name}</p>
                    <p className="text-sm text-gray-600">ROI: {item.roi.toFixed(1)}%</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-semibold ${
                    item.profit >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    ${item.profit.toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('reports.portfolioSnapshot')}</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">{t('reports.averageHoldingPeriod')}</span>
              <span className="font-semibold">
                {Math.round(analysisResult.overall.avgHoldingPeriod)}
                {t('analytics.daysUnit')}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">{t('analytics.winRate')}</span>
              <span className="font-semibold">{analysisResult.overall.winRate.toFixed(1)}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">{t('reports.roi')}</span>
              <span className={`font-semibold ${analysisResult.overall.roi >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {analysisResult.overall.roi.toFixed(1)}%
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">{t('reports.activeDomains')}</span>
              <span className="font-semibold">{analysisResult.performance.activeDomains}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">{t('reports.soldDomains')}</span>
              <span className="font-semibold">{analysisResult.performance.soldDomains}</span>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('reports.recommendations')}</h3>
          <div className="space-y-3">
            {analysisResult.recommendationKeys.map((key, index) => (
              <div key={index} className="flex items-start space-x-3 p-3 bg-blue-50 rounded-lg">
                <div className="flex-shrink-0">
                  <div className="w-2 h-2 bg-blue-600 rounded-full mt-2"></div>
                </div>
                <p className="text-sm text-gray-700">{t(`reports.rec.${key}`)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
