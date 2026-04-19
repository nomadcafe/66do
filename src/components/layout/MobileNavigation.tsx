'use client';

import { useState } from 'react';
import {
  Menu,
  X,
  Globe,
  DollarSign,
  PieChart,
  Settings,
} from 'lucide-react';
import { useI18nContext } from '../../contexts/I18nProvider';

type TabId = 'portfolio' | 'activity' | 'insights';

interface MobileNavigationProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  onOpenSettings: () => void;
  expiringCount: number;
}

export default function MobileNavigation({ activeTab, onTabChange, onOpenSettings, expiringCount }: MobileNavigationProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { t, locale, setLocale } = useI18nContext();

  const navigationItems: Array<{ id: TabId; label: string; icon: typeof Globe; badge?: number }> = [
    { id: 'portfolio', label: t('dashboard.portfolio'), icon: Globe, badge: expiringCount },
    { id: 'activity', label: t('dashboard.activity'), icon: DollarSign },
    { id: 'insights', label: t('dashboard.insights'), icon: PieChart },
  ];

  return (
    <>
      {/* Mobile Menu Button */}
      <div className="lg:hidden fixed bottom-4 right-4 z-50">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="bg-teal-600 text-white p-4 rounded-full shadow-lg hover:bg-teal-700 transition-colors"
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

          {/* Language switcher */}
          <div className="px-4 pt-1 pb-3 flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500">{t('settings.selectLanguage')}</span>
            <div className="flex gap-1 p-1 rounded-lg bg-gray-100">
              <button
                onClick={() => setLocale('zh')}
                className={`px-3 py-1 rounded-md text-xs font-medium transition ${
                  locale === 'zh' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'
                }`}
              >
                中文
              </button>
              <button
                onClick={() => setLocale('en')}
                className={`px-3 py-1 rounded-md text-xs font-medium transition ${
                  locale === 'en' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'
                }`}
              >
                English
              </button>
            </div>
          </div>

          {/* Navigation Items */}
          <div className="px-4 pb-4">
            <div className="grid grid-cols-3 gap-2">
              {navigationItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;

                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      onTabChange(item.id);
                      setIsOpen(false);
                    }}
                    className={`flex flex-col items-center p-4 rounded-xl transition-colors ${
                      isActive
                        ? 'bg-teal-100 text-teal-700'
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

          {/* Settings entry — opens drawer */}
          <div className="px-4 pb-6 border-t border-gray-100 pt-3">
            <button
              onClick={() => {
                setIsOpen(false);
                onOpenSettings();
              }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <Settings size={18} />
              <span className="text-sm font-medium">{t('dashboard.settings')}</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
