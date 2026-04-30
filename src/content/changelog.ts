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
        '全站视觉刷新：登录、404、Landing、空态、表单、域名卡片与表格统一到一套调色板（stone + teal / emerald），整体观感更一致。',
        'Insights 重构：顶部 KPI strip + 分段子 tab（Performance / Portfolio / Renewals / Loss）替代原来的纵向长滚，常用面板一键直达。',
        '域名追踪算法优化：核心指标口径更清晰、更贴合真实业绩，图表数字与 KPI 卡片相互对齐。',
        'Bug 修复、续费预测功能上线，以及其他小功能优化。',
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
        'Visual refresh: login, 404, landing, empty states, forms, domain cards, and tables all moved onto one palette (stone + teal / emerald) for a more cohesive look.',
        'Insights restructure: a top KPI strip plus segmented sub-tabs (Performance / Portfolio / Renewals / Loss) replace the old vertical scroll — the panel you want is one click away.',
        'Domain tracking refined: core metrics now read more clearly and reflect real performance, with charts and KPI tiles consistent.',
        'Bug fixes, new renewal forecasting, and other small improvements.',
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
