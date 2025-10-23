'use client';

import { useState, useMemo } from 'react';
import { 
  Calculator, 
  Download, 
  AlertCircle,
  CheckCircle,
  Calendar,
  Receipt,
  TrendingUp
} from 'lucide-react';
import { formatCurrency } from '../../lib/financialCalculations';

interface Transaction {
  id: string;
  domain_id: string;
  type: 'buy' | 'renew' | 'sell' | 'transfer' | 'fee' | 'marketing' | 'advertising';
  amount: number;
  currency: string;
  exchange_rate?: number;
  platform_fee?: number;
  net_amount?: number;
  date: string;
  notes: string;
  platform?: string;
  category?: string;
  tax_deductible?: boolean;
  receipt_url?: string;
}

interface Domain {
  id: string;
  domain_name: string;
  purchase_date: string;
  purchase_cost: number;
  renewal_cost: number;
  renewal_cycle: number;
  renewal_count: number;
  expiry_date: string;
  status: 'active' | 'for_sale' | 'sold' | 'expired';
  estimated_value: number;
  tags: string[];
}

interface TaxReportProps {
  domains: Domain[];
  transactions: Transaction[];
}

interface TaxSummary {
  totalIncome: number;
  totalDeductibleExpenses: number;
  totalNonDeductibleExpenses: number;
  netIncome: number;
  estimatedTax: number;
  taxRate: number;
  deductibleTransactions: Transaction[];
  nonDeductibleTransactions: Transaction[];
  capitalGains: Array<{
    domain: string;
    purchasePrice: number;
    salePrice: number;
    holdingPeriod: number;
    gain: number;
    isLongTerm: boolean;
  }>;
  businessExpenses: Array<{
    category: string;
    amount: number;
    count: number;
  }>;
}

