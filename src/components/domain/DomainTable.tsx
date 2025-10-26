'use client';

import { useState } from 'react';
import { Search, Plus, Edit, Trash2, Eye, Share2, Calendar, Tag, Globe } from 'lucide-react';
import DomainShareModal from '../share/DomainShareModal';

interface Domain {
  id: string;
  domain_name: string;
  registrar: string;
  purchase_date: string;
  purchase_cost: number;
  renewal_cost: number;
  renewal_cycle: number;
  renewal_count: number;
  next_renewal_date?: string;
  expiry_date?: string;
  status: 'active' | 'for_sale' | 'sold' | 'expired';
  estimated_value: number;
  sale_date?: string;
  sale_price?: number;
  platform_fee?: number;
  tags: string[] | string;
}

interface DomainTableProps {
  domains: Domain[];
  onEdit: (domain: Domain) => void;
  onDelete: (id: string) => void;
  onView: (domain: Domain) => void;
  onAdd: () => void;
}

export default function DomainTable({ domains, onEdit, onDelete, onView, onAdd }: DomainTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortField, setSortField] = useState('domain_name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [showShareModal, setShowShareModal] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState<Domain | null>(null);

  const filteredDomains = domains.filter(domain => {
    // 处理tags字段，可能是字符串或数组
    let tagsArray: string[] = [];
    if (Array.isArray(domain.tags)) {
      tagsArray = domain.tags;
    } else if (typeof domain.tags === 'string' && domain.tags.trim()) {
      try {
        tagsArray = JSON.parse(domain.tags);
      } catch {
        tagsArray = domain.tags.split(',').map(tag => tag.trim()).filter(tag => tag);
      }
    }
    
    const matchesSearch = domain.domain_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         domain.registrar.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         tagsArray.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = statusFilter === 'all' || domain.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const sortedDomains = [...filteredDomains].sort((a, b) => {
    let aValue: string | number = a[sortField as keyof Domain] as string | number;
    let bValue: string | number = b[sortField as keyof Domain] as string | number;

    if (sortField === 'purchase_cost' || sortField === 'renewal_cost' || sortField === 'estimated_value') {
      aValue = Number(aValue) || 0;
      bValue = Number(bValue) || 0;
    }

    if (sortDirection === 'asc') {
      return aValue > bValue ? 1 : -1;
    } else {
      return aValue < bValue ? 1 : -1;
    }
  });

  const statusOptions = [
    { value: 'all', label: 'All Status' },
    { value: 'active', label: 'Active' },
    { value: 'for_sale', label: 'For Sale' },
    { value: 'sold', label: 'Sold' },
    { value: 'expired', label: 'Expired' }
  ];

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'for_sale':
        return 'bg-yellow-100 text-yellow-800';
      case 'sold':
        return 'bg-blue-100 text-blue-800';
      case 'expired':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const calculateTotalHoldingCost = (domain: Domain) => {
    const totalRenewalCost = domain.renewal_count * domain.renewal_cost;
    return domain.purchase_cost + totalRenewalCost;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };


  const getDaysUntilExpiry = (expiryDate?: string) => {
    if (!expiryDate) return null;
    const today = new Date();
    const expiry = new Date(expiryDate);
    const diffTime = expiry.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getExpiryStatus = (domain: Domain) => {
    if (!domain.expiry_date) return null;
    const days = getDaysUntilExpiry(domain.expiry_date);
    if (days === null) return null;
    
    if (days < 0) return { text: 'Expired', color: 'text-red-600' };
    if (days <= 30) return { text: `${days}d`, color: 'text-red-500' };
    if (days <= 90) return { text: `${days}d`, color: 'text-yellow-500' };
    return { text: `${days}d`, color: 'text-green-500' };
  };

  return (
    <div className="space-y-4">
      {/* Search and Filter Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-2 flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search domains, registrar, or tags..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full sm:w-64"
            />
          </div>
          
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {statusOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={onAdd}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Domain
        </button>
      </div>

      {/* Results Count */}
      <div className="text-sm text-gray-600">
        Showing {sortedDomains.length} of {domains.length} domains
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th 
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('domain_name')}
                >
                  <div className="flex items-center gap-1">
                    Domain Name
                    {sortField === 'domain_name' && (
                      <span className="text-blue-600">
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center gap-1">
                    Status
                    {sortField === 'status' && (
                      <span className="text-blue-600">
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('purchase_cost')}
                >
                  <div className="flex items-center gap-1">
                    Cost
                    {sortField === 'purchase_cost' && (
                      <span className="text-blue-600">
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('estimated_value')}
                >
                  <div className="flex items-center gap-1">
                    Value
                    {sortField === 'estimated_value' && (
                      <span className="text-blue-600">
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Expiry
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ROI
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tags
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedDomains.map((domain) => {
                const totalHoldingCost = calculateTotalHoldingCost(domain);
                const roi = domain.status === 'sold' && domain.sale_price 
                  ? ((domain.sale_price - totalHoldingCost) / totalHoldingCost * 100)
                  : domain.estimated_value > 0 
                    ? ((domain.estimated_value - totalHoldingCost) / totalHoldingCost * 100)
                    : 0;
                
                const expiryStatus = getExpiryStatus(domain);

                return (
                  <tr key={domain.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Globe className="w-4 h-4 text-gray-400" />
                        <div>
                          <div className="font-medium text-gray-900">{domain.domain_name}</div>
                          <div className="text-sm text-gray-500">{domain.registrar}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(domain.status)}`}>
                        {domain.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-900">{formatCurrency(domain.purchase_cost)}</div>
                      {domain.renewal_count > 0 && (
                        <div className="text-xs text-gray-500">
                          +{domain.renewal_count} renewals
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {domain.status === 'sold' && domain.sale_price ? (
                        <div>
                          <div className="text-sm font-medium text-green-600">{formatCurrency(domain.sale_price)}</div>
                          <div className="text-xs text-gray-500">Sold</div>
                        </div>
                      ) : (
                        <div className="text-sm text-gray-900">{formatCurrency(domain.estimated_value)}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {expiryStatus ? (
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-gray-400" />
                          <span className={`text-sm ${expiryStatus.color}`}>
                            {expiryStatus.text}
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className={`text-sm font-medium ${roi >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {roi >= 0 ? '+' : ''}{roi.toFixed(1)}%
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(() => {
                          // 处理tags字段，可能是字符串或数组
                          let tagsArray: string[] = [];
                          if (Array.isArray(domain.tags)) {
                            tagsArray = domain.tags;
                          } else if (typeof domain.tags === 'string' && domain.tags.trim()) {
                            // 如果是字符串，尝试解析为数组
                            try {
                              tagsArray = JSON.parse(domain.tags);
                            } catch {
                              // 如果解析失败，按逗号分割
                              tagsArray = domain.tags.split(',').map(tag => tag.trim()).filter(tag => tag);
                            }
                          }
                          
                          return (
                            <>
                              {tagsArray.slice(0, 2).map((tag, index) => (
                                <span key={index} className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-800">
                                  <Tag className="w-3 h-3 mr-1" />
                                  {tag}
                                </span>
                              ))}
                              {tagsArray.length > 2 && (
                                <span className="text-xs text-gray-500">+{tagsArray.length - 2}</span>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => onView(domain)}
                          className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onEdit(domain)}
                          className="p-1 text-gray-400 hover:text-green-600 transition-colors"
                          title="Edit Domain"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        {domain.status === 'sold' && (
                          <button
                            onClick={() => {
                              setSelectedDomain(domain);
                              setShowShareModal(true);
                            }}
                            className="p-1 text-gray-400 hover:text-purple-600 transition-colors"
                            title="Share Sale"
                          >
                            <Share2 className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => onDelete(domain.id)}
                          className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                          title="Delete Domain"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Empty State */}
      {sortedDomains.length === 0 && (
        <div className="text-center py-12">
          <Globe className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No domains found</h3>
          <p className="mt-1 text-sm text-gray-500">
            {searchTerm || statusFilter !== 'all' 
              ? 'Try adjusting your search or filter criteria.'
              : 'Get started by adding your first domain.'
            }
          </p>
        </div>
      )}

      {/* Share Modal */}
      {showShareModal && selectedDomain && (
        <DomainShareModal
          isOpen={showShareModal}
          domain={selectedDomain}
          onClose={() => {
            setShowShareModal(false);
            setSelectedDomain(null);
          }}
        />
      )}
    </div>
  );
}
