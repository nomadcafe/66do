'use client';

import { useState, useEffect } from 'react';
import { X, Save, Globe, Calendar, DollarSign, Tag } from 'lucide-react';
import { validateDomain, sanitizeDomainData } from '../../lib/validation';
import { DomainWithTags } from '../../types/dashboard';
import DateInput from '../ui/DateInput';

interface Domain {
  id: string;
  domain_name: string;
  registrar: string;
  purchase_date: string;
  purchase_cost: number;
  renewal_cost: number;
  renewal_cycle: number; // 续费周期（年数）：1, 2, 3等
  renewal_count: number; // 已续费次数
  next_renewal_date?: string;
  expiry_date?: string; // 改为可选字段
  status: 'active' | 'for_sale' | 'sold' | 'expired';
  estimated_value: number;
  tags: string[] | string;
}

interface DomainFormProps {
  domain?: DomainWithTags;
  isOpen: boolean;
  onClose: () => void;
  onSave: (domain: Omit<DomainWithTags, 'id'>) => void;
}

export default function DomainForm({ domain, isOpen, onClose, onSave }: DomainFormProps) {
  const [formData, setFormData] = useState({
    domain_name: '',
    registrar: '',
    purchase_date: '',
    purchase_cost: 0,
    renewal_cost: 0,
    renewal_cycle: 1, // 默认1年续费
    renewal_count: 0, // 默认未续费
    next_renewal_date: '',
    expiry_date: '',
    status: 'active' as 'active' | 'for_sale' | 'sold' | 'expired',
    estimated_value: 0,
    tags: [] as string[]
  });

  const [tagInput, setTagInput] = useState('');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  useEffect(() => {
    if (domain) {
      setFormData({
        domain_name: domain.domain_name,
        registrar: domain.registrar || '',
        purchase_date: domain.purchase_date || '',
        purchase_cost: domain.purchase_cost || 0,
        renewal_cost: domain.renewal_cost || 0,
        renewal_cycle: domain.renewal_cycle,
        renewal_count: domain.renewal_count,
        next_renewal_date: domain.next_renewal_date || '',
        expiry_date: domain.expiry_date || '',
        status: domain.status as 'active' | 'for_sale' | 'sold' | 'expired',
        estimated_value: domain.estimated_value || 0,
        tags: domain.tags
      });
    } else {
      setFormData({
        domain_name: '',
        registrar: '',
        purchase_date: '',
        purchase_cost: 0,
        renewal_cost: 0,
        renewal_cycle: 1,
        renewal_count: 0,
        next_renewal_date: '',
        expiry_date: '',
        status: 'active' as 'active' | 'for_sale' | 'sold' | 'expired',
        estimated_value: 0,
        tags: []
      });
    }
  }, [domain]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // 验证数据
    const sanitizedData = sanitizeDomainData(formData);
    const validation = validateDomain(sanitizedData);
    
    if (!validation.valid) {
      setValidationErrors(validation.errors);
      return;
    }
    
    setValidationErrors([]);
    onSave(sanitizedData as Omit<DomainWithTags, 'id'>);
    onClose();
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData({
        ...formData,
        tags: [...formData.tags, tagInput.trim()]
      });
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData({
      ...formData,
      tags: formData.tags.filter(tag => tag !== tagToRemove)
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">
            {domain ? 'Edit Domain' : 'Add New Domain'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* 验证错误显示 */}
          {validationErrors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h3 className="text-red-800 font-medium mb-2">请修正以下错误：</h3>
              <ul className="text-red-700 text-sm space-y-1">
                {validationErrors.map((error, index) => (
                  <li key={index}>• {error}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Globe className="h-4 w-4 inline mr-1" />
                Domain Name *
              </label>
              <input
                type="text"
                required
                value={formData.domain_name}
                onChange={(e) => setFormData({ ...formData, domain_name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Registrar
              </label>
              <input
                type="text"
                value={formData.registrar}
                onChange={(e) => setFormData({ ...formData, registrar: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="GoDaddy, Namecheap, etc."
              />
            </div>

            <DateInput
              label="Purchase Date"
              icon={<Calendar className="h-4 w-4" />}
              value={formData.purchase_date}
              onChange={(value) => setFormData({ ...formData, purchase_date: value })}
              required
              className="w-full"
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar className="h-4 w-4 inline mr-1" />
                Next Renewal Date
              </label>
              <input
                type="date"
                value={formData.next_renewal_date}
                onChange={(e) => setFormData({ ...formData, next_renewal_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <DateInput
              label="Expiry Date"
              icon={<Calendar className="h-4 w-4" />}
              value={formData.expiry_date}
              onChange={(value) => setFormData({ ...formData, expiry_date: value })}
              className="w-full"
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <DollarSign className="h-4 w-4 inline mr-1" />
                Purchase Cost *
              </label>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                value={formData.purchase_cost}
                onChange={(e) => setFormData({ ...formData, purchase_cost: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <DollarSign className="h-4 w-4 inline mr-1" />
                Renewal Cost
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.renewal_cost}
                onChange={(e) => setFormData({ ...formData, renewal_cost: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0.00"
              />
            </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Calendar className="h-4 w-4 inline mr-1" />
            Renewal Cycle (Years)
          </label>
          <select
            value={formData.renewal_cycle}
            onChange={(e) => setFormData({ ...formData, renewal_cycle: parseInt(e.target.value) })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value={1}>1 Year (e.g., .com, .net)</option>
            <option value={2}>2 Years (e.g., .ai)</option>
            <option value={3}>3 Years (e.g., .tt)</option>
            <option value={5}>5 Years</option>
            <option value={10}>10 Years</option>
          </select>
          <p className="text-xs text-gray-500 mt-1">
            选择域名的续费周期，用于计算年度续费成本
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Calendar className="h-4 w-4 inline mr-1" />
            Renewal Count (已续费次数)
          </label>
          <input
            type="number"
            min="0"
            value={formData.renewal_count}
            onChange={(e) => setFormData({ ...formData, renewal_count: parseInt(e.target.value) || 0 })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="输入已续费次数"
          />
          <p className="text-xs text-gray-500 mt-1">
            输入该域名已经续费的次数，用于计算总持有成本
          </p>
        </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <DollarSign className="h-4 w-4 inline mr-1" />
                Estimated Value
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.estimated_value}
                onChange={(e) => setFormData({ ...formData, estimated_value: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as 'active' | 'for_sale' | 'sold' | 'expired' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="active">Active</option>
                <option value="for_sale">For Sale</option>
                <option value="sold">Sold</option>
                <option value="expired">Expired</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Tag className="h-4 w-4 inline mr-1" />
              Tags
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {formData.tags.map((tag, index) => (
                <span
                  key={index}
                  className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="ml-2 text-blue-600 hover:text-blue-800"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex space-x-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyPress={handleKeyPress}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Add a tag..."
              />
              <button
                type="button"
                onClick={handleAddTag}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
              >
                Add
              </button>
            </div>
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
              <span>{domain ? 'Update Domain' : 'Add Domain'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
