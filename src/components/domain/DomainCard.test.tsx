/** 域名卡片（手机上被强制使用的视图）必须能看到到期信息 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nProvider } from '../../contexts/I18nProvider';
import DomainCard from './DomainCard';
import type { DomainWithTags } from '../../types/dashboard';

const base = {
  id: 'd1',
  domain_name: 'example.com',
  registrar: 'Namecheap',
  purchase_date: '2025-01-10',
  purchase_cost: 100,
  renewal_cost: 12,
  renewal_cycle: 1,
  renewal_count: 0,
  status: 'active',
  estimated_value: 0,
  tags: [],
} as unknown as DomainWithTags;

const renderCard = (over: Partial<DomainWithTags> = {}) =>
  render(
    <I18nProvider>
      <DomainCard
        domain={{ ...base, ...over } as DomainWithTags}
        transactions={[]}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onView={vi.fn()}
      />
    </I18nProvider>
  );

/** 今天之后 n 天的 YYYY-MM-DD（本地） */
const inDays = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

describe('DomainCard 到期信息', () => {
  it('显示到期日和剩余天数（以前卡片上完全没有这条）', () => {
    renderCard({ expiry_date: inDays(45) } as Partial<DomainWithTags>);
    expect(screen.getByText('Expires')).toBeTruthy();
    expect(screen.getByText('in 45d')).toBeTruthy();
  });

  it('已过期时说「已过期」，不是负数天', () => {
    renderCard({ expiry_date: inDays(-10) } as Partial<DomainWithTags>);
    expect(screen.getByText('Expired')).toBeTruthy();
    expect(screen.queryByText(/-10/)).toBeNull();
  });

  it('已出售的域名不显示到期信息', () => {
    renderCard({ expiry_date: inDays(45), status: 'sold' } as Partial<DomainWithTags>);
    expect(screen.queryByText('Expires')).toBeNull();
  });

  it('没填到期日时不显示这一行', () => {
    renderCard();
    expect(screen.queryByText('Expires')).toBeNull();
  });
});
