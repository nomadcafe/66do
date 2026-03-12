'use client';

import { useState, useMemo, memo, useCallback } from 'react';
import { Search, Filter, Plus, Edit, Trash2, DollarSign, Calendar, FileText, TrendingUp, TrendingDown } from 'lucide-react';
import { calculateDomainROI, getROIColor, getROIBgColor, formatPercentage } from '../../lib/enhancedFinancialMetrics';
import { useI18nContext } from '../../contexts/I18nProvider';
import { DomainWithTags, TransactionWithRequiredFields } from '../../types/dashboard';
// import { Domain, Transaction } from '../../lib/supabaseService';

// 计算持有时间
function calculateHoldingTime(purchaseDate: string, saleDate: string, t: (key: string) => string): {
  days: number;
  months: number;
  years: number;
  displayText: string;
} {
  const purchase = new Date(purchaseDate);
  const sale = new Date(saleDate);
  const diffTime = sale.getTime() - purchase.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  const years = Math.floor(diffDays / 365);
  const months = Math.floor((diffDays % 365) / 30);
  const days = diffDays % 30;
  
  let displayText = '';
  if (years > 0) {
    displayText = `${years}${t('transaction.year')}${months > 0 ? `${months}${t('transaction.month')}` : ''}`;
  } else if (months > 0) {
    displayText = `${months}${t('transaction.month')}${days > 0 ? `${days}${t('transaction.day')}` : ''}`;
  } else {
    displayText = `${days}${t('transaction.day')}`;
  }
  
  return {
    days: diffDays,
    months,
    years,
    displayText
  };
}

// 获取持有时间颜色
function getHoldingTimeColor(days: number): string {
  if (days < 30) return 'text-red-600';      // 短期持有（红色）
  if (days < 180) return 'text-yellow-600';   // 中期持有（黄色）
  if (days < 365) return 'text-blue-600';     // 长期持有（蓝色）
  return 'text-green-600';                     // 超长期持有（绿色）
}

// 获取持有时间背景色
function getHoldingTimeBgColor(days: number): string {
  if (days < 30) return 'bg-red-100';
  if (days < 180) return 'bg-yellow-100';
  if (days < 365) return 'bg-blue-100';
  return 'bg-green-100';
}

// 使用统一的类型定义，从 supabaseService 导入

interface TransactionListProps {
  transactions: TransactionWithRequiredFields[];
  domains: DomainWithTags[];
  onEdit: (transaction: TransactionWithRequiredFields) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
}

