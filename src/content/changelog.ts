import type { Metadata } from 'next';
import type { HomeLocale } from '../i18n/homeDictionary';
import { getSiteUrl } from '../lib/siteUrl';

export interface ChangelogRelease {
  version: string;
  date: string;
  items: string[];
}

export const changelogPageCopy: Record<
  HomeLocale,
  {
    metaTitle: string;
    metaDescription: string;
    title: string;
    subtitle: string;
    backHome: string;
  }
> = {
  zh: {
    metaTitle: '更新日志',
    metaDescription:
      'Domain.Financial 产品更新与改进记录：性能、财务口径、首页与数据保存等。',
    title: '更新日志',
    subtitle: '按时间倒序列出主要变更，便于了解近期改进。',
    backHome: '返回首页',
  },
  en: {
    metaTitle: 'Changelog',
    metaDescription:
      'Product updates for Domain.Financial: performance, financial metrics, marketing site, and data saving.',
    title: 'Changelog',
    subtitle: 'Recent changes, newest first.',
    backHome: 'Back to home',
  },
};

export function changelogPageMetadata(locale: HomeLocale): Metadata {
  const c = changelogPageCopy[locale];
  const base = getSiteUrl();
  const canonical = new URL(`/${locale}/changelog`, base).href;
  const zh = new URL('/zh/changelog', base).href;
  const en = new URL('/en/changelog', base).href;
  return {
    title: `${c.metaTitle} · Domain.Financial`,
    description: c.metaDescription,
    alternates: {
      canonical,
      languages: {
        'zh-CN': zh,
        en,
        'x-default': en,
      },
    },
    openGraph: {
      url: canonical,
      title: `${c.metaTitle} · Domain.Financial`,
      description: c.metaDescription,
      type: 'website',
    },
  };
}

