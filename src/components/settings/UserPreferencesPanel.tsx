'use client';

import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Bell, 
  Shield, 
  Save, 
  RotateCcw,
  Eye,
  Mail,
  Smartphone,
  Calendar,
  DollarSign,
  Clock,
  Sun,
  Moon,
  Monitor,
  Grid,
  List
} from 'lucide-react';
import { useI18nContext } from '../../contexts/I18nProvider';

interface UserPreferences {
  // 基本设置
  language: 'zh' | 'en';
  timezone: string;
  theme: 'light' | 'dark' | 'auto';
  
  // 通知设置
  notifications: {
    email: boolean;
    push: boolean;
    renewalReminders: boolean;
    saleOpportunities: boolean;
    priceAlerts: boolean;
    weeklyReports: boolean;
  };
  
  // 隐私设置
  privacy: {
    profileVisibility: 'public' | 'friends' | 'private';
    showStats: boolean;
    showPortfolio: boolean;
    allowAnalytics: boolean;
  };
  
  // 投资偏好
  investment: {
    defaultCurrency: string;
    riskTolerance: 'low' | 'medium' | 'high';
    investmentGoal: 'short' | 'medium' | 'long';
    autoRenewal: boolean;
    priceAlertThreshold: number;
  };
  
  // 显示设置
  display: {
    defaultView: 'grid' | 'list';
    itemsPerPage: number;
    showAdvancedStats: boolean;
    compactMode: boolean;
  };
}

const defaultPreferences: UserPreferences = {
  language: 'zh',
  timezone: 'Asia/Shanghai',
  theme: 'auto',
  notifications: {
    email: true,
    push: true,
    renewalReminders: true,
    saleOpportunities: true,
    priceAlerts: true,
    weeklyReports: false
  },
  privacy: {
    profileVisibility: 'public',
    showStats: true,
    showPortfolio: true,
    allowAnalytics: true
  },
  investment: {
    defaultCurrency: 'USD',
    riskTolerance: 'medium',
    investmentGoal: 'medium',
    autoRenewal: false,
    priceAlertThreshold: 20
  },
  display: {
    defaultView: 'grid',
    itemsPerPage: 20,
    showAdvancedStats: true,
    compactMode: false
  }
};

