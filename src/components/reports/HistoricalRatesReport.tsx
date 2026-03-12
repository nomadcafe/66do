'use client';

import { useState } from 'react';
import { DollarSign } from 'lucide-react';
import { formatCurrencyAmount } from '../../lib/exchangeRates';
import { useI18nContext } from '../../contexts/I18nProvider';

interface HistoricalRatesReportProps {
  transactions: Array<{
    id: string;
    amount: number;
    currency: string;
    date: string;
    type: string;
    base_amount?: number | null;
  }>;
}

const BASE_CURRENCY = 'USD';

export default function HistoricalRatesReport({ transactions }: HistoricalRatesReportProps) {
  const { t } = useI18nContext();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const convertedTransactions = transactions.map(tx => ({
    ...tx,
    originalAmount: tx.amount,
    originalCurrency: tx.currency,
    exchangeRate: 1,
    convertedAmount: tx.base_amount ?? tx.amount,
    baseCurrency: BASE_CURRENCY
  }));


  const totals: Record<string, number> = { [BASE_CURRENCY]: convertedTransactions.reduce((sum, t) => sum + t.convertedAmount, 0) };
  const totalInBase = totals[BASE_CURRENCY] ?? 0;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
          <DollarSign className="h-5 w-5 mr-2" />
          {t('reports.historicalRatesAnalysis')}
        </h3>
      </div>

      {/* 控制面板 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
{t('reports.analysisDate')}
          </label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* 汇总统计 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="text-sm text-blue-600 mb-1">总价值 (统一货币)</div>
          <div className="text-2xl font-bold text-blue-700">
            {formatCurrencyAmount(totalInBase, BASE_CURRENCY)}
          </div>
        </div>
        
        <div className="bg-green-50 p-4 rounded-lg">
          <div className="text-sm text-green-600 mb-1">涉及货币种类</div>
          <div className="text-2xl font-bold text-green-700">
            {Object.keys(totals).length}
          </div>
        </div>
        
        <div className="bg-purple-50 p-4 rounded-lg">
          <div className="text-sm text-purple-600 mb-1">交易记录数</div>
          <div className="text-2xl font-bold text-purple-700">
            {convertedTransactions.length}
          </div>
        </div>
      </div>

      {/* 按货币分类统计 */}
      <div className="mb-6">
        <h4 className="text-md font-semibold text-gray-900 mb-4">按货币分类统计</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(totals).map(([currency, total]) => (
              <div key={currency} className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">{currency}</span>
                </div>
                <div className="text-2xl font-bold text-gray-900">
                  {formatCurrencyAmount(total, BASE_CURRENCY)}
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* 详细交易记录 */}
      <div>
        <h4 className="text-md font-semibold text-gray-900 mb-4">详细交易记录</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2">日期</th>
                <th className="text-left py-2">类型</th>
                <th className="text-left py-2">原始金额</th>
                <th className="text-left py-2">汇率</th>
                <th className="text-left py-2">转换后金额</th>
              </tr>
            </thead>
            <tbody>
              {convertedTransactions.map((transaction, index) => (
                <tr key={index} className="border-b border-gray-100">
                  <td className="py-2">{transaction.date}</td>
                  <td className="py-2">
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      transaction.type === 'sell' ? 'bg-green-100 text-green-700' :
                      transaction.type === 'buy' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {transaction.type}
                    </span>
                  </td>
                  <td className="py-2">
                    {formatCurrencyAmount(transaction.originalAmount, transaction.originalCurrency)}
                  </td>
                  <td className="py-2">
                    {transaction.exchangeRate.toFixed(4)}
                  </td>
                  <td className="py-2 font-medium">
                    {formatCurrencyAmount(transaction.convertedAmount, BASE_CURRENCY)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
