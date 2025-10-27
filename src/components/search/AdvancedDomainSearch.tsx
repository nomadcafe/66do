'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { useI18nContext } from '../../contexts/I18nProvider';
import { DomainWithTags, TransactionWithRequiredFields } from '../../types/dashboard';
import { 
  Search, 
  Filter, 
  X, 
  SortAsc,
  SortDesc,
  Download,
  RefreshCw
} from 'lucide-react';

interface AdvancedDomainSearchProps {
  domains: DomainWithTags[];
  transactions: TransactionWithRequiredFields[];
  onSearchResults: (results: DomainWithTags[]) => void;
  onTransactionResults: (results: TransactionWithRequiredFields[]) => void;
}

interface SearchFilters {
  // 基础搜索
  searchTerm: string;
  searchFields: string[];
  
  // 域名状态过滤
  status: string[];
  
  // 价格范围
  minPrice: number | null;
  maxPrice: number | null;
  
  // 日期范围
  purchaseDateFrom: string;
  purchaseDateTo: string;
  expiryDateFrom: string;
  expiryDateTo: string;
  
  // 标签过滤
  tags: string[];
  
  // 扩展名过滤
  extensions: string[];
  
  // 投资回报过滤
  minROI: number | null;
  maxROI: number | null;
  
  // 持有时间过滤
  minHoldingDays: number | null;
  maxHoldingDays: number | null;
  
