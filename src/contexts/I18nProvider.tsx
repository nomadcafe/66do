'use client';

import { createContext, useContext, useMemo, ReactNode } from 'react';
import { useI18n } from '../hooks/useI18n';

interface I18nContextType {
  locale: 'zh' | 'en';
  setLocale: (locale: 'zh' | 'en') => void;
  t: (key: string) => string;
  isLoading: boolean;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export function I18nProvider({ children }: { children: ReactNode }) {
  const { locale, setLocale, t, isLoading } = useI18n();

  // 包 useMemo 是关键：context value 不 memo 时，I18nProvider 任何无关重渲染
  // 都会让 React.useContext 看到"新对象"，把 re-render 瀑布扩散到所有 t()
  // 消费者（DomainList / FAO / IA / 黄线图...）。useI18n 内部 setLocale + t
  // 已经走 useCallback 引用稳定，这里只要 locale / isLoading 不变，value
  // 就稳定，consumer 不再被无关 render 牵连。
  const value = useMemo(
    () => ({ locale, setLocale, t, isLoading }),
    [locale, setLocale, t, isLoading]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18nContext() {
  const context = useContext(I18nContext);
  if (context === undefined) {
    throw new Error('useI18nContext must be used within an I18nProvider');
  }
  return context;
}
