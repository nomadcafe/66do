/**
 * Add New Transaction 里 Platform / Category 两个自由文本字段。
 *
 * 1. 标题以前是字面量的 "transaction.platform" / "transaction.domain" ——
 *    这两个键在 en / zh 里都不存在，useI18n 找不到路径时直接把键名当文案返回。
 *    （全量守卫见 src/i18n/missingKeys.test.ts，这里只钉这两个具体字段。）
 *
 * 2. 候选下拉以前用 `new Set<string>()` 去重，而 Set 区分大小写：种子里有
 *    'Sedo'，用户打了 'sedo'，下拉里就同时挂着两条，再来个 'SEDO' 就是三条。
 *    这个列表存在的意义就是让用户复用同一个名字，自己先分了叉就没意义了。
 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nProvider } from '../../contexts/I18nProvider';
import TransactionForm from './TransactionForm';
import type { DomainWithTags, TransactionWithRequiredFields } from '../../types/dashboard';

const domain = {
  id: 'd1', domain_name: 'example.com', status: 'active',
  purchase_date: '2024-01-01', purchase_cost: 10, renewal_cost: 10,
  renewal_cycle: 1, currency: 'USD', tags: [],
} as unknown as DomainWithTags;

function setup(existingTransactions: TransactionWithRequiredFields[] = []) {
  return render(
    <I18nProvider>
      <TransactionForm
        domains={[domain]}
        isOpen
        onClose={vi.fn()}
        onSave={vi.fn()}
        existingTransactions={existingTransactions}
      />
    </I18nProvider>
  );
}

const datalistValues = (id: string) =>
  Array.from(document.getElementById(id)?.querySelectorAll('option') ?? []).map(
    (o) => (o as HTMLOptionElement).value
  );

const tx = (over: Partial<TransactionWithRequiredFields>) =>
  ({
    id: `t${Math.random()}`, domain_id: 'd1', type: 'sell', amount: 100,
    currency: 'USD', date: '2026-01-01', ...over,
  }) as unknown as TransactionWithRequiredFields;

describe('字段标题不是原始 i18n 键', () => {
  it('Platform / Domain 渲染的是文案，不是 "transaction.platform"', () => {
    setup();
    expect(screen.queryByText('transaction.platform')).toBeNull();
    expect(screen.queryByText(/transaction\.domain/)).toBeNull();
    // 页面上不该有任何看起来像未解析 i18n 键的文本
    expect(document.body.textContent).not.toMatch(/\btransaction\.[a-zA-Z]+\b/);
  });
});

describe('Platform 候选下拉', () => {
  it('没有历史交易时只有种子，且互不重复', () => {
    setup();
    const values = datalistValues('transaction-form-platform-list');
    expect(values).toContain('Sedo');
    expect(new Set(values).size).toBe(values.length);
  });

  it('用户打的 sedo / SEDO 不会和种子 Sedo 并列成三条', () => {
    setup([
      tx({ platform: 'sedo' }),
      tx({ platform: 'SEDO' }),
      tx({ platform: 'Sedo' }),
    ]);
    const values = datalistValues('transaction-form-platform-list');
    const sedoish = values.filter((v) => v.toLowerCase() === 'sedo');
    // 种子先进，所以留下的是规范写法
    expect(sedoish).toEqual(['Sedo']);
  });

  it('前后空格不产生新条目', () => {
    setup([tx({ platform: '  Afternic  ' })]);
    const values = datalistValues('transaction-form-platform-list');
    expect(values.filter((v) => v.toLowerCase().trim() === 'afternic')).toEqual(['Afternic']);
  });

  it('用户自己造的平台名保留他自己的大小写', () => {
    setup([tx({ platform: 'myBroker.io' })]);
    expect(datalistValues('transaction-form-platform-list')).toContain('myBroker.io');
  });
});

describe('Category 候选下拉', () => {
  it('同样忽略大小写去重，首次出现的写法胜出', () => {
    setup([
      tx({ category: 'Investment' }),
      tx({ category: 'investment' }),
      tx({ category: 'Marketing' }),
    ]);
    const values = datalistValues('transaction-form-category-list');
    expect(values.filter((v) => v.toLowerCase() === 'investment')).toHaveLength(1);
    expect(values).toContain('Marketing');
  });
});