  // 排序
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

export default function AdvancedDomainSearch({ 
  domains, 
  transactions, 
  onSearchResults, 
  onTransactionResults 
}: AdvancedDomainSearchProps) {
  const { t } = useI18nContext();
  const [isExpanded, setIsExpanded] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>({
    searchTerm: '',
    searchFields: ['domain_name', 'notes'],
    status: [],
    minPrice: null,
    maxPrice: null,
    purchaseDateFrom: '',
    purchaseDateTo: '',
    expiryDateFrom: '',
    expiryDateTo: '',
    tags: [],
    extensions: [],
    minROI: null,
    maxROI: null,
    minHoldingDays: null,
    maxHoldingDays: null,
    sortBy: 'domain_name',
    sortOrder: 'asc',
  });

  // 获取所有可用的标签和扩展名
  const availableTags = useMemo(() => {
    const tagSet = new Set<string>();
    domains.forEach(domain => {
      if (domain.tags) {
        domain.tags.forEach(tag => tagSet.add(tag));
      }
    });
    return Array.from(tagSet).sort();
  }, [domains]);

  const availableExtensions = useMemo(() => {
    const extSet = new Set<string>();
    domains.forEach(domain => {
      const parts = domain.domain_name.split('.');
      if (parts.length > 1) {
        extSet.add('.' + parts[parts.length - 1]);
      }
    });
    return Array.from(extSet).sort();
  }, [domains]);

  // 计算ROI
  const calculateROI = useCallback((domain: DomainWithTags) => {
    if (domain.status !== 'sold' || !domain.sale_price || !domain.purchase_cost) {
      return 0;
    }
    const investment = domain.purchase_cost + (domain.renewal_count * (domain.renewal_cost || 0));
    const revenue = domain.sale_price;
    return investment > 0 ? ((revenue - investment) / investment) * 100 : 0;
  }, []);

  // 计算持有天数
  const calculateHoldingDays = useCallback((domain: DomainWithTags) => {
    if (!domain.purchase_date || !domain.sale_date) {
      return 0;
    }
    const purchaseDate = new Date(domain.purchase_date);
    const saleDate = new Date(domain.sale_date);
    return Math.floor((saleDate.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24));
  }, []);

  // 过滤和搜索域名
  const filteredDomains = useMemo(() => {
    let filtered = [...domains];

    // 文本搜索
    if (filters.searchTerm) {
      const searchLower = filters.searchTerm.toLowerCase();
      filtered = filtered.filter(domain => {
        return filters.searchFields.some(field => {
          const value = getDomainNestedValue(domain, field);
          return typeof value === 'string' && value.toLowerCase().includes(searchLower);
        });
      });
    }

    // 状态过滤
    if (filters.status.length > 0) {
      filtered = filtered.filter(domain => filters.status.includes(domain.status));
    }

    // 价格范围过滤
    if (filters.minPrice !== null) {
      filtered = filtered.filter(domain => (domain.purchase_cost || 0) >= filters.minPrice!);
    }
    if (filters.maxPrice !== null) {
      filtered = filtered.filter(domain => (domain.purchase_cost || 0) <= filters.maxPrice!);
    }

    // 购买日期过滤
    if (filters.purchaseDateFrom) {
      const fromDate = new Date(filters.purchaseDateFrom);
      filtered = filtered.filter(domain => {
        if (!domain.purchase_date) return false;
        return new Date(domain.purchase_date) >= fromDate;
      });
    }
    if (filters.purchaseDateTo) {
      const toDate = new Date(filters.purchaseDateTo);
      filtered = filtered.filter(domain => {
        if (!domain.purchase_date) return false;
        return new Date(domain.purchase_date) <= toDate;
      });
    }

    // 到期日期过滤
    if (filters.expiryDateFrom) {
      const fromDate = new Date(filters.expiryDateFrom);
      filtered = filtered.filter(domain => {
        if (!domain.expiry_date) return false;
        return new Date(domain.expiry_date) >= fromDate;
      });
    }
    if (filters.expiryDateTo) {
      const toDate = new Date(filters.expiryDateTo);
      filtered = filtered.filter(domain => {
        if (!domain.expiry_date) return false;
        return new Date(domain.expiry_date) <= toDate;
      });
    }

    // 标签过滤
    if (filters.tags.length > 0) {
      filtered = filtered.filter(domain => {
        if (!domain.tags) return false;
        return filters.tags.some(tag => domain.tags!.includes(tag));
      });
    }

    // 扩展名过滤
    if (filters.extensions.length > 0) {
      filtered = filtered.filter(domain => {
        const parts = domain.domain_name.split('.');
        if (parts.length <= 1) return false;
        const extension = '.' + parts[parts.length - 1];
        return filters.extensions.includes(extension);
      });
    }

    // ROI过滤
    if (filters.minROI !== null || filters.maxROI !== null) {
      filtered = filtered.filter(domain => {
        const roi = calculateROI(domain);
        if (filters.minROI !== null && roi < filters.minROI) return false;
        if (filters.maxROI !== null && roi > filters.maxROI) return false;
        return true;
      });
    }

    // 持有时间过滤
    if (filters.minHoldingDays !== null || filters.maxHoldingDays !== null) {
      filtered = filtered.filter(domain => {
        const holdingDays = calculateHoldingDays(domain);
        if (filters.minHoldingDays !== null && holdingDays < filters.minHoldingDays) return false;
        if (filters.maxHoldingDays !== null && holdingDays > filters.maxHoldingDays) return false;
        return true;
      });
    }

    // 排序
    filtered.sort((a, b) => {
      let aValue: unknown = getDomainNestedValue(a, filters.sortBy);
      let bValue: unknown = getDomainNestedValue(b, filters.sortBy);

      // 特殊处理ROI和持有天数
      if (filters.sortBy === 'roi') {
        aValue = calculateROI(a);
        bValue = calculateROI(b);
      } else if (filters.sortBy === 'holding_days') {
        aValue = calculateHoldingDays(a);
        bValue = calculateHoldingDays(b);
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return filters.sortOrder === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return filters.sortOrder === 'asc' 
          ? aValue - bValue 
          : bValue - aValue;
      }

      return 0;
    });

    return filtered;
  }, [domains, filters, calculateROI, calculateHoldingDays]);

  // 过滤交易
  const filteredTransactions = useMemo(() => {
    let filtered = [...transactions];

    // 根据域名过滤交易
    const domainIds = new Set(filteredDomains.map(d => d.id));
    filtered = filtered.filter(t => domainIds.has(t.domain_id));

    return filtered;
  }, [transactions, filteredDomains]);

  // 更新过滤器
  const updateFilter = useCallback((key: keyof SearchFilters, value: string | number | string[] | number[] | null) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  // 重置过滤器
  const resetFilters = useCallback(() => {
    setFilters({
      searchTerm: '',
      searchFields: ['domain_name', 'notes'],
      status: [],
      minPrice: null,
      maxPrice: null,
      purchaseDateFrom: '',
      purchaseDateTo: '',
      expiryDateFrom: '',
      expiryDateTo: '',
      tags: [],
      extensions: [],
      minROI: null,
      maxROI: null,
      minHoldingDays: null,
      maxHoldingDays: null,
      sortBy: 'domain_name',
      sortOrder: 'asc',
    });
  }, []);

  // 导出搜索结果
  const exportResults = useCallback(() => {
    const data = {
      domains: filteredDomains,
      transactions: filteredTransactions,
      filters,
      exportedAt: new Date().toISOString(),
    };
    
    const dataStr = JSON.stringify(data, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `domain-search-results-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }, [filteredDomains, filteredTransactions, filters]);

  // 通知父组件结果变化
  React.useEffect(() => {
    onSearchResults(filteredDomains);
    onTransactionResults(filteredTransactions);
  }, [filteredDomains, filteredTransactions, onSearchResults, onTransactionResults]);

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      {/* 搜索头部 */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4 flex-1">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder={t('search.searchPlaceholder')}
                value={filters.searchTerm}
                onChange={(e) => updateFilter('searchTerm', e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
            >
              <Filter className="w-4 h-4 mr-2" />
              {t('search.filters')}
              {isExpanded ? (
                <X className="w-4 h-4 ml-1" />
              ) : (
                <span className="ml-1">({Object.values(filters).filter(v => v && v !== '' && (Array.isArray(v) ? v.length > 0 : true)).length})</span>
              )}
            </button>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={exportResults}
              className="flex items-center px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
            >
              <Download className="w-4 h-4 mr-1" />
              {t('search.export')}
            </button>
            <button
              onClick={resetFilters}
              className="flex items-center px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
            >
              <RefreshCw className="w-4 h-4 mr-1" />
              {t('search.reset')}
            </button>
          </div>
        </div>
      </div>

      {/* 展开的过滤器面板 */}
      {isExpanded && (
        <div className="p-4 space-y-6">
          {/* 基础过滤 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('search.status')}
              </label>
              <div className="space-y-2">
                {['active', 'for_sale', 'sold', 'expired'].map(status => (
                  <label key={status} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={filters.status.includes(status)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          updateFilter('status', [...filters.status, status]);
                        } else {
                          updateFilter('status', filters.status.filter(s => s !== status));
                        }
                      }}
                      className="mr-2"
                    />
                    <span className="text-sm">{t(`domain.status.${status}`)}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('search.priceRange')}
              </label>
              <div className="space-y-2">
                <input
                  type="number"
                  placeholder={t('search.minPrice')}
                  value={filters.minPrice || ''}
                  onChange={(e) => updateFilter('minPrice', e.target.value ? Number(e.target.value) : null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
                <input
                  type="number"
                  placeholder={t('search.maxPrice')}
                  value={filters.maxPrice || ''}
                  onChange={(e) => updateFilter('maxPrice', e.target.value ? Number(e.target.value) : null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('search.tags')}
              </label>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {availableTags.map(tag => (
                  <label key={tag} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={filters.tags.includes(tag)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          updateFilter('tags', [...filters.tags, tag]);
                        } else {
                          updateFilter('tags', filters.tags.filter(t => t !== tag));
                        }
                      }}
                      className="mr-2"
                    />
                    <span className="text-sm">{tag}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* 日期过滤 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('search.purchaseDateRange')}
              </label>
              <div className="space-y-2">
                <input
                  type="date"
                  value={filters.purchaseDateFrom}
                  onChange={(e) => updateFilter('purchaseDateFrom', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
                <input
                  type="date"
                  value={filters.purchaseDateTo}
                  onChange={(e) => updateFilter('purchaseDateTo', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('search.expiryDateRange')}
              </label>
              <div className="space-y-2">
                <input
                  type="date"
                  value={filters.expiryDateFrom}
                  onChange={(e) => updateFilter('expiryDateFrom', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
                <input
                  type="date"
                  value={filters.expiryDateTo}
                  onChange={(e) => updateFilter('expiryDateTo', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
            </div>
          </div>

          {/* 高级过滤 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('search.extensions')}
              </label>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {availableExtensions.map(ext => (
                  <label key={ext} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={filters.extensions.includes(ext)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          updateFilter('extensions', [...filters.extensions, ext]);
                        } else {
                          updateFilter('extensions', filters.extensions.filter(e => e !== ext));
                        }
                      }}
                      className="mr-2"
                    />
                    <span className="text-sm">{ext}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('search.roiRange')}
              </label>
              <div className="space-y-2">
                <input
                  type="number"
                  placeholder={t('search.minROI')}
                  value={filters.minROI || ''}
                  onChange={(e) => updateFilter('minROI', e.target.value ? Number(e.target.value) : null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
                <input
                  type="number"
                  placeholder={t('search.maxROI')}
                  value={filters.maxROI || ''}
                  onChange={(e) => updateFilter('maxROI', e.target.value ? Number(e.target.value) : null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('search.holdingDaysRange')}
              </label>
              <div className="space-y-2">
                <input
                  type="number"
                  placeholder={t('search.minHoldingDays')}
                  value={filters.minHoldingDays || ''}
                  onChange={(e) => updateFilter('minHoldingDays', e.target.value ? Number(e.target.value) : null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
                <input
                  type="number"
                  placeholder={t('search.maxHoldingDays')}
                  value={filters.maxHoldingDays || ''}
                  onChange={(e) => updateFilter('maxHoldingDays', e.target.value ? Number(e.target.value) : null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('search.sortBy')}
              </label>
              <div className="space-y-2">
                <select
                  value={filters.sortBy}
                  onChange={(e) => updateFilter('sortBy', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  <option value="domain_name">{t('search.domainName')}</option>
                  <option value="purchase_cost">{t('search.purchaseCost')}</option>
                  <option value="sale_price">{t('search.salePrice')}</option>
                  <option value="roi">{t('search.roi')}</option>
                  <option value="holding_days">{t('search.holdingDays')}</option>
                  <option value="purchase_date">{t('search.purchaseDate')}</option>
                  <option value="expiry_date">{t('search.expiryDate')}</option>
                </select>
                <button
                  onClick={() => updateFilter('sortOrder', filters.sortOrder === 'asc' ? 'desc' : 'asc')}
                  className="flex items-center justify-center w-full px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md"
                >
                  {filters.sortOrder === 'asc' ? (
                    <SortAsc className="w-4 h-4" />
                  ) : (
                    <SortDesc className="w-4 h-4" />
                  )}
                  <span className="ml-1 text-sm">
                    {filters.sortOrder === 'asc' ? t('search.ascending') : t('search.descending')}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 搜索结果统计 */}
      <div className="px-4 py-2 bg-gray-50 border-t">
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>
            {t('search.resultsCount').replace('{count}', filteredDomains.length.toString())}
          </span>
          <span>
            {t('search.transactionsCount').replace('{count}', filteredTransactions.length.toString())}
          </span>
        </div>
      </div>
    </div>
  );
}

// 类型安全的获取嵌套值函数
function getDomainNestedValue(domain: DomainWithTags, path: string): unknown {
  const pathParts = path.split('.');
  let current: unknown = domain;
  
  for (const key of pathParts) {
    if (current && typeof current === 'object' && key in current) {
      current = (current as Record<string, unknown>)[key];
    } else {
      return undefined;
    }
  }
  
  return current;
}
