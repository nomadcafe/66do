'use client';

import { useState, useEffect, useCallback, useTransition } from 'react';
import { LOCALE_COOKIE } from '../i18n/homeDictionary';
import zh from '../i18n/translations/zh';
import en from '../i18n/translations/en';

type Locale = 'zh' | 'en';

interface Translations {
  [key: string]: string | Translations;
}

// 翻译数据：按语言拆分到 src/i18n/translations/{zh,en}.ts，本文件只负责挑语言。
const translations: Record<Locale, Translations> = {
  zh: zh as Translations,
  en: en as Translations,
};

function setLocaleCookieClient(locale: Locale) {
  if (typeof document === 'undefined') return;
  document.cookie = `${LOCALE_COOKIE}=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

// 获取嵌套对象的值
function getNestedValue(obj: Record<string, unknown>, path: string): string {
  const keys = path.split('.');
  let current: unknown = obj;

  for (const key of keys) {
    if (current && typeof current === 'object' && current !== null && key in current) {
      current = (current as Record<string, unknown>)[key];
    } else {
      return path; // 如果路径不存在，返回原始键
    }
  }

  return typeof current === 'string' ? current : path;
}

export function useI18n() {
  const [locale, setLocale] = useState<Locale>('zh');
  const [isLoading, setIsLoading] = useState(true);
  // 切换语言时全树重渲染（DomainList 100+ 卡片 / FAO / IA 黄线 / 表格...）
  // 用 useTransition 把 setState 标为可中断的低优先级更新——按钮 highlight
  // 立即响应，重型 t() 消费者的重渲染推到后台不阻塞 UI。
  const [, startTransition] = useTransition();

  useEffect(() => {
    const savedLocale = localStorage.getItem('domain_financial_locale') as Locale | null;
    if (savedLocale === 'zh' || savedLocale === 'en') {
      setLocale(savedLocale);
      setLocaleCookieClient(savedLocale);
    } else {
      // 检测浏览器语言
      const browserLang = navigator.language || navigator.languages?.[0] || 'en';
      const detectedLocale = browserLang.startsWith('zh') ? 'zh' : 'en';
      setLocale(detectedLocale);
      setLocaleCookieClient(detectedLocale);
    }
    setIsLoading(false);
  }, []);

  // changeLocale 引用稳定（依赖空数组）。Side-effects（cookie / localStorage）
  // 同步触发，state 更新走 transition——不阻塞主线程的高优先级 UI。
  const changeLocale = useCallback((newLocale: Locale) => {
    localStorage.setItem('domain_financial_locale', newLocale);
    setLocaleCookieClient(newLocale);
    startTransition(() => {
      setLocale(newLocale);
    });
  }, []);

  // t 引用只在 locale / isLoading 变化时变。下游 useMemo 依赖 t 时不会因
  // I18nProvider 上层无关重渲染而误失效。
  const t = useCallback(
    (key: string): string => {
      if (isLoading) return key;
      return getNestedValue(translations[locale], key);
    },
    [locale, isLoading]
  );

  return {
    locale,
    setLocale: changeLocale,
    t,
    isLoading,
  };
}
