'use client';

import { useEffect, useState, useCallback } from 'react';
import { Domain } from '../../types/domain';
import { DomainWithTags } from '../../types/dashboard';
import { DomainMonitor, DomainExpiryInfo } from '../../lib/domainMonitoring';
import { useI18nContext } from '../../contexts/I18nProvider';
import { AlertTriangle, Clock, CheckCircle, XCircle } from 'lucide-react';

interface AutoDomainMonitorProps {
  domains: DomainWithTags[];
  onDomainExpiry?: (expiryInfo: DomainExpiryInfo) => void;
  onBulkExpiry?: (expiryInfos: DomainExpiryInfo[]) => void;
  autoStart?: boolean;
  showNotifications?: boolean;
}

export default function AutoDomainMonitor({ 
  domains, 
  onDomainExpiry,
  onBulkExpiry,
  autoStart = true,
  showNotifications = true
}: AutoDomainMonitorProps) {
  const [monitor] = useState(() => new DomainMonitor());
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [lastCheckTime, setLastCheckTime] = useState<Date | null>(null);
  const [expiryAlerts, setExpiryAlerts] = useState<DomainExpiryInfo[]>([]);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  const { t } = useI18nContext();

  // 请求通知权限
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then(permission => {
        setNotificationPermission(permission);
      });
    } else if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  // 显示浏览器通知
  const showBrowserNotification = useCallback((message: string, icon?: string) => {
    if (notificationPermission === 'granted' && showNotifications) {
      new Notification(t('monitoring.notificationTitle'), {
        body: message,
        icon: icon || '/favicon.ico',
        tag: 'domain-expiry',
        requireInteraction: true
      });
    }
  }, [notificationPermission, showNotifications]);

  // 处理域名到期提醒
  const handleExpiryAlert = useCallback((alerts: DomainExpiryInfo[]) => {
    setExpiryAlerts(alerts);
    setLastCheckTime(new Date());

    // 触发回调
    if (onBulkExpiry) {
      onBulkExpiry(alerts);
    }

    // 显示通知
    if (alerts.length > 0) {
      const criticalAlerts = alerts.filter(alert => alert.urgency === 'critical');
      const urgentAlerts = alerts.filter(alert => alert.urgency === 'urgent');

      if (criticalAlerts.length > 0) {
        const message = criticalAlerts.length === 1 
          ? monitor.generateAlertMessage(criticalAlerts[0])
          : t('monitoring.criticalDomainsAlert').replace('{count}', criticalAlerts.length.toString());
        showBrowserNotification(message);
      } else if (urgentAlerts.length > 0) {
        const message = urgentAlerts.length === 1
          ? monitor.generateAlertMessage(urgentAlerts[0])
          : t('monitoring.urgentDomainsAlert').replace('{count}', urgentAlerts.length.toString());
        showBrowserNotification(message);
      }

      // 单个域名回调
      alerts.forEach(alert => {
        if (onDomainExpiry) {
          onDomainExpiry(alert);
        }
      });
    }
  }, [monitor, onDomainExpiry, onBulkExpiry, showBrowserNotification]);

  // 启动监控
  const startMonitoring = useCallback(() => {
    if (!isMonitoring) {
      monitor.startMonitoring(domains, handleExpiryAlert);
      setIsMonitoring(true);
    }
  }, [monitor, domains, handleExpiryAlert, isMonitoring]);

  // 停止监控
  const stopMonitoring = useCallback(() => {
    if (isMonitoring) {
      monitor.stopMonitoring();
      setIsMonitoring(false);
    }
  }, [monitor, isMonitoring]);

  // 手动检查
  const checkNow = useCallback(() => {
    const alerts = monitor.getExpiringDomains(domains);
    handleExpiryAlert(alerts);
  }, [monitor, domains, handleExpiryAlert]);

  // 自动启动监控
  useEffect(() => {
    if (autoStart && domains.length > 0) {
      startMonitoring();
    }

    return () => {
      stopMonitoring();
    };
  }, [autoStart, domains.length, startMonitoring, stopMonitoring]);

  // 更新监控设置
  // const updateSettings = useCallback((settings: Partial<typeof monitor.getSettings>) => {
  //   monitor.updateSettings(settings);
  // }, [monitor]);

  // 获取监控统计
  const getMonitoringStats = useCallback(() => {
    const allExpiryInfo = monitor.checkDomainExpiry(domains);
    const critical = allExpiryInfo.filter(info => info.urgency === 'critical').length;
    const urgent = allExpiryInfo.filter(info => info.urgency === 'urgent').length;
    const warning = allExpiryInfo.filter(info => info.urgency === 'warning').length;
    const expired = allExpiryInfo.filter(info => info.isExpired).length;

    return {
      total: allExpiryInfo.length,
      critical,
      urgent,
      warning,
      expired,
      lastCheck: monitor.getLastCheckTime()
    };
  }, [monitor, domains]);

  const stats = getMonitoringStats();

  return (
    <div className="bg-white rounded-lg shadow-sm border p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Clock className="h-5 w-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">{t('monitoring.title')}</h3>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={isMonitoring ? stopMonitoring : startMonitoring}
            className={`px-3 py-1 rounded-md text-sm font-medium ${
              isMonitoring 
                ? 'bg-red-100 text-red-700 hover:bg-red-200' 
                : 'bg-green-100 text-green-700 hover:bg-green-200'
            }`}
          >
            {isMonitoring ? t('monitoring.stopMonitoring') : t('monitoring.startMonitoring')}
          </button>
          <button
            onClick={checkNow}
            className="px-3 py-1 bg-blue-100 text-blue-700 rounded-md text-sm font-medium hover:bg-blue-200"
          >
            {t('monitoring.checkNow')}
          </button>
        </div>
      </div>

      {/* 监控状态 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div className="text-center">
          <div className="flex items-center justify-center mb-1">
            <XCircle className="h-4 w-4 text-red-500" />
          </div>
          <div className="text-2xl font-bold text-red-600">{stats.expired}</div>
          <div className="text-xs text-gray-600">{t('monitoring.expired')}</div>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center mb-1">
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </div>
          <div className="text-2xl font-bold text-orange-600">{stats.critical}</div>
          <div className="text-xs text-gray-600">{t('monitoring.critical')}</div>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center mb-1">
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          </div>
          <div className="text-2xl font-bold text-yellow-600">{stats.urgent}</div>
          <div className="text-xs text-gray-600">{t('monitoring.urgent')}</div>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center mb-1">
            <CheckCircle className="h-4 w-4 text-green-500" />
          </div>
          <div className="text-2xl font-bold text-green-600">{stats.warning}</div>
          <div className="text-xs text-gray-600">{t('monitoring.warning')}</div>
        </div>
      </div>

      {/* 当前提醒 */}
      {expiryAlerts.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-900">{t('monitoring.currentAlerts')}</h4>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {expiryAlerts.map((alert, index) => (
              <div
                key={`${alert.domain.id}-${index}`}
                className={`p-2 rounded-md text-sm ${
                  alert.urgency === 'critical' ? 'bg-red-50 text-red-800' :
                  alert.urgency === 'urgent' ? 'bg-orange-50 text-orange-800' :
                  alert.urgency === 'warning' ? 'bg-yellow-50 text-yellow-800' :
                  'bg-blue-50 text-blue-800'
                }`}
              >
                {monitor.generateAlertMessage(alert)}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 最后检查时间 */}
      {lastCheckTime && (
        <div className="mt-4 text-xs text-gray-500">
          {t('monitoring.lastCheck')}: {lastCheckTime.toLocaleString()}
        </div>
      )}
    </div>
  );
}
