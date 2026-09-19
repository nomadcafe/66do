/**
 * category / platform 落库前的归一。
 *
 * 两个都是自由文本 + datalist 自动补全的字段。以前直接 `(x as string) || null`
 * 原样存：'Sedo ' 和 'Sedo' 于是成了两个不同的值——在交易列表里看着一模一样，
 * 在候选下拉里却各占一条。新建和编辑两条路径必须用同一套归一，否则新建时
 * trim 过的值，改一次又把空格带回来了。
 *
 * 只 trim，不动大小写：用户自己造的平台名不该被悄悄改写。同一平台大小写分叉
 * 的问题由候选下拉那边"忽略大小写去重"从源头解决
 * （见 TransactionFormPlatform.test.tsx）。
 */
import { describe, it, expect } from 'vitest';
import { buildTransactionInsertPayload, buildTransactionUpdatePayload } from './transactionInsertPayload';

const base = { domain_id: 'd1', type: 'sell', amount: 100, currency: 'USD', date: '2026-01-01' };

describe('platform / category 落库归一', () => {
  it('新建：前后空格被 trim 掉', () => {
    const p = buildTransactionInsertPayload({ ...base, platform: '  Sedo  ', category: ' Investment ' }, 'u1');
    expect(p.platform).toBe('Sedo');
    expect(p.category).toBe('Investment');
  });

  it('新建：只有空白等同于没填，存 null', () => {
    const p = buildTransactionInsertPayload({ ...base, platform: '   ', category: '' }, 'u1');
    expect(p.platform).toBeNull();
    expect(p.category).toBeNull();
  });

  it('新建：大小写原样保留，不做规范化', () => {
    const p = buildTransactionInsertPayload({ ...base, platform: 'myBroker.io' }, 'u1');
    expect(p.platform).toBe('myBroker.io');
  });

  it('编辑走同一套归一', () => {
    const out = buildTransactionUpdatePayload({ platform: ' Afternic ', category: ' Ops ' });
    expect(out.platform).toBe('Afternic');
    expect(out.category).toBe('Ops');
  });

  it('编辑时字段没出现就不动它', () => {
    const out = buildTransactionUpdatePayload({ amount: 5 });
    expect('platform' in out).toBe(false);
    expect('category' in out).toBe(false);
  });
});
