/**
 * 每一个 t('…') 字面量键都必须在 en 和 zh 里解析得到。
 *
 * useI18n.getNestedValue 在路径不存在时 `return path` —— 直接把键名当文案渲染
 * 出去。于是 Add New Transaction 面板上两个字段的标题就是字面量的
 * "transaction.domain" 和 "transaction.platform"：不报错、不显眼、静静地错着。
 *
 * 这类问题靠人眼是看不全的（要把每个语言 × 每个面板都点一遍），所以钉成测试。
 * 只扫字面量键；动态拼接的（t(`a.${x}`)）扫不到，那类另有各自的守卫。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import en from './translations/en';
import zh from './translations/zh';

const resolve = (dict: unknown, path: string): unknown =>
  path.split('.').reduce<unknown>((acc, k) => (acc as Record<string, unknown>)?.[k], dict);

function sourceFiles(): string[] {
  return execSync(
    "grep -rl \"t('\" src app --include=*.tsx --include=*.ts | grep -v translations | grep -v '.test.'",
    { encoding: 'utf8' }
  )
    .trim()
    .split('\n')
    .filter(Boolean);
}

/** 代码里出现过的全部字面量 t() 键，带出处。 */
function usedKeys(): Array<{ key: string; at: string }> {
  const out: Array<{ key: string; at: string }> = [];
  for (const file of sourceFiles()) {
    readFileSync(file, 'utf8')
      .split('\n')
      .forEach((line, i) => {
        for (const m of line.matchAll(/\bt\(\s*'([A-Za-z0-9_.]+)'/g)) {
          if (m[1].includes('.')) out.push({ key: m[1], at: `${file}:${i + 1}` });
        }
      });
  }
  return out;
}

describe('i18n 键完整性', () => {
  it('扫得到键（grep 本身别失效了）', () => {
    // 没有这条，上面 grep 要是哪天扫不到文件，下面两个 case 会静默通过
    expect(usedKeys().length).toBeGreaterThan(200);
  });

  it('en 里没有缺失的键', () => {
    const missing = usedKeys().filter(({ key }) => typeof resolve(en, key) !== 'string');
    expect(missing.map((m) => `${m.key}  @ ${m.at}`)).toEqual([]);
  });

  it('zh 里没有缺失的键', () => {
    const missing = usedKeys().filter(({ key }) => typeof resolve(zh, key) !== 'string');
    expect(missing.map((m) => `${m.key}  @ ${m.at}`)).toEqual([]);
  });

  it('两份词典的键集合一致', () => {
    const flatten = (o: unknown, p = ''): string[] => {
      if (typeof o === 'string') return [p];
      if (!o || typeof o !== 'object') return [];
      return Object.entries(o as Record<string, unknown>).flatMap(([k, v]) =>
        flatten(v, p ? `${p}.${k}` : k)
      );
    };
    const enKeys = new Set(flatten(en));
    const zhKeys = new Set(flatten(zh));
    const onlyEn = [...enKeys].filter((k) => !zhKeys.has(k));
    const onlyZh = [...zhKeys].filter((k) => !enKeys.has(k));
    expect({ onlyEn, onlyZh }).toEqual({ onlyEn: [], onlyZh: [] });
  });
});
