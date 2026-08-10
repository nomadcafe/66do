import { describe, it, expect } from 'vitest';
import { txsForDomain, renewTxsForDomain } from './txIndex';

type Tx = { id: string; domain_id: string; type: string; date: string; amount: number };

function makeTxs(domainCount: number, perDomain: number): Tx[] {
  const types = ['buy', 'renew', 'sell', 'fee', 'renew'];
  const txs: Tx[] = [];
  for (let d = 0; d < domainCount; d++) {
    for (let i = 0; i < perDomain; i++) {
      txs.push({
        id: `tx-${d}-${i}`,
        domain_id: `domain-${d}`,
        type: types[i % types.length],
        date: `202${i % 5}-0${(i % 9) + 1}-15`,
        amount: 10 + i,
      });
    }
  }
  // 打散，确保索引不是靠"同域名恰好相邻"才对
  return txs.filter((_, i) => i % 2 === 0).concat(txs.filter((_, i) => i % 2 === 1));
}

describe('txsForDomain', () => {
  it('与 filter 全扫结果完全一致（含顺序）', () => {
    const txs = makeTxs(5, 6);
    for (let d = 0; d < 5; d++) {
      const id = `domain-${d}`;
      expect(txsForDomain(txs, id)).toEqual(txs.filter((t) => t.domain_id === id));
    }
  });

  it('顺序与原数组一致——浮点加法不满足结合律，顺序变了求和结果可能差最后几位', () => {
    const txs = makeTxs(3, 8);
    const fromIndex = txsForDomain(txs, 'domain-1').map((t) => t.id);
    const fromScan = txs.filter((t) => t.domain_id === 'domain-1').map((t) => t.id);
    expect(fromIndex).toEqual(fromScan);
  });

  it('没有交易的域名返回空数组', () => {
    expect(txsForDomain(makeTxs(2, 3), 'domain-nope')).toEqual([]);
  });

  it('空交易数组不炸', () => {
    expect(txsForDomain([] as Tx[], 'domain-0')).toEqual([]);
  });
});

describe('renewTxsForDomain', () => {
  it('只返回该域名的 renew 交易，顺序不变', () => {
    const txs = makeTxs(4, 7);
    for (let d = 0; d < 4; d++) {
      const id = `domain-${d}`;
      expect(renewTxsForDomain(txs, id)).toEqual(
        txs.filter((t) => t.domain_id === id && t.type === 'renew')
      );
    }
  });

  it('与全量索引互不串味', () => {
    const txs = makeTxs(3, 5);
    const all = txsForDomain(txs, 'domain-0');
    const renews = renewTxsForDomain(txs, 'domain-0');
    expect(renews.length).toBeLessThan(all.length);
    expect(renews.every((t) => t.type === 'renew')).toBe(true);
  });
});

describe('索引缓存', () => {
  it('同一个数组复用同一份桶（不重复建索引）', () => {
    const txs = makeTxs(3, 4);
    expect(txsForDomain(txs, 'domain-0')).toBe(txsForDomain(txs, 'domain-0'));
  });

  it('换成新数组会重新建索引，拿到的是新内容', () => {
    const a = makeTxs(2, 3);
    const b = makeTxs(2, 3).map((t) => ({ ...t, domain_id: 'domain-moved' }));

    expect(txsForDomain(a, 'domain-0').length).toBeGreaterThan(0);
    expect(txsForDomain(b, 'domain-0')).toEqual([]);
    expect(txsForDomain(b, 'domain-moved').length).toBe(6);
    // 原数组的索引不受影响
    expect(txsForDomain(a, 'domain-0').length).toBeGreaterThan(0);
  });
});
