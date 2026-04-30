'use client';

import { useState, useEffect } from 'react';
import { Domain } from '../../types/domain';
import { DomainWithTags } from '../../types/dashboard';
import { validateExpiryDate } from '../../lib/domainExpiryManager';
import { localCalendarDateISO } from '../../lib/localCalendarDate';
// import { useI18nContext } from '../../contexts/I18nProvider';
import { Calendar, AlertCircle, Info } from 'lucide-react';
import DateInput from '../ui/DateInput';

const COMMON_RENEWAL_CYCLES = [1, 2, 3, 5, 10] as const;
const CUSTOM_CYCLE_SENTINEL = 'custom';

interface SmartDomainFormProps {
  domain?: DomainWithTags;
  isOpen: boolean;
  onClose: () => void;
  onSave: (domain: Omit<DomainWithTags, 'id'>) => void;
}

export default function SmartDomainForm({ domain, isOpen, onClose, onSave }: SmartDomainFormProps) {
  // const { t } = useI18nContext();
  const [formData, setFormData] = useState<Omit<DomainWithTags, 'id'>>({
    user_id: '',
    domain_name: '',
    registrar: '',
    purchase_date: '',
    purchase_cost: 0,
    renewal_cost: 0,
    renewal_cycle: 1,
    renewal_count: 0,
    baseline_renewal_as_of: localCalendarDateISO(),
    next_renewal_date: '',
    expiry_date: '',
    status: 'active',
    estimated_value: 0,
    sale_date: null,
    sale_price: null,
    platform_fee: null,
    tags: [],
    created_at: '',
    updated_at: ''
  });

  const [expiryValidation, setExpiryValidation] = useState<{
    isValid: boolean;
    warnings: string[];
    suggestions: string[];
  } | null>(null);
  const [useCustomCycle, setUseCustomCycle] = useState(false);

  useEffect(() => {
    if (domain) {
      setFormData(domain);
      setUseCustomCycle(!COMMON_RENEWAL_CYCLES.includes(domain.renewal_cycle as 1 | 2 | 3 | 5 | 10));
    } else {
      setFormData({
        user_id: '',
        domain_name: '',
        registrar: '',
        purchase_date: '',
        purchase_cost: 0,
        renewal_cost: 0,
        renewal_cycle: 1,
        renewal_count: 0,
        baseline_renewal_as_of: localCalendarDateISO(),
        next_renewal_date: '',
        expiry_date: '',
        status: 'active',
        estimated_value: 0,
        sale_date: null,
        sale_price: null,
        platform_fee: null,
        tags: [],
        created_at: '',
        updated_at: ''
      });
      setUseCustomCycle(false);
    }
  }, [domain]);


  // 验证到期日期
  useEffect(() => {
    if (formData.expiry_date) {
      const validation = validateExpiryDate({
        ...formData,
        id: 'temp'
      } as Domain, formData.expiry_date);
      setExpiryValidation(validation);
    } else {
      setExpiryValidation(null);
    }
  }, [formData.expiry_date, formData.purchase_date, formData.renewal_cycle, formData]);

  const handleInputChange = (
    field: keyof Domain,
    value: string | number | string[] | null
  ) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-stone-900">
              {domain ? '编辑域名' : '添加域名'}
            </h2>
            <button
              onClick={onClose}
              className="text-stone-400 hover:text-stone-600"
            >
              ✕
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 基本信息 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">
                  域名名称 *
                </label>
                <input
                  type="text"
                  value={formData.domain_name}
                  onChange={(e) => handleInputChange('domain_name', e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="example.com"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">
                  注册商
                </label>
                <input
                  type="text"
                  value={formData.registrar || ''}
                  onChange={(e) => handleInputChange('registrar', e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="GoDaddy, Namecheap, etc."
                />
              </div>
            </div>

            {/* 购买信息 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <DateInput
                label="购买日期"
                value={formData.purchase_date || ''}
                onChange={(value) => handleInputChange('purchase_date', value)}
                required
                className="w-full"
              />

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">
                  购买价格
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.purchase_cost || 0}
                  onChange={(e) => handleInputChange('purchase_cost', parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">
                  续费周期（年）
                </label>
                {useCustomCycle ? (
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={formData.renewal_cycle === 0 ? '' : formData.renewal_cycle}
                    onChange={(e) =>
                      handleInputChange(
                        'renewal_cycle',
                        Math.min(10, Math.max(1, parseInt(e.target.value, 10) || 1))
                      )
                    }
                    className="w-full px-3 py-2 border border-stone-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="输入 1–10 的整数"
                  />
                ) : (
                  <select
                    value={formData.renewal_cycle}
                    onChange={(e) => {
                      if (e.target.value === CUSTOM_CYCLE_SENTINEL) {
                        setUseCustomCycle(true);
                        if (
                          COMMON_RENEWAL_CYCLES.includes(
                            formData.renewal_cycle as 1 | 2 | 3 | 5 | 10
                          )
                        ) {
                          handleInputChange('renewal_cycle', 4);
                        }
                        return;
                      }
                      handleInputChange('renewal_cycle', parseInt(e.target.value, 10) || 1);
                    }}
                    className="w-full px-3 py-2 border border-stone-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value={1}>1年</option>
                    <option value={2}>2年</option>
                    <option value={3}>3年</option>
                    <option value={5}>5年</option>
                    <option value={10}>10年</option>
                    <option value={CUSTOM_CYCLE_SENTINEL}>自定义…</option>
                  </select>
                )}
              </div>
            </div>

            {/* 续费信息 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">
                  续费费用
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.renewal_cost || 0}
                  onChange={(e) => handleInputChange('renewal_cost', parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">
                  已续费次数
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.renewal_count}
                  onChange={(e) => handleInputChange('renewal_count', parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* 编辑模式才暴露——参见 DomainForm.tsx 的同名字段说明 */}
            {domain && (
              <div className="space-y-1">
                <DateInput
                  label="续费成本基线日"
                  value={
                    formData.baseline_renewal_as_of != null
                      ? String(formData.baseline_renewal_as_of).slice(0, 10)
                      : ''
                  }
                  onChange={(value) =>
                    handleInputChange('baseline_renewal_as_of', value.trim() ? value.slice(0, 10) : null)
                  }
                  className="w-full max-w-md"
                />
                <p className="text-xs text-stone-500">
                  基线日及之后的续费交易会累加到持有成本；之前的续费由「已续费次数 × 续费成本」一次性概括。清空则不按交易叠加（旧版行为）。
                </p>
              </div>
            )}

            {/* 到期日期输入 */}
            <div className="border-t pt-6">
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-stone-900 flex items-center mb-2">
                  <Calendar className="h-5 w-5 mr-2" />
                  到期日期（选填）
                </h3>
                <p className="text-sm text-stone-600 mb-4">
                  可不填；填写后即将到期提醒与分析更准确，之后也可在编辑中补全。若填写，建议以注册商或 WHOIS 为准。
                </p>
              </div>

              <DateInput
                label="到期日期（选填）"
                value={formData.expiry_date || ''}
                onChange={(value) => handleInputChange('expiry_date', value)}
                className="w-full"
              />
              <p className="text-xs text-stone-500 mt-1">
                选填。可查注册商后台或 WHOIS 获取准确到期日。
              </p>

              {/* 验证结果 */}
              {expiryValidation && (
                <div className={`mt-3 p-3 rounded-lg ${
                  expiryValidation.isValid 
                    ? 'bg-emerald-50 border border-emerald-200' 
                    : 'bg-red-50 border border-red-200'
                }`}>
                  {expiryValidation.warnings.length > 0 && (
                    <div className="flex items-start mb-2">
                      <AlertCircle className="h-4 w-4 text-red-600 mr-2 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-red-900">警告：</p>
                        <ul className="text-xs text-red-700 list-disc list-inside">
                          {expiryValidation.warnings.map((warning, index) => (
                            <li key={index}>{warning}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                  
                  {expiryValidation.suggestions.length > 0 && (
                    <div className="flex items-start">
                      <Info className="h-4 w-4 text-blue-600 mr-2 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-blue-900">建议：</p>
                        <ul className="text-xs text-blue-700 list-disc list-inside">
                          {expiryValidation.suggestions.map((suggestion, index) => (
                            <li key={index}>{suggestion}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 其他信息 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">
                  预估价值
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.estimated_value || 0}
                  onChange={(e) => handleInputChange('estimated_value', parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">
                  状态
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => handleInputChange('status', e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="active">活跃</option>
                  <option value="for_sale">出售中</option>
                  <option value="sold">已出售</option>
                  <option value="expired">已过期</option>
                </select>
              </div>
            </div>

            {/* 提交按钮 */}
            <div className="flex justify-end space-x-3 pt-6 border-t">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-stone-700 bg-stone-100 rounded-md hover:bg-stone-200"
              >
                取消
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                {domain ? '更新' : '添加'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
