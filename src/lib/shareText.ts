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
  roi: number;
}

/**
 * Tweet text for a single-domain sale. The win/loss branch avoids
 * the "🎉 ... Net profit $-500" contradiction the old code produced.
 */
export function saleTweetText({ domainName, profit, roi }: SaleTweetInput): string {
  const lede = profit >= 0
    ? `🎉 Just sold ${domainName} on Domain Financial! Net profit $${profit.toLocaleString()}, ROI ${roi.toFixed(1)}%! 🚀`
    : `Closed out ${domainName} on Domain Financial. P&L $${profit.toLocaleString()}, ROI ${roi.toFixed(1)}%.`;
  return `${lede} #DomainInvestment #DomainFinancial ${domainHashtag(domainName)}`.trim();
}

/**
 * Tweet text for an already-sold domain being shared later (past-tense
 * lede instead of the celebratory "Just sold").
 */
export function investedTweetText({ domainName, profit, roi }: SaleTweetInput): string {
  const lede = profit >= 0
    ? `Successfully invested in ${domainName} on Domain Financial! Net profit $${profit.toLocaleString()}, ROI ${roi.toFixed(1)}%! 🚀`
    : `Closed out ${domainName} on Domain Financial. P&L $${profit.toLocaleString()}, ROI ${roi.toFixed(1)}%.`;
  return `${lede} #DomainInvestment #DomainFinancial ${domainHashtag(domainName)}`.trim();
}

export interface PortfolioTweetInput {
  profit: number;
  roi: number;
}

export function portfolioTweetText({ profit, roi }: PortfolioTweetInput): string {
  const lede = profit >= 0
    ? `My domain investment results on Domain Financial: Total profit $${profit.toLocaleString()}, ROI ${roi.toFixed(1)}%! 🚀`
    : `My domain portfolio update on Domain Financial: P&L $${profit.toLocaleString()}, ROI ${roi.toFixed(1)}%.`;
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
