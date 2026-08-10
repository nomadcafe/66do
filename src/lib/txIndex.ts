/**
 * 按 domain_id 建的交易索引。
 *
 * 背景：持有成本 / 续费事件这些函数的签名都是 (domain, transactions)，内部
 * 各自全扫一遍交易数组。放进「按域名循环」里就是 O(域名数 × 交易数)——
 * 1000 域名 × 5000 交易 = 每次重算 500 万次迭代。而且不只是聚合函数：
 * DomainCard / ShareModal 这类组件也是每个域名调一次，列表渲染同样中招。
 *
 * 做法：用 WeakMap 以「交易数组本身」为键缓存索引。这样所有调用点都不用改
 * 签名就能受益，同一个数组只建一次索引，数组被 GC 时索引跟着回收。
 *
 * 前提：调用方不原地改数组（push/splice），而是替换成新数组——本项目的交易
 * 数组都来自 React state 或 useMemo 派生，符合这个前提。如果哪天有人原地
 * 改，索引会过期；真需要的话在那里换成新数组即可。
 *
 * 分桶时按原数组顺序 push，所以每个域名桶内的顺序与原来 filter 出来的顺序
 * 完全一致——浮点加法不满足结合律，保持顺序才能保证结果逐位相同。
 */

interface TxLike {
  domain_id: string;
  type: string;
}

const allByDomainCache = new WeakMap<object, Map<string, unknown[]>>();
const renewByDomainCache = new WeakMap<object, Map<string, unknown[]>>();

function buildIndex<T extends TxLike>(
  transactions: T[],
  keep: (t: T) => boolean
): Map<string, T[]> {
  const index = new Map<string, T[]>();
  for (const t of transactions) {
    if (!keep(t)) continue;
    const bucket = index.get(t.domain_id);
    if (bucket) {
      bucket.push(t);
    } else {
      index.set(t.domain_id, [t]);
    }
  }
  return index;
}

function cachedIndex<T extends TxLike>(
  cache: WeakMap<object, Map<string, unknown[]>>,
  transactions: T[],
  keep: (t: T) => boolean
): Map<string, T[]> {
  const hit = cache.get(transactions);
  if (hit) return hit as Map<string, T[]>;

  const index = buildIndex(transactions, keep);
  cache.set(transactions, index as Map<string, unknown[]>);
  return index;
}

/** 某域名的全部交易（保持原数组顺序）。查不到返回空数组。 */
export function txsForDomain<T extends TxLike>(transactions: T[], domainId: string): T[] {
  return cachedIndex(allByDomainCache, transactions, () => true).get(domainId) ?? [];
}

/** 某域名的 renew 交易（保持原数组顺序）。查不到返回空数组。 */
export function renewTxsForDomain<T extends TxLike>(transactions: T[], domainId: string): T[] {
  return cachedIndex(renewByDomainCache, transactions, (t) => t.type === 'renew').get(domainId) ?? [];
}
