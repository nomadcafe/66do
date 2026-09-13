/**
 * Insights → Portfolio 子 tab 的分布板块。
 *
 * 后缀分布原来是一张按 index % palette.length 循环取色的饼：后缀超过 8 种时
 * 第 9 种跟第 1 种同色，而下面的明细只列前 5 条——第 6 名往后在饼上既没标签
 * 也没图例，完全认不出是谁。
 */
import React from 'react';
import { describe, it, expect, beforeAll } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { I18nProvider } from '../../contexts/I18nProvider';
import InvestmentAnalytics from './InvestmentAnalytics';
import type { DomainWithTags, TransactionWithRequiredFields } from '../../types/dashboard';

beforeAll(() => {
  class RO { observe() {} unobserve() {} disconnect() {} }
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = RO;
  HTMLElement.prototype.getBoundingClientRect = function () {
    return { width: 800, height: 300, top: 0, left: 0, bottom: 300, right: 800, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
  };
});

const TLDS = ['com', 'net', 'org', 'io', 'co', 'ai', 'xyz', 'app', 'dev', 'me'];

const domains = TLDS.map((tld, i) => ({
  id: `d${i}`, domain_name: `site${i}.${tld}`, registrar: 'NC',
  purchase_date: '2025-01-10', purchase_cost: 100, renewal_cost: 10,
  renewal_cycle: 1, renewal_count: 0, expiry_date: '2027-01-10',
  status: 'active', estimated_value: 0, tags: [],
})) as unknown as DomainWithTags[];

function renderDistribution(doms = domains, txs: TransactionWithRequiredFields[] = []) {
  return render(
    <I18nProvider>
      <InvestmentAnalytics domains={doms} transactions={txs} section="distribution" />
    </I18nProvider>
  );
}

describe('持仓分布板块', () => {
  it('后缀分布把每一条都写出名字，不再有「第 6 名之后无名无姓」', () => {
    renderDistribution();
    // 10 种后缀全部带文字标签（以前只有前 5 条在明细里露名）
    for (const tld of TLDS) {
      expect(screen.getAllByText(`.${tld}`).length).toBeGreaterThan(0);
    }
  });

  it('后缀分布不再用饼图渲染（循环取色 + 无标签的那张）', () => {
    const { container } = renderDistribution();
    const suffixCard = screen.getByText('Held Domain Suffix Distribution').closest('div')!
      .parentElement!;
    expect(within(suffixCard).queryByText(/recharts-pie/)).toBeNull();
    // 整个板块里只该剩「资金分布」那一张饼
    expect(container.querySelectorAll('.recharts-pie').length).toBeLessThanOrEqual(1);
  });

  it('资金分布用的是通过 all-pairs 校验的那组颜色', () => {
    const withSold = domains.map((d, i) =>
      i === 0 ? ({ ...d, status: 'sold' } as DomainWithTags) : d
    );
    const { container } = renderDistribution(withSold);
    const fills = Array.from(container.querySelectorAll('.recharts-pie-sector path')).map((p) =>
      p.getAttribute('fill')
    );
    // 旧配色里 active(#0d9488) 和 expired(#fb7185) 在 protan 下 ΔE 0.7
    expect(fills).not.toContain('#0d9488');
    expect(fills).not.toContain('#fb7185');
  });
});
