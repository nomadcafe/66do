import type { HomeLocale } from '../i18n/homeDictionary';

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

export const changelogReleases: Record<HomeLocale, ChangelogRelease[]> = {
  zh: [
    {
      version: '2026-04-11',
      date: '2026-04-11',
      items: [
        '财务口径：统一「出售毛额 / 出售净额」（sellGrossUSD、sellNetUSD），抽出 sellProceeds 模块；报表、分享、概览与交易列表、财务工具函数等与全站 Total Sales / Total Revenue 语义对齐。',
        '保存性能：域名与交易改为增量写入（仅提交变更项），去掉保存成功后的全量重拉；新建交易仍合并服务端返回行，避免乐观数据与库不一致。',
        '首页与 SEO：落地页改为服务端渲染以降低首屏脚本；generateMetadata、<html lang> 与界面语言一致（Cookie domain_financial_locale 优先，其次 Accept-Language）；仪表板内切换语言时同步写入 Cookie。',
        '新增「更新日志」页面（/changelog）与首页页脚入口；联系邮箱展示维持防爬占位（hello###domain.financial）。',
        '四月上旬已上线：续费与到期、续费次数与基线、分期出售在指标中按实收折算；交易保存、PostgREST 分页与 401 后刷新 session 等稳定性改进。',
      ],
    },
  ],
  en: [
    {
      version: '2026-04-11',
      date: '2026-04-11',
      items: [
        'Finance semantics: unified sell gross vs net (sellGrossUSD, sellNetUSD) via a shared sellProceeds module; reports, share payloads, overview, transaction list, and helpers now match site-wide Total Sales / Total Revenue meaning.',
        'Save performance: incremental persistence for domains and transactions (only changed rows), no post-save full refetch; new inserts still merge server rows to avoid long-lived client/DB drift.',
        'Homepage & SEO: marketing page is server-rendered for a lighter first load; generateMetadata and <html lang> follow the UI locale (cookie domain_financial_locale first, then Accept-Language); dashboard language changes sync the same cookie.',
        'Added a changelog at /changelog with a footer link on the homepage; footer email remains an obfuscated placeholder (hello###domain.financial).',
        'Earlier in April: renewal/expiry/baseline renewal counts, installment sales reflected in metrics by cash collected; fixes around transaction saves, PostgREST pagination, and session refresh after 401.',
      ],
    },
  ],
};
