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
      version: '2026-04-11',
      date: '2026-04-11',
      items: [
        '营销站路径 /zh、/en；sitemap、robots、metadataBase；根路径与旧 /changelog、/privacy 按语言重定向。',
        '首页服务端渲染与按语言 metadata；更新日志页与页脚入口；联系我们在「联系方式」栏。',
        '出售毛/净额统一（sellProceeds）、报表与列表口径对齐；保存改为增量写入并去掉保存后全量重拉。',
        '四月初（至 4/10 前后）：续费基线与到期/次数同步、移除「是否延长到期」开关改由自定义续费年数、报告与 Analytics 时间范围及推荐文案、PostgREST 超页交易 404/重复主键与 401 刷新 session 等修复。',
      ],
    },
    {
      version: '2026-03-15',
      date: '2026-03-15',
      items: [
        '交易 API 在可用时使用 Service Role，与 RLS 文档及鉴权策略整理。',
        '有 userId 时经 API 拉数；saveData 用 getSession 解析 token；向 API 传递 refresh_token 以 setSession；保存失败时不误整页重载。',
        '三月中下旬：客户端 Supabase 插入/更新交易、乐观更新优先、金额与 base_amount 规范化；仅真实分期出售才按比例折算仪表板指标。',
        '三月底：续费一站式录入、注册商分布与转入快捷、按购买/续费/出售排序的域名时间轴、分享用 domainfinancial.png 与年现金流等分析补强。',
      ],
    },
    {
      version: '2026-03-01',
      date: '2026-03-01',
      items: [
        'Google 登录与 OAuth 回调；登录页 Suspense、redirect 参数与未登录跳转。',
        '品牌统一为 Domain.Financial；首页暖白与 header CSS 变量、页脚与隐私联系占位、Settings 语言/主题与 Data 子页。',
        '分期：按实收/总额进度、Spaceship 分期费率与首付计入；出售分享图叠加域名/ROI/持有期、Portfolio 与单域名分享样式与 X 平台文案。',
        'Portfolio/交易列表与 Domain 网格 i18n；Overview 用 USD base_amount、Quick Actions 上移；过期损失与高级续费分析、交易表单可选已售域名与搜索。',
      ],
    },
    {
      version: '2026-02-16',
      date: '2026-02-16',
      items: [
        '仪表板与首页 stone/teal 现代化布局与顶栏品牌区。',
        '域名编辑弹窗：Portal、关闭与提交链路、重复域名 409 的 i18n 提示。',
        '交易保存：PUT 403 时回退 POST；401 响应 CORS 与校验错误透出；分享弹窗文案接入 i18n。',
      ],
    },
    {
      version: '2026-01-05',
      date: '2026-01-05',
      items: [
        'Dashboard 拆分职责并提取自定义 Hooks；API 路由 REST 化以减少不必要重渲染。',
        '数据校验、缓存与财务/续费相关计算修复；交易 ID 与列表一致性。',
        'TransactionService / DomainService 用户归属校验，避免跨用户数据访问。',
        '常量、日志与文件校验逻辑统一；移除冗余测试与调试文件。',
      ],
    },
  ],
  en: [
    {
      version: '2026-04-11',
      date: '2026-04-11',
      items: [
        'Marketing site at /zh and /en; sitemap, robots, metadataBase; /, /changelog, and /privacy redirect by locale.',
        'Server-rendered homepage with localized metadata; changelog page and footer; Contact Us under Contact.',
        'Unified sell gross/net (sellProceeds); aligned reports and lists; incremental saves without post-save full refetch.',
        'Early April: renewal baseline and expiry/count sync, renewal years UX (removed extend-expiry toggle), report/analytics ranges and copy, PostgREST paging & duplicate-key handling, 401 session refresh fixes.',
      ],
    },
    {
      version: '2026-03-15',
      date: '2026-03-15',
      items: [
        'Transactions API can use service role when configured; auth/RLS notes tidied.',
        'Load dashboard via API when logged in; saveData resolves tokens via getSession; pass refresh_token for setSession; no full reload on save failure.',
        'Mid–late March: client Supabase inserts/updates, optimistic updates first, amount/base_amount normalization; installment metrics only when payment_plan is installment.',
        'Late March: unified renewal entry, registrar distribution + transfer shortcut, domain timeline (buy/renew/sell), share asset domainfinancial.png and yearly cashflow-style analytics.',
      ],
    },
    {
      version: '2026-03-01',
      date: '2026-03-01',
      items: [
        'Google sign-in and OAuth callback; login Suspense, redirect query, gated dashboard routes.',
        'Rebrand to Domain.Financial; homepage polish, footer/privacy contact placeholder, Settings language/theme and Data tab.',
        'Installment progress by cash collected; Spaceship fee rules; share overlays (domain, ROI, hold time) and portfolio summary styling; X instead of Twitter.',
        'Portfolio/transactions/domain grid i18n; Overview USD base_amount and Quick Actions; expired loss & advanced renewal; transaction form includes sold domains with search.',
      ],
    },
    {
      version: '2026-02-16',
      date: '2026-02-16',
      items: [
        'Modern stone/teal shell for dashboard and landing header.',
        'Domain edit modal: portal rendering, close/submit flow, localized duplicate-domain (409) message.',
        'Transactions: POST fallback after PUT 403; CORS on 401 and validation errors; share modal strings in i18n.',
      ],
    },
    {
      version: '2026-01-05',
      date: '2026-01-05',
      items: [
        'Dashboard split into hooks and smaller surfaces; REST-shaped API routes to cut extra re-renders.',
        'Validation, cache sync, and fixes for finance/renewal math; transaction IDs and list consistency.',
        'Ownership checks in TransactionService and DomainService.',
        'Shared constants, logging, and file validation; removed stray tests and debug files.',
      ],
    },
  ],
};
