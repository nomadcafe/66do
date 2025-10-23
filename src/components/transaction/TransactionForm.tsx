'use client';

import { useState, useEffect } from 'react';
import { X, Save, DollarSign, Calendar, FileText } from 'lucide-react';

interface Transaction {
  id: string;
  domain_id: string;
  type: 'buy' | 'renew' | 'sell' | 'transfer' | 'fee' | 'marketing' | 'advertising';
  amount: number;
  currency: string;
  exchange_rate?: number;
  base_amount?: number;
  platform_fee?: number;
  platform_fee_percentage?: number;
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
}

interface TransactionFormProps {
  transaction?: Transaction;
  domains: Domain[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (transaction: Omit<Transaction, 'id'>) => void;
}

export default function TransactionForm({ 
  transaction, 
  domains, 
  isOpen, 
  onClose, 
  onSave 
}: TransactionFormProps) {
  const [formData, setFormData] = useState({
    domain_id: '',
    type: 'buy' as 'buy' | 'renew' | 'sell' | 'transfer' | 'fee' | 'marketing' | 'advertising',
    amount: 0,
    currency: 'USD',
    exchange_rate: 1,
    base_amount: 0,
    platform_fee: 0,
    platform_fee_percentage: 0,
    net_amount: 0,
    date: new Date().toISOString().split('T')[0],
    notes: '',
    platform: '',
    category: '',
    tax_deductible: false,
    receipt_url: ''
  });

  useEffect(() => {
    if (transaction) {
      setFormData({
        domain_id: transaction.domain_id,
        type: transaction.type,
        amount: transaction.amount,
        currency: transaction.currency,
        exchange_rate: transaction.exchange_rate || 1,
        base_amount: transaction.base_amount || 0,
        platform_fee: transaction.platform_fee || 0,
        platform_fee_percentage: transaction.platform_fee_percentage || 0,
        net_amount: transaction.net_amount || 0,
        date: transaction.date,
        notes: transaction.notes,
        platform: transaction.platform || '',
        category: transaction.category || '',
        tax_deductible: transaction.tax_deductible || false,
        receipt_url: transaction.receipt_url || ''
      });
    } else {
      setFormData({
        domain_id: '',
        type: 'buy' as 'buy' | 'renew' | 'sell' | 'transfer' | 'fee' | 'marketing' | 'advertising',
        amount: 0,
        currency: 'USD',
        exchange_rate: 1,
        base_amount: 0,
        platform_fee: 0,
        platform_fee_percentage: 0,
        net_amount: 0,
        date: new Date().toISOString().split('T')[0],
        notes: '',
        platform: '',
        category: '',
        tax_deductible: false,
        receipt_url: ''
      });
    }
  }, [transaction]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // 自动计算净收入
    const calculatedNetAmount = formData.amount - formData.platform_fee;
    const finalFormData = {
      ...formData,
      net_amount: calculatedNetAmount
    };
    
    onSave(finalFormData);
    onClose();
  };

  const transactionTypes = [
    { value: 'buy', label: 'Purchase' },
    { value: 'renew', label: 'Renewal' },
    { value: 'sell', label: 'Sale' },
    { value: 'transfer', label: 'Transfer' },
    { value: 'fee', label: 'Fee' },
    { value: 'marketing', label: 'Marketing' },
    { value: 'advertising', label: 'Advertising' }
  ];

  const currencies = [
    { value: 'USD', label: 'USD' },
    { value: 'EUR', label: 'EUR' },
    { value: 'GBP', label: 'GBP' },
    { value: 'CNY', label: 'CNY' }
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">
            {transaction ? 'Edit Transaction' : 'Add New Transaction'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Domain *
            </label>
            <select
              required
              value={formData.domain_id}
              onChange={(e) => setFormData({ ...formData, domain_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a domain</option>
              {domains.map((domain) => (
                <option key={domain.id} value={domain.id}>
                  {domain.domain_name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Transaction Type *
              </label>
              <select
                required
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as 'buy' | 'renew' | 'sell' | 'transfer' | 'fee' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {transactionTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar className="h-4 w-4 inline mr-1" />
                Date *
              </label>
              <input
                type="date"
                required
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <DollarSign className="h-4 w-4 inline mr-1" />
                Amount *
              </label>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Currency
              </label>
              <select
                value={formData.currency}
                onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {currencies.map((currency) => (
                  <option key={currency.value} value={currency.value}>
                    {currency.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Platform
              </label>
              <input
                type="text"
                value={formData.platform}
                onChange={(e) => setFormData({ ...formData, platform: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="GoDaddy, Namecheap, etc."
              />
            </div>
          </div>

          {/* 新增财务字段 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Exchange Rate
              </label>
              <input
                type="number"
                min="0"
                step="0.0001"
                value={formData.exchange_rate}
                onChange={(e) => setFormData({ ...formData, exchange_rate: parseFloat(e.target.value) || 1 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="1.0000"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Platform Fee (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={formData.platform_fee_percentage}
                onChange={(e) => setFormData({ ...formData, platform_fee_percentage: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Category
              </label>
              <input
                type="text"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Investment, Marketing, etc."
              />
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="tax_deductible"
                checked={formData.tax_deductible}
                onChange={(e) => setFormData({ ...formData, tax_deductible: e.target.checked })}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="tax_deductible" className="ml-2 block text-sm text-gray-700">
                Tax Deductible
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Receipt URL
            </label>
            <input
              type="url"
              value={formData.receipt_url}
              onChange={(e) => setFormData({ ...formData, receipt_url: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="https://example.com/receipt.pdf"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <FileText className="h-4 w-4 inline mr-1" />
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Additional notes about this transaction..."
            />
          </div>

          <div className="flex justify-end space-x-3 pt-6 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center space-x-2"
            >
              <Save className="h-4 w-4" />
              <span>{transaction ? 'Update Transaction' : 'Add Transaction'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
