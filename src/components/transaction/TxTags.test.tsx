/**
 * 交易行上的 category / platform 标签 + 凭证链接。
 *
 * 这三个字段以前全是只写的：表单收、落库，界面一个字都不还给用户。
 * receipt_url 尤其可惜——validation.ts 给它写了完整 URL 校验（含协议白名单），
 * 注释写着 "only safe to render as an <a href>"，防护是冲着渲染链接做的，
 * 链接却一直没做。
 */
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import TxTags from './TxTags';
import type { TransactionWithRequiredFields } from '../../types/transaction';

// 组件只用 t 取几个固定标签，不需要整个 I18nProvider
const t = (k: string) =>
  ({
    'transaction.category': 'Category',
    'transactionList.platform': 'Platform',
    'transactionList.viewReceipt': 'Receipt',
    'transactionList.viewReceiptAria': 'Open receipt for {domain} (new tab)',
  })[k] ?? k;

const tx = (over: Partial<TransactionWithRequiredFields>) =>
  ({
    id: 't1', domain_id: 'd1', type: 'buy', amount: 100,
    currency: 'USD', date: '2026-01-01', ...over,
  }) as unknown as TransactionWithRequiredFields;

function show(over: Partial<TransactionWithRequiredFields>, typeLabel = 'Buy') {
  return render(
    <TxTags transaction={tx(over)} typeLabel={typeLabel} domainName="example.com" t={t} />
  );
}

describe('标签显示', () => {
  it('category 和 platform 都渲染出来', () => {
    show({ category: 'Investment', platform: 'Sedo' });
    expect(screen.getByText('Investment')).toBeTruthy();
    expect(screen.getByText('Sedo')).toBeTruthy();
  });

  it('三个字段都空时整块不渲染', () => {
    const { container } = show({});
    expect(container.innerHTML).toBe('');
  });

  it('只有空白的值等同于没填', () => {
    const { container } = show({ category: '  ', platform: '', receipt_url: '   ' });
    expect(container.innerHTML).toBe('');
  });
});

describe('category 与 type 重复时不显示', () => {
  // useDomainOperations 以前给自动生成的续费 / 转移交易写死 category:
  // 'renewal' / 'transfer'，而它们的 type 本来就是 renew / transfer。
  // 新写入已经不再自动填，历史行靠这里挡。
  it("type=renew 且 category='renewal' → 不显示", () => {
    const { container } = show({ type: 'renew', category: 'renewal' }, 'Renew');
    expect(container.innerHTML).toBe('');
  });

  it("type=transfer 且 category='transfer' → 不显示", () => {
    const { container } = show({ type: 'transfer', category: 'transfer' }, 'Transfer');
    expect(container.innerHTML).toBe('');
  });

  it('跟本地化后的 type 标签重复也挡掉（大小写无关）', () => {
    const { container } = show({ type: 'buy', category: 'buy' }, 'Buy');
    expect(container.innerHTML).toBe('');
  });

  it('用户自己打的分类照常显示，即使那笔是续费', () => {
    show({ type: 'renew', category: 'Portfolio A' }, 'Renew');
    expect(screen.getByText('Portfolio A')).toBeTruthy();
  });
});

describe('凭证链接', () => {
  it('https 链接渲染成新标签页打开的 <a>，带 noopener noreferrer', () => {
    show({ receipt_url: 'https://example.com/receipt.pdf' });
    const a = screen.getByRole('link') as HTMLAnchorElement;
    expect(a.getAttribute('href')).toBe('https://example.com/receipt.pdf');
    expect(a.getAttribute('target')).toBe('_blank');
    // noopener：被链接页能通过 window.opener 改写本页地址
    // noreferrer：别把本站 URL 漏给第三方收据托管方
    expect(a.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('http 也接受', () => {
    show({ receipt_url: 'http://example.com/r.pdf' });
    expect(screen.getByRole('link')).toBeTruthy();
  });

  it.each([
    'javascript:alert(1)',
    'JavaScript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox(1)',
    'file:///etc/passwd',
    '不是个 URL',
  ])('危险 / 非法协议不渲染成链接：%s', (bad) => {
    // 写入时 validation.ts 已经挡了一道，但历史数据、导入的备份、直接改库
    // 都能绕过去，渲染前必须自己再判一次
    show({ receipt_url: bad });
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('协议不合法时不影响同一行其它标签', () => {
    show({ category: 'Investment', receipt_url: 'javascript:alert(1)' });
    expect(screen.getByText('Investment')).toBeTruthy();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('无障碍标签带上域名', () => {
    show({ receipt_url: 'https://example.com/r.pdf' });
    expect(screen.getByLabelText('Open receipt for example.com (new tab)')).toBeTruthy();
  });
});
