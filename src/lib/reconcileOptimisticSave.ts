/**
 * 保存失败后的乐观更新对账。
 *
 * saveData 走的是「先乐观更新 UI，再逐条持久化」。一旦中途某条写失败，本地
 * state 里就混着两种行：已经落库的，和只存在于浏览器里的。此时既不能整体回滚
 * （会把已经落库的改动从 UI 上抹掉，下次保存又要重发一遍），也不能原样保留
 * ——那才是真正的坑：
 *
 *   下一次 saveData 的增量 diff 是拿当前 state 当「服务端已有状态」的基准
 *   （existingDomainMap）。失败的行留在 state 里就等于被标记成「已保存」，
 *   签名一致 → 永远不会再发送，用户以为存上了，刷新才发现没有。新增失败的
 *   域名更糟：它会被后续的 existingChanges 判成已存在 → 走 PUT
 *   /api/domains/{id} → 服务端 404，从此每次保存都报错。
 *
 * 所以按行对账：落库的保留新值，改动没落库的退回旧值，新增没落库的丢弃。
 * 这样 state 重新等于「服务端真实状态」，失败的改动会在下次保存被 diff 出来
 * 重试。
 */
export function reconcileOptimisticSave<T extends { id: string }>(
  /** 本次尝试保存的完整列表（乐观更新写进 state 的那份） */
  attempted: T[],
  /** 保存前的 state 快照 */
  previous: T[],
  /** 确认已落库的行 id */
  savedIds: Set<string>,
  /** 可选：服务端回写的行，字段可能被服务端规范化过，优先于本地值 */
  preferred?: Map<string, T>
): T[] {
  const previousById = new Map(previous.map((item) => [item.id, item]));
  const result: T[] = [];

  for (const item of attempted) {
    if (savedIds.has(item.id)) {
      result.push(preferred?.get(item.id) ?? item);
      continue;
    }
    const prior = previousById.get(item.id);
    // 改动没落库 → 退回旧值；新增没落库 → 不 push，等于丢弃
    if (prior) result.push(prior);
  }

  return result;
}
