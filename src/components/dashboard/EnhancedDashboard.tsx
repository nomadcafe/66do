'use client';

import React, { useState, useMemo } from 'react';
import { useI18nContext } from '../../contexts/I18nProvider';
import { DomainWithTags, TransactionWithRequiredFields } from '../../types/dashboard';
import EnhancedFinancialReport from '../reports/EnhancedFinancialReport';
import AdvancedDomainSearch from '../search/AdvancedDomainSearch';
import { 
  BarChart3, 
  Search, 
  FileText, 
  TrendingUp, 
  Download,
  Eye,
  EyeOff
} from 'lucide-react';

interface EnhancedDashboardProps {
  domains: DomainWithTags[];
  transactions: TransactionWithRequiredFields[];
}

export default function EnhancedDashboard({ 
  domains, 
  transactions
}: EnhancedDashboardProps) {
  const { t } = useI18nContext();
  const [activeTab, setActiveTab] = useState<'overview' | 'search' | 'reports'>('overview');
  const [searchResults, setSearchResults] = useState<DomainWithTags[]>(domains);
  const [transactionResults, setTransactionResults] = useState<TransactionWithRequiredFields[]>(transactions);
  const [showAdvancedFeatures, setShowAdvancedFeatures] = useState(false);

  // 计算概览统计
  const overviewStats = useMemo(() => {
    const activeDomains = domains.filter(d => d.status === 'active');
    const soldDomains = domains.filter(d => d.status === 'sold');
    const expiredDomains = domains.filter(d => d.status === 'expired');
    const forSaleDomains = domains.filter(d => d.status === 'for_sale');

    const totalInvestment = domains.reduce((sum, domain) => {
      return sum + (domain.purchase_cost || 0) + (domain.renewal_count * (domain.renewal_cost || 0));
    }, 0);

    const totalRevenue = transactions
      .filter(t => t.type === 'sell')
      .reduce((sum, t) => sum + (t.net_amount || t.amount), 0);

    const totalProfit = totalRevenue - totalInvestment;
    const roi = totalInvestment > 0 ? (totalProfit / totalInvestment) * 100 : 0;

    return {
      totalDomains: domains.length,
      activeDomains: activeDomains.length,
      soldDomains: soldDomains.length,
      expiredDomains: expiredDomains.length,
      forSaleDomains: forSaleDomains.length,
      totalInvestment,
      totalRevenue,
      totalProfit,
      roi,
    };
  }, [domains, transactions]);

  // 处理搜索结果更新
  const handleSearchResults = (results: DomainWithTags[]) => {
    setSearchResults(results);
  };

  const handleTransactionResults = (results: TransactionWithRequiredFields[]) => {
    setTransactionResults(results);
  };

  // 导出数据
  const handleExportData = () => {
    const data = {
      domains: searchResults,
      transactions: transactionResults,
      overviewStats,
      exportedAt: new Date().toISOString(),
    };
    
    const dataStr = JSON.stringify(data, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `enhanced-dashboard-data-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* 头部控制面板 */}
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{t('dashboard.enhancedDashboard')}</h1>
            <p className="text-gray-600 mt-1">{t('dashboard.advancedFeatures')}</p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowAdvancedFeatures(!showAdvancedFeatures)}
              className={`flex items-center px-4 py-2 rounded-lg ${
                showAdvancedFeatures 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {showAdvancedFeatures ? (
                <EyeOff className="w-4 h-4 mr-2" />
              ) : (
                <Eye className="w-4 h-4 mr-2" />
              )}
              {showAdvancedFeatures ? t('dashboard.hideAdvanced') : t('dashboard.showAdvanced')}
            </button>
            <button
              onClick={handleExportData}
              className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <Download className="w-4 h-4 mr-2" />
              {t('dashboard.exportData')}
            </button>
          </div>
        </div>

        {/* 标签页导航 */}
        <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'overview'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <BarChart3 className="w-4 h-4 mr-2" />
            {t('dashboard.overview')}
          </button>
          <button
            onClick={() => setActiveTab('search')}
            className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'search'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Search className="w-4 h-4 mr-2" />
            {t('dashboard.search')}
          </button>
          <button
            onClick={() => setActiveTab('reports')}
            className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'reports'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <FileText className="w-4 h-4 mr-2" />
            {t('dashboard.reports')}
          </button>
        </div>
      </div>

      {/* 概览标签页 */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* 统计卡片 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{t('dashboard.totalDomains')}</p>
                  <p className="text-2xl font-bold text-gray-900">{overviewStats.totalDomains}</p>
                </div>
                <div className="p-3 bg-blue-100 rounded-full">
                  <BarChart3 className="w-6 h-6 text-blue-600" />
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">{t('dashboard.active')}: </span>
                  <span className="font-medium text-green-600">{overviewStats.activeDomains}</span>
                </div>
                <div>
                  <span className="text-gray-500">{t('dashboard.sold')}: </span>
                  <span className="font-medium text-blue-600">{overviewStats.soldDomains}</span>
                </div>
                <div>
                  <span className="text-gray-500">{t('dashboard.forSale')}: </span>
                  <span className="font-medium text-yellow-600">{overviewStats.forSaleDomains}</span>
                </div>
                <div>
                  <span className="text-gray-500">{t('dashboard.expired')}: </span>
                  <span className="font-medium text-red-600">{overviewStats.expiredDomains}</span>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{t('dashboard.totalInvestment')}</p>
                  <p className="text-2xl font-bold text-gray-900">
                    ${overviewStats.totalInvestment.toLocaleString()}
                  </p>
                </div>
                <div className="p-3 bg-green-100 rounded-full">
                  <TrendingUp className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{t('dashboard.totalRevenue')}</p>
                  <p className="text-2xl font-bold text-gray-900">
                    ${overviewStats.totalRevenue.toLocaleString()}
                  </p>
                </div>
                <div className="p-3 bg-purple-100 rounded-full">
                  <TrendingUp className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{t('dashboard.roi')}</p>
                  <p className={`text-2xl font-bold ${overviewStats.roi >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {overviewStats.roi.toFixed(1)}%
                  </p>
                </div>
                <div className={`p-3 rounded-full ${overviewStats.roi >= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
                  {overviewStats.roi >= 0 ? (
                    <TrendingUp className="w-6 h-6 text-green-600" />
                  ) : (
                    <TrendingUp className="w-6 h-6 text-red-600 rotate-180" />
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 快速操作 */}
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('dashboard.quickActions')}</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                onClick={() => setActiveTab('search')}
                className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Search className="w-5 h-5 text-blue-600 mr-3" />
                <div className="text-left">
                  <p className="font-medium text-gray-900">{t('dashboard.advancedSearch')}</p>
                  <p className="text-sm text-gray-500">{t('dashboard.searchDescription')}</p>
                </div>
              </button>
              <button
                onClick={() => setActiveTab('reports')}
                className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <FileText className="w-5 h-5 text-green-600 mr-3" />
                <div className="text-left">
                  <p className="font-medium text-gray-900">{t('dashboard.financialReports')}</p>
                  <p className="text-sm text-gray-500">{t('dashboard.reportsDescription')}</p>
                </div>
              </button>
              <button
                onClick={handleExportData}
                className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Download className="w-5 h-5 text-purple-600 mr-3" />
                <div className="text-left">
                  <p className="font-medium text-gray-900">{t('dashboard.exportData')}</p>
                  <p className="text-sm text-gray-500">{t('dashboard.exportDescription')}</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 搜索标签页 */}
      {activeTab === 'search' && (
        <div className="space-y-6">
          <AdvancedDomainSearch
            domains={domains}
            transactions={transactions}
            onSearchResults={handleSearchResults}
            onTransactionResults={handleTransactionResults}
          />
          
          {/* 搜索结果展示 */}
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="p-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">{t('dashboard.searchResults')}</h3>
              <p className="text-sm text-gray-600 mt-1">
                {t('dashboard.showingResults').replace('{count}', searchResults.length.toString())}
              </p>
            </div>
            <div className="p-4">
              {searchResults.length > 0 ? (
                <div className="space-y-2">
                  {searchResults.slice(0, 10).map(domain => (
                    <div key={domain.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900">{domain.domain_name}</p>
                        <p className="text-sm text-gray-500">
                          {t(`domain.status.${domain.status}`)} • ${domain.purchase_cost || 0}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-900">
                          {domain.sale_price ? `$${domain.sale_price}` : '-'}
                        </p>
                        <p className="text-xs text-gray-500">
                          {domain.tags?.join(', ') || t('dashboard.noTags')}
                        </p>
                      </div>
                    </div>
                  ))}
                  {searchResults.length > 10 && (
                    <p className="text-sm text-gray-500 text-center py-2">
                      {t('dashboard.andMore').replace('{count}', (searchResults.length - 10).toString())}
                    </p>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Search className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">{t('dashboard.noResults')}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 报告标签页 */}
      {activeTab === 'reports' && (
        <EnhancedFinancialReport
          domains={searchResults}
          transactions={transactionResults}
        />
      )}
    </div>
  );
}
