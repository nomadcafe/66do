/**
 * 推文文本。这是**发出去给别人看**的输出，所以两件事要钉住：
 *   1. 负数的符号位置——以前模板里直接 `$${n.toLocaleString()}`，亏损写成 `$-500`
 *   2. 成本基准为 0 时不能写「ROI 0.0%」——0% 读作"打平"，实际是"除不了"
 */
import { describe, it, expect } from 'vitest';
import { saleTweetText, investedTweetText, portfolioTweetText, domainHashtag } from './shareText';

describe('金额符号位置', () => {
  it('亏损是 -$500，不是 $-500', () => {
    const text = saleTweetText({ domainName: 'x.com', profit: -500, roi: -50 });
    expect(text).toContain('-$500');
    expect(text).not.toContain('$-500');
  });

  it('盈利不带多余符号', () => {
    expect(saleTweetText({ domainName: 'x.com', profit: 10000, roi: 900 }))
      .toContain('$10,000');
  });

  it('组合推文同样处理', () => {
    const text = portfolioTweetText({ profit: -1234, roi: -12 });
    expect(text).toContain('-$1,234');
    expect(text).not.toContain('$-1,234');
  });
});

describe('ROI 为 null 时整句省掉', () => {
  it('免费域名：只说利润，不写 ROI', () => {
    const text = investedTweetText({ domainName: 'free.com', profit: 10000, roi: null });
    expect(text).toContain('$10,000');
    expect(text).not.toContain('ROI');
    expect(text).not.toContain('0.0%');
  });

  it('有 ROI 时照常写出来', () => {
    expect(investedTweetText({ domainName: 'x.com', profit: 900, roi: 900 }))
      .toContain('ROI 900.0%');
  });

  it('亏损且无 ROI', () => {
    const text = saleTweetText({ domainName: 'x.com', profit: -200, roi: null });
    expect(text).toContain('-$200');
    expect(text).not.toContain('ROI');
  });
});

describe('盈亏措辞不矛盾', () => {
  it('亏损不带庆祝 emoji', () => {
    const text = saleTweetText({ domainName: 'x.com', profit: -500, roi: -50 });
    expect(text).not.toContain('🎉');
    expect(text).not.toContain('🚀');
  });

  it('盈利才庆祝', () => {
    expect(saleTweetText({ domainName: 'x.com', profit: 500, roi: 50 })).toContain('🎉');
  });
});

describe('domainHashtag', () => {
  it('多级 TLD 只取 SLD', () => {
    // `#example.co.uk` 不是合法 hashtag；老实现 replace('.','') 只去掉第一个点，
    // 结果是 #examplecouk
    expect(domainHashtag('example.co.uk')).toBe('#example');
  });

  it('普通域名', () => {
    expect(domainHashtag('example.com')).toBe('#example');
  });
});
