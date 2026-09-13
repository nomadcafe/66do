/**
 * 视觉层级的架构守卫。
 *
 * 渐变 + 光晕这个装饰原本在 19 个文件里出现 30 次——光 Insights 的 Performance
 * 子 tab 竖着排下来就有三张（顶部 KPI 条、Top Performers、年度现金流表头）。
 * 装饰本来是用来定重点的，用满全站之后每屏都在喊，等于没有一屏在喊。
 *
 * 规则：**每块屏幕最多一个 .surface-hero**。dashboard 三个 tab 各一个：
 *   portfolio → PortfolioHealthCard
 *   insights  → InsightsTab 顶部 KPI 条
 *   activity  → TransactionList 顶部 KPI 条
 * 其余一律 .surface-card。
 *
 * 这条规则光靠 code review 守不住（下一个做新面板的人很自然会照抄现成的
 * hero 样式），所以钉在测试里。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOTS = ['src/components', 'app/dashboard'];

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (full.endsWith('.tsx') && !full.includes('.test.')) out.push(full);
  }
  return out;
}

const files = ROOTS.flatMap(walk);
const countIn = (src: string, needle: string) => src.split(needle).length - 1;

/** 允许使用 hero 的文件，以及各自允许的个数 */
const HERO_BUDGET: Record<string, number> = {
  'src/components/dashboard/PortfolioHealthCard.tsx': 1,
  'src/components/dashboard/InsightsTab.tsx': 1,
  'src/components/transaction/TransactionList.tsx': 1,
};

describe('视觉层级', () => {
  it('dashboard 里只有三处 hero，一个 tab 一个', () => {
    const actual: Record<string, number> = {};
    for (const f of files) {
      const n = countIn(readFileSync(f, 'utf8'), 'className="surface-hero"');
      if (n > 0) actual[f] = n;
    }
    expect(actual).toEqual(HERO_BUDGET);
  });

  it('dashboard 组件里不再直接写渐变光晕', () => {
    const offenders = files.filter((f) => readFileSync(f, 'utf8').includes('blur-3xl'));
    expect(offenders).toEqual([]);
  });

  it('普通卡片统一走 .surface-card，不再各写一套边框/阴影', () => {
    // 语义相同、写法不同的那几种：stone-200/80 vs /70 vs 实色
    const variantRe =
      /rounded-2xl border border-stone-200(?:\/(?:70|80))? bg-white[a-z0-9\-\/ ]*shadow-sm/;
    const offenders = files.filter((f) => variantRe.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });
});
