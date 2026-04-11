import type { HomeLocale } from './homeDictionary';

export const LOCALE_SEGMENTS: readonly HomeLocale[] = ['zh', 'en'];

export function isHomeLocale(s: string): s is HomeLocale {
  return s === 'zh' || s === 'en';
}
