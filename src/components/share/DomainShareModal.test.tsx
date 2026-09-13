/**
 * 域名分享卡片的数字必须和仪表盘一致。
 *
 * 这张图是要发出去给别人看的：分期只收到一部分时按合同全额算利润，等于
 * 对外宣称一笔还没到账的收益。
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { I18nProvider } from '../../contexts/I18nProvider';
import DomainShareModal from './DomainShareModal';
import type { DomainWithTags, TransactionWithRequiredFields } from '../../types/dashboard';

const shareToX = vi.fn();
// shareToX / investedTweetText 在 shareText，不在 shareImage
vi.mock('../../lib/shareText', async (orig) => ({
  ...(await orig<typeof import('../../lib/shareText')>()),
  shareToX: (text: string) => shareToX(text),
}));
vi.mock('../../lib/shareImage', async (orig) => ({
  ...(await orig<typeof import('../../lib/shareImage')>()),
  drawDomainSaleImage: vi.fn(),
  downloadCanvas: vi.fn(),
}));

beforeEach(() => shareToX.mockClear());

const domain = {
  id: 'd1',
  domain_name: 'example.com',
  registrar: 'NC',
  purchase_date: '2025-01-10',
  purchase_cost: 1000,
  renewal_cost: 0,
  renewal_cycle: 1,
  renewal_count: 0,
  expiry_date: '2027-01-10',
  status: 'sold',
  estimated_value: 0,
  tags: [],
} as unknown as DomainWithTags;

/** 标价 $50,000 的分期出售，账面上就是这个数 */
const raw = [
  {
    id: 't1', domain_id: 'd1', type: 'sell', amount: 50000, net_amount: 50000,
    platform_fee: 0, currency: 'USD', date: '2026-03-01', payment_plan: 'installment',
  },
] as unknown as TransactionWithRequiredFields[];

/** transactionsForMetrics 折算后的同一笔：实际只收到 $10,000 */
const adjusted = [{ ...raw[0], amount: 10000, net_amount: 10000 }] as unknown as TransactionWithRequiredFields[];

function renderModal(props: Partial<React.ComponentProps<typeof DomainShareModal>> = {}) {
  render(
    <I18nProvider>
      <DomainShareModal
        isOpen
        onClose={vi.fn()}
        domain={domain}
        transactions={raw}
        {...props}
      />
    </I18nProvider>
  );
  const xBtn = screen
    .getAllByRole('button')
    .find((b) => (b.textContent ?? '').trim().endsWith('X'))!;
  fireEvent.click(xBtn);
  return shareToX.mock.calls[0][0] as string;
}

/** 推文里的第一个金额 */
const amountIn = (text: string) => Number(text.match(/\$([\d,]+)/)![1].replace(/,/g, ''));

describe('DomainShareModal', () => {
  it('传了折算后的交易时，利润按实际已收算', () => {
    const text = renderModal({ metricsTransactions: adjusted });
    // 实收 $10,000 − 成本 $1,000 = $9,000
    expect(amountIn(text)).toBe(9000);
  });

  it('没传折算数据时退回原始金额（旧行为，不算 regression）', () => {
    const text = renderModal();
    expect(amountIn(text)).toBe(49000);
  });

  it('折算后的数字必须比合同全额小——否则等于对外多报', () => {
    const withMetrics = amountIn(renderModal({ metricsTransactions: adjusted }));
    // 同一个用例里渲染两次，不清掉的话第二次 getAllByRole 会先拿到第一个弹窗的按钮
    cleanup();
    shareToX.mockClear();
    const withoutMetrics = amountIn(renderModal());
    expect(withMetrics).toBeLessThan(withoutMetrics);
  });
});
