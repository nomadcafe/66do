'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, Calendar, Clock, CheckCircle, RefreshCw, Globe, Database } from 'lucide-react';
import { Domain } from '../../types/domain';
import { domainExpiryService, DomainExpiryInfo } from '../../lib/domainExpiryService';
import { useI18nContext } from '../../contexts/I18nProvider';

interface DomainExpiryManagerProps {
  domains: Domain[];
  onRenewDomain?: (domainId: string) => void;
  onUpdateDomain?: (domain: Domain) => void;
  autoRefresh?: boolean;
  refreshInterval?: number; // 分钟
}

export default function DomainExpiryManager({
  domains,
  onRenewDomain,
  onUpdateDomain,
  autoRefresh = true,
  refreshInterval = 60
}: DomainExpiryManagerProps) {
  const { t } = useI18nContext();
  const [expiryInfos, setExpiryInfos] = useState<DomainExpiryInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [whoisSyncing, setWhoisSyncing] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    whoisVerified: 0
  });

  // 分析域名到期情况
  const analyzeExpiry = useCallback(async () => {
    setLoading(true);
    try {
      const results = await domainExpiryService.analyzeDomainExpiry(domains);
      setExpiryInfos(results);
      setStats(domainExpiryService.getExpiryStats(domains));
      setLastUpdate(new Date());
    } catch (error) {
      console.error(t('monitoring.analysisFailed'), error);
    } finally {
      setLoading(false);
    }
  }, [domains, t]);

  // 同步WHOIS数据
  const syncWhoisData = useCallback(async () => {
    setWhoisSyncing(true);
    try {
      const result = await domainExpiryService.syncWhoisData(domains);
      console.log(t('monitoring.whoisSyncComplete').replace('{updated}', result.updated.toString()).replace('{errors}', result.errors.toString()));
      
      // 重新分析到期情况
      await analyzeExpiry();
      
      // 通知父组件更新域名数据
      if (onUpdateDomain && result.updated > 0) {
        // 这里可以触发父组件重新加载域名数据
        console.log(t('monitoring.suggestRefreshData'));
      }
    } catch (error) {
      console.error(t('monitoring.whoisSyncFailed'), error);
    } finally {
      setWhoisSyncing(false);
    }
  }, [domains, analyzeExpiry, onUpdateDomain, t]);

  // 初始加载
  useEffect(() => {
    analyzeExpiry();
  }, [analyzeExpiry]);

  // 自动刷新
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      analyzeExpiry();
    }, refreshInterval * 60 * 1000);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, analyzeExpiry]);

  // 获取优先级颜色
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'text-red-600 bg-red-50 border-red-200';
      case 'high': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'low': return 'text-blue-600 bg-blue-50 border-blue-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  // 获取优先级图标
  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'critical': return <AlertTriangle className="h-4 w-4" />;
      case 'high': return <Clock className="h-4 w-4" />;
      case 'medium': return <Calendar className="h-4 w-4" />;
      case 'low': return <CheckCircle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* 统计信息 */}
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            {t('domain.expiryMonitoring')}
          </h3>
          <div className="flex items-center space-x-2">
            <button
              onClick={analyzeExpiry}
              disabled={loading}
              className="flex items-center px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
              {t('common.refresh')}
            </button>
            <button
              onClick={syncWhoisData}
              disabled={whoisSyncing}
              className="flex items-center px-3 py-1 text-sm bg-green-100 text-green-700 rounded-md hover:bg-green-200 disabled:opacity-50"
            >
              <Globe className={`h-4 w-4 mr-1 ${whoisSyncing ? 'animate-spin' : ''}`} />
              {t('domain.syncWhois')}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
            <div className="text-sm text-gray-600">{t('domain.totalExpiring')}</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">{stats.critical}</div>
            <div className="text-sm text-gray-600">{t('domain.critical')}</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">{stats.high}</div>
            <div className="text-sm text-gray-600">{t('domain.high')}</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-600">{stats.medium}</div>
            <div className="text-sm text-gray-600">{t('domain.medium')}</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.low}</div>
            <div className="text-sm text-gray-600">{t('domain.low')}</div>
          </div>
        </div>

        {lastUpdate && (
          <div className="mt-4 text-sm text-gray-500">
            {t('domain.lastUpdate')}: {lastUpdate.toLocaleString()}
            {stats.whoisVerified > 0 && (
              <span className="ml-2 text-green-600">
                ({stats.whoisVerified} {t('domain.whoisVerified')})
              </span>
            )}
          </div>
        )}
      </div>

      {/* 到期域名列表 */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="p-6 border-b">
          <h3 className="text-lg font-semibold text-gray-900">
            {t('domain.expiringDomains')}
          </h3>
        </div>

        <div className="divide-y">
          {expiryInfos.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
              <p>{t('domain.noExpiringDomains')}</p>
            </div>
          ) : (
            expiryInfos.map((info) => (
              <div key={info.domain.id} className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getPriorityColor(info.priority)}`}>
                        {getPriorityIcon(info.priority)}
                        <span className="ml-1">{info.priority.toUpperCase()}</span>
                      </div>
                      <h4 className="text-lg font-medium text-gray-900">
                        {info.domain.domain_name}
                      </h4>
                      {info.isWhoisVerified && (
                        <div className="flex items-center text-green-600">
                          <Database className="h-4 w-4 mr-1" />
                          <span className="text-xs">WHOIS</span>
                        </div>
                      )}
                    </div>
                    
                    <p className="mt-2 text-sm text-gray-600">
                      {info.message}
                    </p>
                    
                    {info.whoisData && (
                      <div className="mt-2 text-xs text-gray-500">
                        {t('domain.registrar')}: {info.whoisData.registrar}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center space-x-2">
                    {info.daysUntilExpiry <= 7 && onRenewDomain && (
                      <button
                        onClick={() => onRenewDomain(info.domain.id)}
                        className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
                      >
                        {t('domain.renewNow')}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
