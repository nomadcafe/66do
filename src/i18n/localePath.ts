import type { HomeLocale } from './homeDictionary';

export function isHomeLocale(s: string): s is HomeLocale {
  return s === 'zh' || s === 'en';
}