export default function UserPreferencesPanel() {
  const [preferences, setPreferences] = useState<UserPreferences>(defaultPreferences);
  const [activeTab, setActiveTab] = useState('general');
  const [saving, setSaving] = useState(false);
  const { t } = useI18nContext();

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = () => {
    try {
      const saved = localStorage.getItem('66do_preferences');
      if (saved) {
        const parsed = JSON.parse(saved);
        setPreferences(prev => ({ ...prev, ...parsed }));
      }
    } catch (error) {
      console.error('Error loading preferences:', error);
    }
  };

  const savePreferences = async () => {
    setSaving(true);
    try {
      localStorage.setItem('66do_preferences', JSON.stringify(preferences));
      // 这里可以添加API调用来保存到服务器
      await new Promise(resolve => setTimeout(resolve, 1000)); // 模拟API调用
    } catch (error) {
      console.error('Error saving preferences:', error);
    } finally {
      setSaving(false);
    }
  };

  const resetPreferences = () => {
    setPreferences(defaultPreferences);
  };

  const updatePreference = (path: string, value: unknown) => {
    setPreferences(prev => {
      const newPrefs = { ...prev };
      const keys = path.split('.');
      let current: Record<string, unknown> = newPrefs;
      
      for (let i = 0; i < keys.length - 1; i++) {
        current = current[keys[i]] as Record<string, unknown>;
      }
      
      current[keys[keys.length - 1]] = value;
      return newPrefs;
    });
  };

  const tabs = [
    { id: 'general', label: t('dashboard.generalSettings'), icon: Settings },
    { id: 'notifications', label: t('dashboard.notificationSettings'), icon: Bell },
    { id: 'privacy', label: t('dashboard.privacySettings'), icon: Shield },
    { id: 'investment', label: t('dashboard.investmentSettings'), icon: DollarSign },
    { id: 'display', label: t('dashboard.displaySettings'), icon: Eye }
  ];

  const renderGeneralSettings = () => (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">{t('settings.language')}</label>
        <select
          value={preferences.language}
          onChange={(e) => updatePreference('language', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="zh">{t('settings.chinese')}</option>
          <option value="en">{t('settings.english')}</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">{t('settings.timezone')}</label>
        <select
          value={preferences.timezone}
          onChange={(e) => updatePreference('timezone', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="Asia/Shanghai">Asia/Shanghai</option>
          <option value="America/New_York">America/New_York</option>
          <option value="Europe/London">Europe/London</option>
          <option value="UTC">UTC</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">{t('settings.theme')}</label>
        <div className="flex space-x-4">
          {[
            { value: 'light', label: t('settings.lightTheme'), icon: Sun },
            { value: 'dark', label: t('settings.darkTheme'), icon: Moon },
            { value: 'auto', label: t('settings.autoTheme'), icon: Monitor }
          ].map(({ value, label, icon: Icon }) => (
            <label key={value} className="flex items-center space-x-2 cursor-pointer">
              <input
                type="radio"
                name="theme"
                value={value}
                checked={preferences.theme === value}
                onChange={(e) => updatePreference('theme', e.target.value)}
                className="text-blue-600 focus:ring-blue-500"
              />
              <Icon className="h-4 w-4" />
              <span className="text-sm">{label}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );

  const renderNotificationSettings = () => (
    <div className="space-y-6">
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-gray-900">{t('settings.notificationTypes')}</h4>
        
        {[
          { key: 'email', label: t('settings.emailNotifications'), icon: Mail },
          { key: 'push', label: t('settings.pushNotifications'), icon: Smartphone },
          { key: 'renewalReminders', label: t('settings.renewalReminders'), icon: Calendar },
          { key: 'saleOpportunities', label: t('settings.saleOpportunities'), icon: DollarSign },
          { key: 'priceAlerts', label: t('settings.priceAlerts'), icon: Bell },
          { key: 'weeklyReports', label: t('settings.weeklyReports'), icon: Clock }
        ].map(({ key, label, icon: Icon }) => (
          <div key={key} className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Icon className="h-5 w-5 text-gray-400" />
              <span className="text-sm font-medium text-gray-900">{label}</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={preferences.notifications[key as keyof typeof preferences.notifications]}
                onChange={(e) => updatePreference(`notifications.${key}`, e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
        ))}
      </div>
    </div>
  );

  const renderPrivacySettings = () => (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">{t('settings.profileVisibility')}</label>
        <select
          value={preferences.privacy.profileVisibility}
          onChange={(e) => updatePreference('privacy.profileVisibility', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="public">{t('settings.public')}</option>
          <option value="friends">{t('settings.friendsOnly')}</option>
          <option value="private">{t('settings.private')}</option>
        </select>
      </div>

      <div className="space-y-4">
        {[
          { key: 'showStats', label: t('settings.showStats'), description: t('settings.showStatsDesc') },
          { key: 'showPortfolio', label: t('settings.showPortfolio'), description: t('settings.showPortfolioDesc') },
          { key: 'allowAnalytics', label: t('settings.allowAnalytics'), description: t('settings.allowAnalyticsDesc') }
        ].map(({ key, label, description }) => (
          <div key={key} className="flex items-start justify-between">
            <div className="flex-1">
              <span className="text-sm font-medium text-gray-900">{label}</span>
              <p className="text-xs text-gray-500 mt-1">{description}</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={typeof preferences.privacy[key as keyof typeof preferences.privacy] === 'boolean' ? preferences.privacy[key as keyof typeof preferences.privacy] as boolean : false}
                onChange={(e) => updatePreference(`privacy.${key}`, e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
        ))}
      </div>
    </div>
  );

  const renderInvestmentSettings = () => (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">{t('settings.defaultCurrency')}</label>
        <select
          value={preferences.investment.defaultCurrency}
          onChange={(e) => updatePreference('investment.defaultCurrency', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="USD">USD ($)</option>
          <option value="EUR">EUR (€)</option>
          <option value="CNY">CNY (¥)</option>
          <option value="GBP">GBP (£)</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">{t('settings.riskTolerance')}</label>
        <div className="space-y-2">
          {[
            { value: 'low', label: t('settings.conservative'), description: t('settings.conservativeDesc') },
            { value: 'medium', label: t('settings.balanced'), description: t('settings.balancedDesc') },
            { value: 'high', label: t('settings.aggressive'), description: t('settings.aggressiveDesc') }
          ].map(({ value, label, description }) => (
            <label key={value} className="flex items-center space-x-3 cursor-pointer">
              <input
                type="radio"
                name="riskTolerance"
                value={value}
                checked={preferences.investment.riskTolerance === value}
                onChange={(e) => updatePreference('investment.riskTolerance', e.target.value)}
                className="text-blue-600 focus:ring-blue-500"
              />
              <div>
                <span className="text-sm font-medium text-gray-900">{label}</span>
                <p className="text-xs text-gray-500">{description}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">{t('settings.priceAlertThreshold')} (%)</label>
        <input
          type="number"
          min="1"
          max="100"
          value={preferences.investment.priceAlertThreshold}
          onChange={(e) => updatePreference('investment.priceAlertThreshold', parseInt(e.target.value))}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p className="text-xs text-gray-500 mt-1">{t('settings.priceAlertThresholdDesc')}</p>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <span className="text-sm font-medium text-gray-900">{t('settings.autoRenewal')}</span>
          <p className="text-xs text-gray-500">{t('settings.autoRenewalDesc')}</p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={preferences.investment.autoRenewal}
            onChange={(e) => updatePreference('investment.autoRenewal', e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
        </label>
      </div>
    </div>
  );

  const renderDisplaySettings = () => (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">{t('settings.defaultView')}</label>
        <div className="flex space-x-4">
          {[
            { value: 'grid', label: t('settings.gridView'), icon: Grid },
            { value: 'list', label: t('settings.listView'), icon: List }
          ].map(({ value, label, icon: Icon }) => (
            <label key={value} className="flex items-center space-x-2 cursor-pointer">
              <input
                type="radio"
                name="defaultView"
                value={value}
                checked={preferences.display.defaultView === value}
                onChange={(e) => updatePreference('display.defaultView', e.target.value)}
                className="text-blue-600 focus:ring-blue-500"
              />
              <Icon className="h-4 w-4" />
              <span className="text-sm">{label}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">{t('settings.itemsPerPage')}</label>
        <select
          value={preferences.display.itemsPerPage}
          onChange={(e) => updatePreference('display.itemsPerPage', parseInt(e.target.value))}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value={10}>10</option>
          <option value={20}>20</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
        </select>
      </div>

      <div className="space-y-4">
        {[
          { key: 'showAdvancedStats', label: t('settings.showAdvancedStats'), description: t('settings.showAdvancedStatsDesc') },
          { key: 'compactMode', label: t('settings.compactMode'), description: t('settings.compactModeDesc') }
        ].map(({ key, label, description }) => (
          <div key={key} className="flex items-start justify-between">
            <div className="flex-1">
              <span className="text-sm font-medium text-gray-900">{label}</span>
              <p className="text-xs text-gray-500 mt-1">{description}</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={typeof preferences.display[key as keyof typeof preferences.display] === 'boolean' ? preferences.display[key as keyof typeof preferences.display] as boolean : false}
                onChange={(e) => updatePreference(`display.${key}`, e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
        ))}
      </div>
    </div>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'general':
        return renderGeneralSettings();
      case 'notifications':
        return renderNotificationSettings();
      case 'privacy':
        return renderPrivacySettings();
      case 'investment':
        return renderInvestmentSettings();
      case 'display':
        return renderDisplaySettings();
      default:
        return renderGeneralSettings();
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">{t('dashboard.userSettings')}</h3>
          <div className="flex items-center space-x-2">
            <button
              onClick={resetPreferences}
              className="text-gray-600 hover:text-gray-800 flex items-center space-x-1"
            >
              <RotateCcw className="h-4 w-4" />
              <span className="text-sm">{t('dashboard.reset')}</span>
            </button>
            <button
              onClick={savePreferences}
              disabled={saving}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center space-x-2 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              <span>{saving ? t('dashboard.saving') : t('dashboard.saveSettings')}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="flex">
        {/* 侧边栏 */}
        <div className="w-64 border-r border-gray-200">
          <nav className="p-4 space-y-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors ${
                    activeTab === tab.id
                      ? 'bg-blue-50 text-blue-700 border border-blue-200'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-sm font-medium">{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* 内容区域 */}
        <div className="flex-1 p-6">
          {renderTabContent()}
        </div>
      </div>
    </div>
  );
}
