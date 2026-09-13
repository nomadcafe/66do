/** 年度展望的行 = 切换年份的控件（年份下拉在两屏之外的页首卡里） */
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { I18nProvider } from '../../contexts/I18nProvider';
import AdvancedRenewalAnalysis from './AdvancedRenewalAnalysis';
import type { DomainWithTags, TransactionWithRequiredFields } from '../../types/dashboard';

const thisYear = new Date().getFullYear();

// 到期日铺在今年和之后两年，保证展望列表里有多个非空年份
const domains = [0, 1, 2].map((i) => ({
  id: `d${i}`,
  domain_name: `site${i}.com`,
  registrar: 'Namecheap',
  purchase_date: '2024-01-10',
  purchase_cost: 100,
  renewal_cost: 12,
  renewal_cycle: 1,
  renewal_count: 0,
  expiry_date: `${thisYear + i}-06-15`,
  status: 'active',
  estimated_value: 0,
  tags: [],
})) as unknown as DomainWithTags[];

const renderPanel = () =>
  render(
    <I18nProvider>
      <AdvancedRenewalAnalysis domains={domains} transactions={[] as TransactionWithRequiredFields[]} />
    </I18nProvider>
  );

const yearRow = (year: number) =>
  screen.getAllByRole('button').find((b) => (b.textContent ?? '').startsWith(String(year)));

describe('AdvancedRenewalAnalysis — 年度展望', () => {
  it('每一年都是一个可按的控件，并标出当前选中项', () => {
    renderPanel();
    const current = yearRow(thisYear);
    expect(current).toBeTruthy();
    expect(current!.getAttribute('aria-pressed')).toBe('true');
    const next = yearRow(thisYear + 1);
    expect(next).toBeTruthy();
    expect(next!.getAttribute('aria-pressed')).toBe('false');
  });

  it('点某一年就切过去，不用滚回页首的下拉', () => {
    renderPanel();
    const target = thisYear + 1;
    fireEvent.click(yearRow(target)!);
    expect(yearRow(target)!.getAttribute('aria-pressed')).toBe('true');
    expect(yearRow(thisYear)!.getAttribute('aria-pressed')).toBe('false');
    // 页首下拉跟着走，两个入口共用同一份状态
    expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe(String(target));
  });
});
