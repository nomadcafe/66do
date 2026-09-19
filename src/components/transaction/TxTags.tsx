'use client';

import { Receipt as ReceiptIcon, Tag as TagIcon, Store } from 'lucide-react';
import type { TransactionWithRequiredFields } from '../../types/transaction';

/**
 * 交易行上的 category / platform 标签 + 凭证链接。
 *
 * 这三个字段以前全是只写的：表单收，落库，然后界面一个字都不还给用户。
 * category 至少还进了搜索（搜得到、但看不出命中的是什么），platform 和
 * receipt_url 连搜索都没有——填进去就消失了。
 *
 * receipt_url 尤其可惜：validation.ts 给它写了完整的 URL 校验，连协议白名单
 * 都有，注释写着 "only safe to render as an <a href> if the scheme can't
 * execute script" —— 防护是冲着渲染成链接做的，链接本身却一直没做。
 *
 * 这里把三个一起补上。卡片和表格两个变体共用同一个组件，免得又长出两套。
 */

/** 协议白名单。validation.ts 在写入时已经挡了一道，这里是渲染前的第二道：
 *  历史数据、导入的备份、直接改库，都可能绕过写入校验塞进 javascript: 之类。
 *  拿不准就不渲染成链接。 */
function safeHttpUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

interface TxTagsProps {
  transaction: TransactionWithRequiredFields;
  /** 该交易 type 的本地化标签，用来判断 category 是不是纯重复。 */
  typeLabel: string;
  /** 用于凭证链接的无障碍标签。 */
  domainName: string;
  t: (key: string) => string;
}

export default function TxTags({ transaction, typeLabel, domainName, t }: TxTagsProps) {
  const category = (transaction.category || '').trim();
  const platform = (transaction.platform || '').trim();
  const receiptUrl = safeHttpUrl(transaction.receipt_url);

  // category 跟 type 重复时不显示。useDomainOperations 给自动生成的续费 /
  // 转移交易写死 category: 'renewal' / 'transfer'，而那两笔的 type 本来就是
  // renew / transfer —— 同一个意思印两遍纯属噪音。新写入那边已经不再自动填，
  // 但历史数据里满是这种行，所以渲染时也挡一道。
  const categoryIsRedundant =
    category.toLowerCase() === transaction.type.toLowerCase() ||
    category.toLowerCase() === typeLabel.toLowerCase() ||
    // 'renewal' vs type 'renew'
    category.toLowerCase().replace(/al$/, '') === transaction.type.toLowerCase();

  const showCategory = category.length > 0 && !categoryIsRedundant;
  if (!showCategory && !platform && !receiptUrl) return null;

  const chip = 'inline-flex items-center gap-1 rounded-md bg-stone-100 px-1.5 py-0.5 text-stone-600';

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
      {showCategory && (
        <span className={chip} title={t('transaction.category')}>
          <TagIcon className="h-3 w-3 text-stone-400" aria-hidden />
          {category}
        </span>
      )}
      {platform && (
        <span className={chip} title={t('transactionList.platform')}>
          <Store className="h-3 w-3 text-stone-400" aria-hidden />
          {platform}
        </span>
      )}
      {receiptUrl && (
        // rel 两项都必要：noopener 断掉 window.opener（被链接页可以借它改写
        // 本页地址），noreferrer 不把本站 URL 漏给第三方收据托管方。
        <a
          href={receiptUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t('transactionList.viewReceiptAria').replace('{domain}', domainName)}
          className="inline-flex items-center gap-1 rounded-md bg-teal-50 px-1.5 py-0.5 text-teal-700 hover:bg-teal-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
        >
          <ReceiptIcon className="h-3 w-3" aria-hidden />
          {t('transactionList.viewReceipt')}
        </a>
      )}
    </div>
  );
}