export default function TaxReport({ domains, transactions }: TaxReportProps) {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [taxRate, setTaxRate] = useState(25); // 默认税率25%

  // 计算税务摘要
  const taxSummary: TaxSummary = useMemo(() => {
    const yearStart = new Date(selectedYear, 0, 1);
    const yearEnd = new Date(selectedYear, 11, 31);

    // 过滤当年交易
    const yearTransactions = transactions.filter(t => {
      const transactionDate = new Date(t.date);
      return transactionDate >= yearStart && transactionDate <= yearEnd;
    });

    // 收入计算
    const totalIncome = yearTransactions
      .filter(t => t.type === 'sell')
      .reduce((sum, t) => sum + (t.net_amount || t.amount), 0);

    // 可抵税费用
    const deductibleTransactions = yearTransactions.filter(t => 
      t.tax_deductible && (t.type === 'buy' || t.type === 'renew' || t.type === 'fee' || t.type === 'marketing' || t.type === 'advertising')
    );

    const totalDeductibleExpenses = deductibleTransactions.reduce((sum, t) => sum + t.amount, 0);

    // 不可抵税费用
    const nonDeductibleTransactions = yearTransactions.filter(t => 
      !t.tax_deductible && (t.type === 'buy' || t.type === 'renew' || t.type === 'fee' || t.type === 'marketing' || t.type === 'advertising')
    );

    const totalNonDeductibleExpenses = nonDeductibleTransactions.reduce((sum, t) => sum + t.amount, 0);

    // 净收入
    const netIncome = totalIncome - totalDeductibleExpenses;
    const estimatedTax = Math.max(0, netIncome * (taxRate / 100));

    // 资本利得计算
    const capitalGains = domains
      .filter(d => d.status === 'sold')
      .map(domain => {
        const domainTransactions = yearTransactions.filter(t => t.domain_id === domain.id);
        const purchaseTransaction = domainTransactions.find(t => t.type === 'buy');
        const saleTransaction = domainTransactions.find(t => t.type === 'sell');
        
        if (purchaseTransaction && saleTransaction) {
          const purchasePrice = purchaseTransaction.amount;
          const salePrice = saleTransaction.net_amount || saleTransaction.amount;
          const purchaseDate = new Date(purchaseTransaction.date);
          const saleDate = new Date(saleTransaction.date);
          const holdingPeriod = Math.floor((saleDate.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24));
          const gain = salePrice - purchasePrice;
          const isLongTerm = holdingPeriod > 365; // 超过1年为长期持有
          
          return {
            domain: domain.domain_name,
            purchasePrice,
            salePrice,
            holdingPeriod,
            gain,
            isLongTerm
          };
        }
        return null;
      })
      .filter(Boolean) as Array<{
        domain: string;
        purchasePrice: number;
        salePrice: number;
        holdingPeriod: number;
        gain: number;
        isLongTerm: boolean;
      }>;

    // 业务费用分类
    const businessExpenses = deductibleTransactions.reduce((acc, transaction) => {
      const category = transaction.category || 'Uncategorized';
      const existing = acc.find(item => item.category === category);
      if (existing) {
        existing.amount += transaction.amount;
        existing.count += 1;
      } else {
        acc.push({
          category,
          amount: transaction.amount,
          count: 1
        });
      }
      return acc;
    }, [] as Array<{ category: string; amount: number; count: number }>);

    return {
      totalIncome,
      totalDeductibleExpenses,
      totalNonDeductibleExpenses,
      netIncome,
      estimatedTax,
      taxRate,
      deductibleTransactions,
      nonDeductibleTransactions,
      capitalGains,
      businessExpenses
    };
  }, [domains, transactions, selectedYear, taxRate]);

  const handleExportTaxReport = () => {
    const reportData = {
      year: selectedYear,
      generatedAt: new Date().toISOString(),
      taxSummary,
      transactions: transactions.filter(t => {
        const transactionDate = new Date(t.date);
        const yearStart = new Date(selectedYear, 0, 1);
        const yearEnd = new Date(selectedYear, 11, 31);
        return transactionDate >= yearStart && transactionDate <= yearEnd;
      })
    };
    
    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tax-report-${selectedYear}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  return (
    <div className="space-y-6">
      {/* 报告头部 */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Tax Report</h2>
            <p className="text-gray-600">Tax preparation and deduction tracking</p>
          </div>
          
          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {years.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
            
            <div className="flex items-center space-x-2">
              <label className="text-sm text-gray-600">Tax Rate:</label>
              <input
                type="number"
                min="0"
                max="100"
                value={taxRate}
                onChange={(e) => setTaxRate(parseInt(e.target.value) || 0)}
                className="w-20 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-600">%</span>
            </div>
            
            <button
              onClick={handleExportTaxReport}
              className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </button>
          </div>
        </div>
      </div>

      {/* 税务摘要 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Income</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(taxSummary.totalIncome)}
              </p>
            </div>
            <div className="p-3 bg-green-100 rounded-full">
              <TrendingUp className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Deductible Expenses</p>
              <p className="text-2xl font-bold text-blue-600">
                {formatCurrency(taxSummary.totalDeductibleExpenses)}
              </p>
            </div>
            <div className="p-3 bg-blue-100 rounded-full">
              <Receipt className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Net Income</p>
              <p className={`text-2xl font-bold ${taxSummary.netIncome >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(taxSummary.netIncome)}
              </p>
            </div>
            <div className={`p-3 rounded-full ${taxSummary.netIncome >= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
              <Calculator className="h-6 w-6 text-gray-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Estimated Tax</p>
              <p className="text-2xl font-bold text-red-600">
                {formatCurrency(taxSummary.estimatedTax)}
              </p>
            </div>
            <div className="p-3 bg-red-100 rounded-full">
              <AlertCircle className="h-6 w-6 text-red-600" />
            </div>
          </div>
        </div>
      </div>

      {/* 资本利得 */}
      {taxSummary.capitalGains.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Capital Gains</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 text-sm font-medium text-gray-600">Domain</th>
                  <th className="text-right py-2 text-sm font-medium text-gray-600">Purchase Price</th>
                  <th className="text-right py-2 text-sm font-medium text-gray-600">Sale Price</th>
                  <th className="text-right py-2 text-sm font-medium text-gray-600">Holding Period</th>
                  <th className="text-right py-2 text-sm font-medium text-gray-600">Gain/Loss</th>
                  <th className="text-center py-2 text-sm font-medium text-gray-600">Type</th>
                </tr>
              </thead>
              <tbody>
                {taxSummary.capitalGains.map((gain, index) => (
                  <tr key={index} className="border-b border-gray-100">
                    <td className="py-2 text-sm text-gray-900">{gain.domain}</td>
                    <td className="py-2 text-sm text-right text-gray-900">
                      {formatCurrency(gain.purchasePrice)}
                    </td>
                    <td className="py-2 text-sm text-right text-gray-900">
                      {formatCurrency(gain.salePrice)}
                    </td>
                    <td className="py-2 text-sm text-right text-gray-900">
                      {gain.holdingPeriod} days
                    </td>
                    <td className={`py-2 text-sm text-right font-medium ${
                      gain.gain >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {formatCurrency(gain.gain)}
                    </td>
                    <td className="py-2 text-sm text-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        gain.isLongTerm 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {gain.isLongTerm ? 'Long-term' : 'Short-term'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 业务费用分类 */}
      {taxSummary.businessExpenses.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Business Expenses by Category</h3>
          <div className="space-y-3">
            {taxSummary.businessExpenses.map((expense, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <span className="font-medium text-gray-900">{expense.category}</span>
                  <span className="text-sm text-gray-500 ml-2">({expense.count} transactions)</span>
                </div>
                <span className="font-semibold text-gray-900">
                  {formatCurrency(expense.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 可抵税交易 */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Deductible Transactions</h3>
        {taxSummary.deductibleTransactions.length > 0 ? (
          <div className="space-y-3">
            {taxSummary.deductibleTransactions.map((transaction, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="font-medium text-gray-900">{transaction.type.toUpperCase()}</p>
                    <p className="text-sm text-gray-600">{transaction.notes || 'No notes'}</p>
                    <p className="text-xs text-gray-500">{new Date(transaction.date).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-green-600">
                    {formatCurrency(transaction.amount)}
                  </p>
                  {transaction.receipt_url && (
                    <a 
                      href={transaction.receipt_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:text-blue-800"
                    >
                      View Receipt
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <Receipt className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p>No deductible transactions found for {selectedYear}</p>
          </div>
        )}
      </div>

      {/* 税务建议 */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Tax Optimization Tips</h3>
        <div className="space-y-3">
          <div className="flex items-start space-x-3 p-3 bg-blue-50 rounded-lg">
            <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <p className="font-medium text-blue-900">Maximize Deductions</p>
              <p className="text-sm text-blue-700">
                Ensure all business-related expenses are marked as tax deductible
              </p>
            </div>
          </div>
          
          <div className="flex items-start space-x-3 p-3 bg-green-50 rounded-lg">
            <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
            <div>
              <p className="font-medium text-green-900">Keep Receipts</p>
              <p className="text-sm text-green-700">
                Maintain receipts for all deductible transactions for audit purposes
              </p>
            </div>
          </div>
          
          <div className="flex items-start space-x-3 p-3 bg-yellow-50 rounded-lg">
            <Calendar className="h-5 w-5 text-yellow-600 mt-0.5" />
            <div>
              <p className="font-medium text-yellow-900">Timing Strategy</p>
              <p className="text-sm text-yellow-700">
                Consider timing of sales to optimize capital gains tax treatment
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
