'use client';

import React, { useState, useEffect } from 'react';
import { Save, RotateCcw, Sun, Moon, Monitor } from 'lucide-react';
import { useI18nContext } from '../../contexts/I18nProvider';

interface UserPreferences {
  language: 'zh' | 'en';
  theme: 'light' | 'dark' | 'auto';
}

const defaultPreferences: UserPreferences = {
  language: 'zh',
  theme: 'auto'
};

export default function UserPreferencesPanel() {
  const [preferences, setPreferences] = useState<UserPreferences>(defaultPreferences);
  const [saving, setSaving] = useState(false);
  const { t, locale, setLocale } = useI18nContext();

  useEffect(() => {
    loadPreferences();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const root = typeof document !== 'undefined' ? document.documentElement : null;
    if (!root) return;
    const theme = preferences.theme === 'auto'
      ? (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : preferences.theme;
    root.setAttribute('data-theme', theme);
  }, [preferences.theme]);

  const loadPreferences = () => {
    try {
      const saved = localStorage.getItem('domain_financial_preferences');
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<UserPreferences>;
        setPreferences({
          language: parsed.language && (parsed.language === 'zh' || parsed.language === 'en') ? parsed.language : locale,
          theme: parsed.theme && ['light', 'dark', 'auto'].includes(parsed.theme) ? parsed.theme : 'auto'
        });
      } else {
        setPreferences({ language: locale, theme: 'auto' });
      }
    } catch (error) {
      console.error('Error loading preferences:', error);
      setPreferences({ language: locale, theme: 'auto' });
    }
  };

  const savePreferences = async () => {
    setSaving(true);
    try {
      localStorage.setItem('domain_financial_preferences', JSON.stringify(preferences));
      setLocale(preferences.language);
      await new Promise(resolve => setTimeout(resolve, 300));
    } catch (error) {
      console.error('Error saving preferences:', error);
    } finally {
      setSaving(false);
    }
  };

  const resetPreferences = () => {
    setPreferences(defaultPreferences);
  };

  return (
    <div className="bg-white rounded-xl border border-stone-200/80 shadow-sm">
      <div className="p-6 border-b border-stone-200/80">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-stone-900">{t('dashboard.userSettings')}</h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={resetPreferences}
              className="text-stone-500 hover:text-stone-800 flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-stone-100 text-sm font-medium transition"
            >
              <RotateCcw className="h-4 w-4" />
              <span>{t('dashboard.reset')}</span>
            </button>
            <button
              type="button"
              onClick={savePreferences}
              disabled={saving}
              className="bg-teal-600 text-white px-4 py-2 rounded-xl hover:bg-teal-700 flex items-center gap-2 disabled:opacity-50 text-sm font-medium transition"
            >
              <Save className="h-4 w-4" />
              <span>{saving ? t('dashboard.saving') : t('dashboard.saveSettings')}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6 max-w-md">
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-2">{t('settings.language')}</label>
          <select
            value={preferences.language}
            onChange={(e) => setPreferences(prev => ({ ...prev, language: e.target.value as 'zh' | 'en' }))}
            className="w-full px-3 py-2 border border-stone-200 rounded-xl bg-white text-stone-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
          >
            <option value="zh">{t('settings.chinese')}</option>
            <option value="en">{t('settings.english')}</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-stone-700 mb-2">{t('settings.theme')}</label>
          <div className="flex gap-4 flex-wrap">
            {[
              { value: 'light' as const, label: t('settings.lightTheme'), icon: Sun },
              { value: 'dark' as const, label: t('settings.darkTheme'), icon: Moon },
              { value: 'auto' as const, label: t('settings.autoTheme'), icon: Monitor }
            ].map(({ value, label, icon: Icon }) => (
              <label key={value} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="theme"
                  value={value}
                  checked={preferences.theme === value}
                  onChange={() => setPreferences(prev => ({ ...prev, theme: value }))}
                  className="text-teal-600 focus:ring-teal-500"
                />
                <Icon className="h-4 w-4 text-stone-500" />
                <span className="text-sm text-stone-800">{label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
