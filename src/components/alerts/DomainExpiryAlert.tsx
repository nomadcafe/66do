'use client';

import React, { useState, useEffect } from 'react';
import { AlertTriangle, Calendar, Clock, CheckCircle } from 'lucide-react';
import { DomainWithTags } from '../../types/dashboard';

interface DomainExpiryAlertProps {
  domains: DomainWithTags[];
  onRenewDomain: (domainId: string) => void;
}

interface ExpiryAlert {
  domain: DomainWithTags;
  daysUntilExpiry: number;
  priority: 'high' | 'medium' | 'low';
  message: string;
}

export default function DomainExpiryAlert({ domains, onRenewDomain }: DomainExpiryAlertProps) {
  const [alerts, setAlerts] = useState<ExpiryAlert[]>([]);
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());

  useEffect(() => {
    const generateExpiryAlerts = () => {
      const newAlerts: ExpiryAlert[] = [];
      const now = new Date();

      domains.forEach(domain => {
        if (domain.status !== 'active') return;
        
        // 如果没有到期日期，跳过提醒
        if (!domain.expiry_date) return;

        const expiryDate = new Date(domain.expiry_date);
        const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        if (daysUntilExpiry <= 30 && daysUntilExpiry >= 0) {
          let priority: 'high' | 'medium' | 'low';
          let message: string;

          if (daysUntilExpiry <= 7) {
            priority = 'high';
            message = `域名 ${domain.domain_name} 将在 ${daysUntilExpiry} 天后到期！请立即续费。`;
          } else if (daysUntilExpiry <= 14) {
            priority = 'medium';
            message = `域名 ${domain.domain_name} 将在 ${daysUntilExpiry} 天后到期，建议尽快续费。`;
          } else {
            priority = 'low';
            message = `域名 ${domain.domain_name} 将在 ${daysUntilExpiry} 天后到期。`;
          }

          newAlerts.push({
            domain,
            daysUntilExpiry,
            priority,
            message
          });
        }
      });

      setAlerts(newAlerts);
    };

    generateExpiryAlerts();
  }, [domains]);

  const dismissAlert = (domainId: string) => {
    setDismissedAlerts(prev => new Set([...prev, domainId]));
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-50 border-red-200 text-red-800';
      case 'medium':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      case 'low':
        return 'bg-blue-50 border-blue-200 text-blue-800';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-800';
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'high':
        return <AlertTriangle className="h-5 w-5 text-red-600" />;
      case 'medium':
        return <Clock className="h-5 w-5 text-yellow-600" />;
      case 'low':
        return <Calendar className="h-5 w-5 text-blue-600" />;
      default:
        return <Calendar className="h-5 w-5 text-gray-600" />;
    }
  };

  const activeAlerts = alerts.filter(alert => !dismissedAlerts.has(alert.domain.id));

  if (activeAlerts.length === 0) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-center">
          <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
          <span className="text-green-800 font-medium">所有域名状态正常</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {activeAlerts.map((alert) => (
        <div
          key={alert.domain.id}
          className={`border rounded-lg p-4 ${getPriorityColor(alert.priority)}`}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-3">
              {getPriorityIcon(alert.priority)}
              <div className="flex-1">
                <p className="font-medium">{alert.message}</p>
                <div className="mt-2 text-sm">
                  <p>续费费用: ${alert.domain.renewal_cost}</p>
                  <p>续费周期: {alert.domain.renewal_cycle} 年</p>
                </div>
              </div>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => onRenewDomain(alert.domain.id)}
                className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
              >
                立即续费
              </button>
              <button
                onClick={() => dismissAlert(alert.domain.id)}
                className="px-3 py-1 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300 transition-colors"
              >
                稍后提醒
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