const TransactionList = memo(function TransactionList({ 
  transactions, 
  domains, 
  onEdit, 
  onDelete, 
  onAdd 
}: TransactionListProps) {
  const { t } = useI18nContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'buy':
        return 'bg-red-100 text-red-800';
      case 'sell':
        return 'bg-green-100 text-green-800';
      case 'renew':
        return 'bg-blue-100 text-blue-800';
      case 'transfer':
        return 'bg-yellow-100 text-yellow-800';
      case 'fee':
        return 'bg-gray-100 text-gray-800';
      case 'marketing':
        return 'bg-purple-100 text-purple-800';
      case 'advertising':
        return 'bg-pink-100 text-pink-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'buy': return t('transaction.buy');
      case 'sell': return t('transaction.sell');
      case 'renew': return t('transaction.renew');
      case 'transfer': return t('transaction.transfer');
      case 'fee': return t('transaction.fee');
      case 'marketing': return t('transaction.marketing');
      case 'advertising': return t('transaction.advertising');
      default: return type;
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  // 使用useMemo优化域名查找
  const domainMap = useMemo(() => {
    const map = new Map<string, string>();
    domains.forEach(d => map.set(d.id, d.domain_name));
    return map;
  }, [domains]);

  const getDomainName = useCallback((domainId: string) => {
    return domainMap.get(domainId) || t('transactionList.unknownDomain');
  }, [domainMap, t]);

  const filteredTransactions = useMemo(() => transactions.filter(transaction => {
    const matchesSearch = 
      getDomainName(transaction.domain_id).toLowerCase().includes(searchTerm.toLowerCase()) ||
      (transaction.notes || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = typeFilter === 'all' || transaction.type === typeFilter;
    
    return matchesSearch && matchesType;
  }), [transactions, getDomainName, searchTerm, typeFilter]);

  const typeOptions = [
    { value: 'all', labelKey: 'transactionList.allTypes' as const },
    { value: 'buy', labelKey: 'transaction.buy' as const },
    { value: 'sell', labelKey: 'transaction.sell' as const },
    { value: 'renew', labelKey: 'transaction.renew' as const },
    { value: 'transfer', labelKey: 'transaction.transfer' as const },
    { value: 'fee', labelKey: 'transaction.fee' as const },
    { value: 'marketing', labelKey: 'transaction.marketing' as const },
    { value: 'advertising', labelKey: 'transaction.advertising' as const }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-stone-900">{t('transactionList.title')}</h2>
          <p className="text-sm text-stone-500 mt-0.5">{t('transactionList.subtitle')}</p>
        </div>
        <button
          onClick={onAdd}
          className="inline-flex items-center px-4 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-medium hover:bg-teal-700 transition"
        >
          <Plus className="h-4 w-4 mr-2" />
          {t('transactionList.addTransaction')}
        </button>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
            <input
              type="search"
              aria-label={t('transactionList.searchPlaceholder')}
              placeholder={t('transactionList.searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Filter className="h-4 w-4 text-stone-400" />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            aria-label={t('transactionList.allTypes')}
            className="px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            {typeOptions.map(option => (
              <option key={option.value} value={option.value}>
                {t(option.labelKey)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="text-sm text-stone-500">
        {t('transactionList.showingCount').replace('{filtered}', String(filteredTransactions.length)).replace('{total}', String(transactions.length))}
      </p>

      {filteredTransactions.length === 0 ? (
        <div className="text-center py-14 bg-white rounded-2xl border border-stone-200/80 shadow-sm">
          <FileText className="h-10 w-10 mx-auto text-stone-300 mb-4" />
          <h3 className="text-base font-semibold text-stone-900 mb-2">
            {searchTerm || typeFilter !== 'all' ? t('transactionList.noTransactionsFound') : t('transactionList.noTransactionsYet')}
          </h3>
          <p className="text-sm text-stone-500 mb-5 max-w-sm mx-auto">
            {searchTerm || typeFilter !== 'all' ? t('transactionList.adjustSearch') : t('transactionList.getStarted')}
          </p>
          {!searchTerm && typeFilter === 'all' && (
            <button
              onClick={onAdd}
              className="inline-flex items-center px-4 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-medium hover:bg-teal-700 transition"
            >
              <Plus className="h-4 w-4 mr-2" />
              {t('transactionList.addFirstTransaction')}
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-stone-200/80 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-stone-200">
              <thead className="bg-stone-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">
                    {t('transactionList.domain')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">
                    {t('transactionList.type')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">
                    {t('transactionList.amount')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">
                    {t('transactionList.date')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">
                    {t('transactionList.platform')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">
                    {t('transactionList.notes')}
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-stone-500 uppercase tracking-wider">
                    {t('transactionList.actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-stone-200">
                {filteredTransactions.map((transaction) => (
                  <tr key={transaction.id} className="hover:bg-stone-50/80">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {getDomainName(transaction.domain_id)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTypeColor(transaction.type)}`}>
                        {getTypeLabel(transaction.type)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <div className="flex items-center">
                          <DollarSign className="h-4 w-4 text-gray-400 mr-1" />
                          <span className="text-sm font-medium text-gray-900">
                            {formatCurrency(transaction.amount, transaction.currency)}
                          </span>
                        </div>
                        {transaction.type === 'sell' && transaction.platform_fee && transaction.platform_fee > 0 && (
                          <div className="mt-1">
                            <span className="text-xs text-green-600 font-medium">
                              {t('transaction.netIncome')}: {formatCurrency(transaction.net_amount || (transaction.amount - transaction.platform_fee), transaction.currency)}
                            </span>
                            <span className="text-xs text-gray-500 ml-2">
                              ({t('transaction.platformFeeDesc')}: {formatCurrency(transaction.platform_fee, transaction.currency)})
                            </span>
                          </div>
                        )}
                        {transaction.type === 'sell' && (
                          <div className="mt-1 space-y-1">
                            {(() => {
                              const domain = domains.find(d => d.id === transaction.domain_id);
                              if (!domain) return null;
                              
                              const domainROI = calculateDomainROI(domain, [transaction]);
                              const holdingTime = calculateHoldingTime(domain.purchase_date || '', transaction.date, t);
                              
                              return (
                                <div className="flex flex-col space-y-1">
                                  {/* ROI显示 */}
                                  <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getROIBgColor(domainROI.roi)}`}>
                                    {domainROI.roi >= 0 ? (
                                      <TrendingUp className="h-3 w-3 mr-1" />
                                    ) : (
                                      <TrendingDown className="h-3 w-3 mr-1" />
                                    )}
                                    <span className={getROIColor(domainROI.roi)}>
                                      ROI: {formatPercentage(domainROI.roi)}
                                    </span>
                                  </div>
                                  
                                  {/* 持有时间显示 */}
                                  <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getHoldingTimeBgColor(holdingTime.days)}`}>
                                    <Calendar className="h-3 w-3 mr-1" />
                                    <span className={getHoldingTimeColor(holdingTime.days)}>
                                      {t('transaction.holding')}: {holdingTime.displayText}
                                    </span>
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Calendar className="h-4 w-4 text-gray-400 mr-1" />
                        <span className="text-sm text-gray-900">
                          {formatDate(transaction.date)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      -
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 max-w-xs truncate">
                        {transaction.notes || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => onEdit(transaction)}
                          className="text-teal-600 hover:text-teal-800"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => onDelete(transaction.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
});

export default TransactionList;
