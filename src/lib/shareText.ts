/**
 * `#example.co.uk` is not a valid hashtag. `replace('.','')` only strips
 * the first dot, so multi-dot TLDs produced things like `#examplecouk`.
 * Take just the SLD instead.
 */
export function domainHashtag(name: string): string {
  const sld = name.split('.')[0] || name.replace(/\./g, '');
  return sld ? `#${sld}` : '';
}

export interface SaleTweetInput {
  domainName: string;
  profit: number;
  /** null = 成本基准为 0，比值没有定义。整句 ROI 会被省掉，而不是写成 0%。 */
  roi: number | null;
}

/**
 * 带符号的金额。以前是模板里直接 `$${profit.toLocaleString()}`，负数就成了
 * `$-500` —— 符号跑到货币符号右边。上面那句注释说 win/loss 分支解决了
 * 「🎉 … Net profit $-500」的矛盾，其实只解决了 🎉，`$-500` 一直还在。
 */
function money(n: number): string {
  return `${n < 0 ? '-' : ''}$${Math.abs(n).toLocaleString()}`;
}

/** ROI 子句。null 时返回空串，让整句只说利润。 */
function roiClause(roi: number | null): string {
  return roi === null ? '' : `, ROI ${roi.toFixed(1)}%`;
}

/**
 * Tweet text for a single-domain sale. The win/loss branch avoids the
 * celebratory "🎉 … Net profit -$500" contradiction; `money()` keeps the
 * sign to the left of the `$` (it used to render as `$-500`).
 */
export function saleTweetText({ domainName, profit, roi }: SaleTweetInput): string {
  const lede = profit >= 0
    ? `🎉 Just sold ${domainName} on Domain Financial! Net profit ${money(profit)}${roiClause(roi)}! 🚀`
    : `Closed out ${domainName} on Domain Financial. P&L ${money(profit)}${roiClause(roi)}.`;
  return `${lede} #DomainInvestment #DomainFinancial ${domainHashtag(domainName)}`.trim();
}

/**
 * Tweet text for an already-sold domain being shared later (past-tense
 * lede instead of the celebratory "Just sold").
 */
export function investedTweetText({ domainName, profit, roi }: SaleTweetInput): string {
  const lede = profit >= 0
    ? `Successfully invested in ${domainName} on Domain Financial! Net profit ${money(profit)}${roiClause(roi)}! 🚀`
    : `Closed out ${domainName} on Domain Financial. P&L ${money(profit)}${roiClause(roi)}.`;
  return `${lede} #DomainInvestment #DomainFinancial ${domainHashtag(domainName)}`.trim();
}

export interface PortfolioTweetInput {
  profit: number;
  roi: number;
}

export function portfolioTweetText({ profit, roi }: PortfolioTweetInput): string {
  const lede = profit >= 0
    ? `My domain investment results on Domain Financial: Total profit ${money(profit)}${roiClause(roi)}! 🚀`
    : `My domain portfolio update on Domain Financial: P&L ${money(profit)}${roiClause(roi)}.`;
  return `${lede} #DomainInvestment #DomainFinancial`;
}

/**
 * Opens Twitter's web intent in a small popup. noopener/noreferrer so
 * the opened page cannot navigate window.opener.
 */
export function shareToX(text: string): void {
  const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank', 'width=600,height=400,noopener,noreferrer');
}
