/**
 * 分享卡片上的数字口径。这张图是要发出去的，所以它跟用户自己仪表盘上看到的
 * 必须是同一个口径。
 *
 * 两个问题：
 *
 * 1. ROI 走的是 calculateBasicFinancialMetrics.roi，分母含**没卖出的库存成本**。
 *    useDomainStats 早就因为这个把它换成 realizedROI 了（注释原文："could be
 *    deeply negative while Realized P&L is positive"），仪表盘改了、这张图没跟上：
 *    同一批数据分享卡片 190.3%、仪表盘 1400.0%，标签都只写着 ROI。
 *
 * 2. 时间范围靠裁数据实现——filterByRange 按 purchase_date / tx.date 把 domains
 *    和 transactions 都截一刀再喂给计算。2023 年买、2026 年卖的域名在"近 2 年"
 *    档里，域名本身被滤掉了、它的 sell 交易却留着：成本凭空消失、利润凭空变大。
 *    InvestmentAnalytics 里那段长注释警告的就是这个。
 */
import React from 'react';
import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nProvider } from '../../contexts/I18nProvider';
import ShareModal from './ShareModal';
import { realizedROI, totalRealizedPnL } from '../../lib/realizedPnL';
import type { DomainWithTags, TransactionWithRequiredFields } from '../../types/dashboard';

// canvas 在 jsdom 里没有 2d context；分享图是画在 canvas 上的，这里只关心
// computeShareDataFromData 喂给 drawPortfolioImage 的数，所以把绘制整个替身掉，
// 把参数捞出来断言。
const drawnPortfolio: Array<Record<string, unknown>> = [];
vi.mock('../../lib/shareImage', () => ({
  drawPortfolioImage: (_c: unknown, opts: Record<string, unknown>) => {
    drawnPortfolio.push(opts);
  },
  drawDomainSaleImage: () => {},
  downloadCanvas: () => {},
  holdingPeriodShort: () => '',
  holdingPeriodLocalized: () => '',
}));

beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 8, 19)); // 2026-09-19
});

afterEach(() => {
  drawnPortfolio.length = 0;
});

// 2023-03 花 $5,000 买入、2026-05 以毛额 $20,000 卖出（平台费 $2,000）。
// 外加 40 个还在手上的域名，每个 $50 —— 这些成本不该进 ROI 的分母。
const domains: DomainWithTags[] = [
  {
    id: 'sold1', domain_name: 'old.com', registrar: 'NC',
    purchase_cost: 5000, renewal_cost: 0, renewal_count: 0, baseline_renewal_as_of: null,
    purchase_date: '2023-03-10', expiry_date: '2027-03-10', status: 'sold',
    estimated_value: 0, sale_price: 20000, platform_fee: 2000, sale_date: '2026-05-04', tags: [],
  } as unknown as DomainWithTags,
];
for (let i = 0; i < 40; i++) {
  domains.push({
    id: `h${i}`, domain_name: `hold${i}.com`, registrar: 'NC',
    purchase_cost: 50, renewal_cost: 0, renewal_count: 0, baseline_renewal_as_of: null,
    purchase_date: '2025-06-01', expiry_date: '2027-06-01', status: 'active',
    estimated_value: 0, tags: [],
  } as unknown as DomainWithTags);
}

const transactions: TransactionWithRequiredFields[] = [
  { id: 'b1', domain_id: 'sold1', type: 'buy', amount: 5000, currency: 'USD', date: '2023-03-10' },
  {
    id: 's1', domain_id: 'sold1', type: 'sell', amount: 20000, net_amount: 18000,
    platform_fee: 2000, currency: 'USD', date: '2026-05-04', payment_plan: 'lump_sum',
  },
] as unknown as TransactionWithRequiredFields[];

function renderShare() {
  return render(
    <I18nProvider>
      <ShareModal
        isOpen
        onClose={() => {}}
        shareData={{
          totalProfit: 0, roi: 0, bestDomain: '—',
          investmentPeriod: '—', domainCount: domains.length, totalInvestment: 0,
        }}
        domains={domains}
        transactions={transactions}
      />
    </I18nProvider>
  );
}