export const changelogReleases: Record<HomeLocale, ChangelogRelease[]> = {
  zh: [
    {
      version: '2026-04-30',
      date: '2026-04-30',
      items: [
        'Insights 子 tab 二次拆分：原 Performance 拆为「Performance」（业绩结果，Top Performers + 现金流 + 时间窗口图表）和「Portfolio」（持仓构成，三张分布图）；语义更清晰，需要哪类视角直接定位。',
        '指标口径优化：Win rate 升级为 Success rate（盈利卖出 / 历史持有总数，含 expired），更贴合域名投资真实命中率；Performance hero 砍掉容易爆表的 Annualized Return / Sharpe Ratio，新增 Net Profit、Total Sales、Platform Fees；图表绿色面积由 Revenue（净）切到 Total Sales（毛额），与上方 KPI 同源对齐。',
        '表单清理：「续费成本基线日」只在编辑老域名时显示（新建场景对该字段无实际影响），文案重写为按行为说明，去掉技术术语。',
        '体验与底层：交易列表 KPI tile 按交易类型自适应；仪表板 tab 切换改为 state 驱动 + 访问过的子 tab 保持挂载，二次切换零延迟；安全 / 缓存 / API 字段映射做了一轮加固。',
      ],
    },
    {
      version: '2026-04-29',
      date: '2026-04-29',
      items: [
        '全站视觉刷新：登录 / 404 / 错误页 / Landing Hero / 空态 / Loading 骨架对齐到统一调色板（stone + teal / emerald）；表单与弹窗、域名卡片与表格也同步刷新，新增状态侧边色条。',
        'Insights 首轮重构：顶部新增 4 项 KPI strip（Realized P&L / Best sale / Win rate / Avg holding），下方改为分段子 tab（Performance / Renewals / Loss），替代原来纵向 5 段长滚，常用面板 1 次点击直达。',
        '分析升级：续费预测 + YTD 与事件流对齐，archive 续费日期按 expiry 倒推（不再堆在基线日）；Annual Renewal Analysis 接入统一事件流；Top Performers / 最差成交统一走 net 口径；Loss Analysis 调玫红主题 + 真诚的 0 状态。',
        '杂项：Portfolio card 同时显示分摊与现金两种 YTD 续费口径；Yearly Cashflow 表迁入 Performance 并改为现金流方向口径；多处冗余面板（Renewal Overview / Accuracy 等）下线。',
      ],
    },
    {
      version: '2026-04-27',
      date: '2026-04-27',
      items: [
        '系统升级：多个分析模块的数据源、缓存与计算口径统一重构，仪表板更轻、切换面板与年份更顺。',
        'UI 升级：精简了若干重复或冗余的卡片，调整图表与文案，信息密度更合理。',
        '修复大量 bug：优化了投资组合表现图的「组合价值」曲线，现按真实净资产（已实收 + 持仓 fair value）计算；优化了续费分析的计算公式；收紧了过期域名损失定义到只算用户主动标 expired 的域名，避免与「下次到期」提醒重复警告；续费录入的「建议金额」改为基于你的真实交易历史。',
        '国际化与底层清理：货币格式与多处提示按中英文 locale 显示；删除一张已废弃的内部数据库表与对应触发器。',
      ],
    },
    {
      version: '2026-04-11',
      date: '2026-04-11',
      items: [
        '营销站支持中文 / 英文独立地址（/zh、/en），并完善站点地图等便于检索的配置；首页按语言展示，新增更新日志入口。',
        '出售「成交额」与「净收入」口径在全站对齐；保存域名与交易时仅提交变更，整体更省流量、响应更快。',
        '续费与到期、续费次数等逻辑更一致；报告与分析的时间范围与文案优化；登录态与数据同步相关稳定性改进。',
      ],
    },
    {
      version: '2026-03-15',
      date: '2026-03-15',
      items: [
        '登录后数据加载与保存链路更稳，会话过期时更容易自动恢复，减少保存失败或列表不同步的情况。',
        '新增、编辑交易后界面更快反映结果；分期出售在统计中按实际已收款折算，避免误算。',
        '续费录入流程更顺；可按注册商查看分布；域名时间轴汇总购买、续费与出售；分析与分享体验增强。',
      ],
    },
    {
      version: '2026-03-01',
      date: '2026-03-01',
      items: [
        '支持使用 Google 账号登录；登录后跳转与未登录访问仪表板的体验优化。',
        '品牌与界面统一为 Domain.Financial；首页与设置（语言、主题、数据）更易用。',
        '分期进度与部分出售平台手续费规则更贴近实际；投资组合与单域名分享的配图与文案优化。',
        '概览与列表多语言覆盖；支持将已售域名记入交易；过期损失与续费相关分析能力扩展。',
      ],
    },
    {
      version: '2026-02-16',
      date: '2026-02-16',
      items: [
        '仪表板与首页视觉与布局更新，信息层级更清晰。',
        '编辑域名弹窗交互更可靠；重复添加域名时有明确提示。',
        '交易保存与错误提示更稳定；分享相关文案支持多语言。',
      ],
    },
    {
      version: '2026-01-05',
      date: '2026-01-05',
      items: [
        '仪表板结构整理，数据加载与接口更清晰，减少多余刷新。',
        '财务与续费相关计算、校验与缓存同步修复。',
        '强化数据归属校验，降低误访问他人数据的风险。',
      ],
    },
  ],
  en: [
    {
      version: '2026-04-30',
      date: '2026-04-30',
      items: [
        'Insights sub-tabs split again: the old Performance tab is now "Performance" (results — Top Performers, cashflow, timeframe chart) and "Portfolio" (composition — the three distribution charts). Cleaner semantics, one click to the view you want.',
        'Metric overhaul: Win rate is replaced by Success rate (profitable sales / total domains ever owned, including expired) — closer to a domain investor\'s real hit rate. The Performance hero drops easy-to-explode Annualized Return / Sharpe and adds Net Profit, Total Sales, Platform Fees; the chart\'s green area switches from Revenue (net) to Total Sales (gross) so it lines up with the KPI tile above.',
        'Form cleanup: the "Renewal cost baseline" field now only appears when editing existing domains (it has no observable effect on Add); help text was rewritten in terms of behavior, not internal field names.',
        'Polish & internals: transaction-list KPI tiles adapt to the active type filter; dashboard tab switching moved to state-driven with visited sub-tabs kept mounted, so re-entering is instant; a round of security / caching / API payload mapping hardening.',
      ],
    },
    {
      version: '2026-04-29',
      date: '2026-04-29',
      items: [
        'Full visual refresh: login / 404 / error / landing hero / empty / loading skeleton aligned to one palette (stone + teal / emerald); forms, modals, domain cards, and tables refreshed with status edge stripes.',
        'Insights v1 redesign: a 4-tile KPI strip on top (Realized P&L / Best sale / Win rate / Avg holding) plus segmented sub-tabs (Performance / Renewals / Loss) replace the old vertical 5-section scroll — the panel you want is one click away.',
        'Analytics upgrades: renewal forecasting + YTD now share one event stream, with archive renewal dates walked back from expiry instead of all stacked on the baseline date; Annual Renewal Analysis switched to the same event stream; Top Performers / worst sale unified on net proceeds; Loss Analysis recolored to rose with an honest zero state.',
        'Misc: Portfolio card shows both amortized and cash-basis YTD renewal cost; Yearly Cashflow table moved into Performance with cash-flow-direction labels; redundant panels (Renewal Overview / Accuracy etc.) retired.',
      ],
    },
    {
      version: '2026-04-27',
      date: '2026-04-27',
      items: [
        'System upgrades: data sources, caching, and calculation conventions across several analytics modules were unified and refactored — the dashboard is lighter and panel / year switches feel snappier.',
        'UI updates: streamlined several duplicated or redundant cards; refreshed chart layouts and copy for cleaner information density.',
        'Many bug fixes — notably: improved the investment chart’s "Portfolio Value" line to compute actual net asset value (realized cash + fair value of held domains); improved the renewal analysis formulas; tightened the expired-domain loss definition to only count domains you explicitly mark expired, no longer double-warning with the "next expiry" reminder; the "suggested renewal cost" hint in the transaction form now derives from your real transactions.',
        'Localization & cleanup: currency formatting and several hint strings now follow your Chinese / English locale; an obsolete internal database table and its trigger were removed.',
      ],
    },
    {
      version: '2026-04-11',
      date: '2026-04-11',
      items: [
        'Public site in Chinese and English (/zh, /en) with sitemap and related discovery settings; localized homepage; changelog added.',
        'Sell “gross” vs “net” amounts are consistent across the app; saving sends only what changed, with faster follow-up loads.',
        'Renewals, expiry, and renewal counts behave more predictably; reports and analytics ranges/copy improved; reliability fixes for sign-in and data refresh.',
      ],
    },
    {
      version: '2026-03-15',
      date: '2026-03-15',
      items: [
        'More reliable load/save after sign-in, with better recovery when the session expires and fewer stale lists.',
        'New and edited transactions show up faster in the UI; installment sales in stats follow cash collected so totals stay sensible.',
        'Smoother renewal entry; registrar distribution; a timeline of purchases, renewals, and sales; richer analytics and sharing.',
      ],
    },
    {
      version: '2026-03-01',
      date: '2026-03-01',
      items: [
        'Sign in with Google; clearer redirects for login and protected pages.',
        'Rebrand to Domain.Financial; cleaner homepage and settings (language, theme, data).',
        'Installment progress and some marketplace fee rules refined; improved portfolio and single-domain share visuals and copy.',
        'Broader translations on overview and lists; record sales including sold domains; more renewal and expiry-related insights.',
      ],
    },
    {
      version: '2026-02-16',
      date: '2026-02-16',
      items: [
        'Refreshed dashboard and landing layout for clearer hierarchy.',
        'More dependable domain edit dialog; clearer message when a domain is already in your portfolio.',
        'Sturdier transaction saves and error feedback; share-related strings localized.',
      ],
    },
    {
      version: '2026-01-05',
      date: '2026-01-05',
      items: [
        'Dashboard structure and data loading simplified for fewer unnecessary refreshes.',
        'Fixes to validation, caching, and finance/renewal calculations.',
        'Stricter checks so domain and transaction data stay tied to the signed-in user.',
      ],
    },
  ],
};
