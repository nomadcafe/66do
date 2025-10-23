'use client';

import { useState } from 'react';
import { 
  Menu, 
  X, 
  Home, 
  Globe, 
  DollarSign, 
  BarChart3, 
  Bell, 
  Settings, 
  Database,
  TrendingUp
} from 'lucide-react';
import { useI18nContext } from '../../contexts/I18nProvider';

interface MobileNavigationProps {
  activeTab: 'overview' | 'domains' | 'transactions' | 'analytics' | 'alerts' | 'marketplace' | 'settings' | 'data' | 'reports';
  onTabChange: (tab: 'overview' | 'domains' | 'transactions' | 'analytics' | 'alerts' | 'marketplace' | 'settings' | 'data' | 'reports') => void;
  expiringCount: number;
}

export default function MobileNavigation({ activeTab, onTabChange, expiringCount }: MobileNavigationProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { t } = useI18nContext();

  const navigationItems = [
    { id: 'overview', label: t('navigation.overview'), icon: Home },
    { id: 'domains', label: t('navigation.domains'), icon: Globe },
    { id: 'transactions', label: t('navigation.transactions'), icon: DollarSign },
    { id: 'analytics', label: t('navigation.analytics'), icon: BarChart3 },
    { id: 'alerts', label: t('navigation.alerts'), icon: Bell, badge: expiringCount },
    { id: 'marketplace', label: t('navigation.marketplace'), icon: TrendingUp },
    { id: 'settings', label: t('navigation.settings'), icon: Settings },
    { id: 'data', label: t('navigation.data'), icon: Database }
  ];

  return (
    <>
      {/* Mobile Menu Button */}
      <div className="lg:hidden fixed bottom-4 right-4 z-50">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="bg-blue-600 text-white p-4 rounded-full shadow-lg hover:bg-blue-700 transition-colors"
        >
          {isOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Navigation Overlay */}
      {isOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black bg-opacity-50" onClick={() => setIsOpen(false)} />
      )}

      {/* Mobile Navigation Panel */}
      <div className={`lg:hidden fixed bottom-0 left-0 right-0 z-50 transform transition-transform duration-300 ${
        isOpen ? 'translate-y-0' : 'translate-y-full'
      }`}>
        <div className="bg-white rounded-t-2xl shadow-2xl">
          {/* Handle */}
          <div className="flex justify-center py-2">
            <div className="w-12 h-1 bg-gray-300 rounded-full" />
          </div>

          {/* Navigation Items */}
          <div className="px-4 pb-6">
            <div className="grid grid-cols-2 gap-2">
              {navigationItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      onTabChange(item.id as 'overview' | 'domains' | 'transactions' | 'analytics' | 'alerts' | 'marketplace' | 'settings' | 'data' | 'reports');
                      setIsOpen(false);
                    }}
                    className={`flex flex-col items-center p-4 rounded-xl transition-colors ${
                      isActive 
                        ? 'bg-blue-100 text-blue-600' 
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <div className="relative">
                      <Icon size={20} />
                      {item.badge && item.badge > 0 && (
                        <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                          {item.badge}
                        </span>
                      )}
                    </div>
                    <span className="text-xs mt-1 font-medium">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