/** 组件用 setTimeout(drawCanvas, 100) 延迟绘制。 */
function flushDraw() {
  vi.advanceTimersByTime(200);
  return drawnPortfolio[drawnPortfolio.length - 1];
}

function setRange(value: string) {
  const select = screen.getByLabelText('Time range') as HTMLSelectElement;
  select.value = value;
  select.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('分享卡片 · ROI 口径', () => {
  it('ALL 档的 ROI 等于仪表盘的 realizedROI，而不是含库存成本的老口径', () => {
    renderShare();
    const drawn = flushDraw();
    // 旧口径：(18000 − (5000 + 40×50)) / 7000 ≈ 157%
    // 新口径：realizedROI = (18000 − 5000) / 5000 = 260%
    expect(realizedROI(domains, transactions)).toBeCloseTo(260, 6);
    expect(drawn.roi as number).toBeCloseTo(260, 6);
  });

  it('totalProfit 只认已成交的那笔，不减掉没卖出的库存成本', () => {
    renderShare();
    const drawn = flushDraw();
    expect(drawn.totalProfit as number).toBeCloseTo(totalRealizedPnL(domains, transactions), 6);
    expect(drawn.totalProfit as number).toBeCloseTo(13000, 6);
  });
});

describe('分享卡片 · 时间范围', () => {
  it('近 2 年：窗口外买入的成本必须仍然扣掉', () => {
    renderShare();
    setRange('2y');
    const drawn = flushDraw();
    // 成交日 2026-05 落在窗口内 → 这笔算数。
    // 购入日 2023-03 在窗口外，但 cost basis 取的是整段持有期，照样是 $5,000。
    // 旧实现把 domain 整个滤掉、只留 sell 交易，于是利润变成 $18,000、ROI 无限大。
    expect(drawn.totalProfit as number).toBeCloseTo(13000, 6);
    expect(drawn.roi as number).toBeCloseTo(260, 6);
    expect(drawn.totalInvestment as number).toBeCloseTo(5000, 6);
  });

  it('成交日落在窗口外时整笔不计，而不是只丢成本', () => {
    // 再加一笔 2022 年就卖掉的老成交：$1,000 成本 → 净 $4,000，利润 $3,000。
    const withOldSale = [
      ...domains,
      {
        id: 'sold0', domain_name: 'ancient.com', registrar: 'NC',
        purchase_cost: 1000, renewal_cost: 0, renewal_count: 0, baseline_renewal_as_of: null,
        purchase_date: '2021-02-01', expiry_date: '2023-02-01', status: 'sold',
        estimated_value: 0, sale_price: 4000, platform_fee: 0, sale_date: '2022-06-01', tags: [],
      } as unknown as DomainWithTags,
    ];
    const withOldTx = [
      ...transactions,
      { id: 'b0', domain_id: 'sold0', type: 'buy', amount: 1000, currency: 'USD', date: '2021-02-01' },
      {
        id: 's0', domain_id: 'sold0', type: 'sell', amount: 4000, net_amount: 4000,
        platform_fee: 0, currency: 'USD', date: '2022-06-01', payment_plan: 'lump_sum',
      },
    ] as unknown as TransactionWithRequiredFields[];

    render(
      <I18nProvider>
        <ShareModal
          isOpen
          onClose={() => {}}
          shareData={{
            totalProfit: 0, roi: 0, bestDomain: '—',
            investmentPeriod: '—', domainCount: withOldSale.length, totalInvestment: 0,
          }}
          domains={withOldSale}
          transactions={withOldTx}
        />
      </I18nProvider>
    );

    // ALL：两笔都算 → 13000 + 3000
    expect(flushDraw().totalProfit as number).toBeCloseTo(16000, 6);

    // 近 3 年（2023-09-19 起）：2022-06 那笔整笔出局，成本和利润一起走，
    // 不是"成本没了、收入还在"。
    setRange('3y');
    const drawn = flushDraw();
    expect(drawn.totalProfit as number).toBeCloseTo(13000, 6);
    expect(drawn.totalInvestment as number).toBeCloseTo(5000, 6);
  });
});
