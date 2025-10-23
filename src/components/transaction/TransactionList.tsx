'use client';

import { useState } from 'react';
import { Search, Filter, Plus, Edit, Trash2, DollarSign, Calendar, FileText } from 'lucide-react';

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

interface TransactionListProps {
  transactions: Transaction[];
  domains: Domain[];
  onEdit: (transaction: Transaction) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
}

export default function TransactionList({ 
  transactions, 
  domains, 
  onEdit, 
  onDelete, 
  onAdd 
}: TransactionListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  const getDomainName = (domainId: string) => {
    const domain = domains.find(d => d.id === domainId);
    return domain ? domain.domain_name : 'Unknown Domain';
  };

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
      case 'buy': return 'Purchase';
      case 'sell': return 'Sale';
      case 'renew': return 'Renewal';
      case 'transfer': return 'Transfer';
      case 'fee': return 'Fee';
      case 'marketing': return 'Marketing';
      case 'advertising': return 'Advertising';
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

  const filteredTransactions = transactions.filter(transaction => {
    const matchesSearch = 
      getDomainName(transaction.domain_id).toLowerCase().includes(searchTerm.toLowerCase()) ||
      transaction.notes.toLowerCase().includes(searchTerm.toLowerCase()) ||
      transaction.platform?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = typeFilter === 'all' || transaction.type === typeFilter;
    
    return matchesSearch && matchesType;
  });

  const typeOptions = [
    { value: 'all', label: 'All Types' },
    { value: 'buy', label: 'Purchase' },
    { value: 'sell', label: 'Sale' },
    { value: 'renew', label: 'Renewal' },
    { value: 'transfer', label: 'Transfer' },
    { value: 'fee', label: 'Fee' },
    { value: 'marketing', label: 'Marketing' },
    { value: 'advertising', label: 'Advertising' }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Transaction History</h2>
          <p className="text-gray-600">Track all your domain-related transactions</p>
        </div>
        <button
          onClick={onAdd}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Transaction
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center space-y-4 sm:space-y-0 sm:space-x-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search transactions, domains, or notes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <Filter className="h-4 w-4 text-gray-400" />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {typeOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Results Count */}
      <div className="text-sm text-gray-600">
        Showing {filteredTransactions.length} of {transactions.length} transactions
      </div>

      {/* Transactions List */}
      {filteredTransactions.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-gray-400 mb-4">
            <FileText className="h-12 w-12 mx-auto" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {searchTerm || typeFilter !== 'all' ? 'No transactions found' : 'No transactions yet'}
          </h3>
          <p className="text-gray-600 mb-4">
            {searchTerm || typeFilter !== 'all' 
              ? 'Try adjusting your search or filter criteria'
              : 'Start tracking your domain investments by adding your first transaction'
            }
          </p>
          {!searchTerm && typeFilter === 'all' && (
            <button
              onClick={onAdd}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Transaction
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Domain
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Platform
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Notes
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredTransactions.map((transaction) => (
                  <tr key={transaction.id} className="hover:bg-gray-50">
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
                              净收入: {formatCurrency(transaction.net_amount || (transaction.amount - transaction.platform_fee), transaction.currency)}
                            </span>
                            <span className="text-xs text-gray-500 ml-2">
                              (手续费: {formatCurrency(transaction.platform_fee, transaction.currency)})
                            </span>
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
                      {transaction.platform || '-'}
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
                          className="text-blue-600 hover:text-blue-900"
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
}
