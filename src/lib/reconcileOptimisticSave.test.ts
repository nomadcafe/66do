import { describe, it, expect } from 'vitest';
import { reconcileOptimisticSave } from './reconcileOptimisticSave';

type Row = { id: string; name: string };

const row = (id: string, name: string): Row => ({ id, name });

describe('reconcileOptimisticSave', () => {
  it('全部成功时原样保留尝试保存的列表', () => {
    const previous = [row('a', 'old-a')];
    const attempted = [row('a', 'new-a'), row('b', 'new-b')];

    const result = reconcileOptimisticSave(attempted, previous, new Set(['a', 'b']));

    expect(result).toEqual([row('a', 'new-a'), row('b', 'new-b')]);
  });

  it('改动没落库的行退回旧值', () => {
    const previous = [row('a', 'old-a'), row('b', 'old-b')];
    const attempted = [row('a', 'new-a'), row('b', 'new-b')];

    // a 存上了，b 那条 PUT 失败
    const result = reconcileOptimisticSave(attempted, previous, new Set(['a']));

    expect(result).toEqual([row('a', 'new-a'), row('b', 'old-b')]);
  });

  it('新增没落库的行被丢弃，而不是留在 state 里冒充已保存', () => {
    const previous = [row('a', 'old-a')];
    const attempted = [row('a', 'old-a'), row('new', 'never-persisted')];

    const result = reconcileOptimisticSave(attempted, previous, new Set());

    expect(result).toEqual([row('a', 'old-a')]);
    expect(result.find((r) => r.id === 'new')).toBeUndefined();
  });

  it('回滚后的 state 能让下一次 diff 重新发现失败的改动', () => {
    // 这是这个函数存在的全部理由：不回滚的话，失败行的签名与 state 一致，
    // 增量 diff 会判定「没变化」→ 永远不重发 → 用户以为存上了。
    const previous = [row('a', 'old-a')];
    const attempted = [row('a', 'new-a')];

    const rolledBack = reconcileOptimisticSave(attempted, previous, new Set());

    const signature = (r: Row) => JSON.stringify(r);
    const stateById = new Map(rolledBack.map((r) => [r.id, r]));
    const changed = attempted.filter((r) => {
      const existing = stateById.get(r.id);
      return !existing || signature(existing) !== signature(r);
    });

    expect(changed).toEqual([row('a', 'new-a')]);
  });

  it('落库的行优先用服务端回写的版本', () => {
    const previous: Row[] = [];
    const attempted = [row('a', 'local')];
    const preferred = new Map([['a', row('a', 'server-normalized')]]);

    const result = reconcileOptimisticSave(attempted, previous, new Set(['a']), preferred);

    expect(result).toEqual([row('a', 'server-normalized')]);
  });

  it('preferred 里没有对应行时退回本地值', () => {
    const attempted = [row('a', 'local')];

    const result = reconcileOptimisticSave(attempted, [], new Set(['a']), new Map());

    expect(result).toEqual([row('a', 'local')]);
  });

  it('未改动的行不受影响，且保持 attempted 的顺序', () => {
    const previous = [row('a', 'a'), row('b', 'b'), row('c', 'c')];
    const attempted = [row('c', 'c'), row('a', 'a'), row('b', 'b-edited')];

    const result = reconcileOptimisticSave(attempted, previous, new Set());

    expect(result.map((r) => r.id)).toEqual(['c', 'a', 'b']);
    expect(result[2].name).toBe('b');
  });

  it('previous 里有、attempted 里没有的行不会被复活（删除路径不归它管）', () => {
    const previous = [row('a', 'a'), row('deleted', 'gone')];
    const attempted = [row('a', 'a')];

    const result = reconcileOptimisticSave(attempted, previous, new Set());

    expect(result).toEqual([row('a', 'a')]);
  });

  it('空输入返回空列表', () => {
    expect(reconcileOptimisticSave<Row>([], [], new Set())).toEqual([]);
  });
});
