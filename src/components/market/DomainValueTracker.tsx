'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { TrendingUp, TrendingDown, DollarSign, Globe, RefreshCw } from 'lucide-react';

interface Domain {
  id: string;
  domain_name: string;
  estimated_value: number;
  purchase_cost: number;
  status: 'active' | 'for_sale' | 'sold' | 'expired';
}

interface MarketValue {
  domain_name: string;
  current_value: number;
  previous_value: number;
  change_percentage: number;
  trend: 'up' | 'down' | 'stable';
  last_updated: string;
}

interface DomainValueTrackerProps {
  domains: Domain[];
  onUpdateValue: (domainId: string, newValue: number) => void;
}

export default function DomainValueTracker({ domains, onUpdateValue }: DomainValueTrackerProps) {
  const [marketValues, setMarketValues] = useState<MarketValue[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  // 模拟市场价值数据（实际应用中应该从API获取）
  const fetchMarketValues = useCallback(async () => {
    setLoading(true);
    try {
      // 模拟API调用延迟
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const mockValues: MarketValue[] = domains
        .filter(domain => domain.status === 'active')
        .map(domain => {
          const baseValue = domain.estimated_value;
          const changePercent = (Math.random() - 0.5) * 20; // -10% 到 +10% 的随机变化
          const newValue = baseValue * (1 + changePercent / 100);
          
          return {
            domain_name: domain.domain_name,
            current_value: Math.round(newValue),
            previous_value: baseValue,
            change_percentage: Math.round(changePercent * 100) / 100,
            trend: changePercent > 2 ? 'up' : changePercent < -2 ? 'down' : 'stable',
            last_updated: new Date().toISOString()
          };
        });
      
      setMarketValues(mockValues);
      setLastUpdated(new Date().toLocaleString());
    } catch (error) {
      console.error('获取市场价值失败:', error);
    } finally {
      setLoading(false);
    }
  }, [domains]);

  useEffect(() => {
    if (domains.length > 0) {
      fetchMarketValues();
    }
  }, [domains, fetchMarketValues]);

  const updateDomainValue = (domainId: string, newValue: number) => {
    onUpdateValue(domainId, newValue);
    // 更新本地市场价值数据
    setMarketValues(prev => 
      prev.map(mv => 
        mv.domain_name === domains.find(d => d.id === domainId)?.domain_name
          ? { ...mv, current_value: newValue, previous_value: mv.current_value }
          : mv
      )
    );
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'down':
        return <TrendingDown className="h-4 w-4 text-red-600" />;
      default:
        return <DollarSign className="h-4 w-4 text-gray-600" />;
    }
  };

  const getTrendColor = (trend: string, changePercent: number) => {
    if (trend === 'up' || changePercent > 0) return 'text-green-600';
    if (trend === 'down' || changePercent < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      <div className="p-6 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Globe className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">域名市场价值追踪</h3>
              <p className="text-sm text-gray-600">
                实时监控域名市场价值变化
                {lastUpdated && ` • 最后更新: ${lastUpdated}`}
              </p>
            </div>
          </div>
          <button
            onClick={fetchMarketValues}
            disabled={loading}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? '更新中...' : '刷新数据'}</span>
          </button>
        </div>
      </div>

      <div className="p-6">
        {marketValues.length === 0 ? (
          <div className="text-center py-8">
            <Globe className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">暂无域名数据</p>
          </div>
        ) : (
          <div className="space-y-4">
            {marketValues.map((value, index) => {
              const domain = domains.find(d => d.domain_name === value.domain_name);
              if (!domain) return null;

              return (
                <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-4">
                    <div className="p-2 bg-white rounded-lg">
                      <Globe className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">{value.domain_name}</h4>
                      <p className="text-sm text-gray-600">
                        购买价格: {formatCurrency(domain.purchase_cost)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-6">
                    <div className="text-right">
                      <div className="flex items-center space-x-2">
                        {getTrendIcon(value.trend)}
                        <span className="text-lg font-semibold">
                          {formatCurrency(value.current_value)}
                        </span>
                      </div>
                      <p className={`text-sm ${getTrendColor(value.trend, value.change_percentage)}`}>
                        {value.change_percentage > 0 ? '+' : ''}{value.change_percentage}%
                      </p>
                    </div>

                    <div className="flex space-x-2">
                      <input
                        type="number"
                        value={value.current_value}
                        onChange={(e) => {
                          const newValue = parseFloat(e.target.value) || 0;
                          updateDomainValue(domain.id, newValue);
                        }}
                        className="w-24 px-2 py-1 border border-gray-300 rounded text-sm"
                        placeholder="新价值"
                      />
                      <button
                        onClick={() => updateDomainValue(domain.id, value.current_value)}
                        className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                      >
                        更新
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
