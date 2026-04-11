/**
 * 站点规范域名（sitemap、robots、metadataBase、OG 绝对地址）。
 * 生产环境请设置 NEXT_PUBLIC_SITE_URL，例如 https://www.domain.financial
 * 或 https://domain.financial（与托管/301 主域名一致即可）。
 */
export function getSiteUrl(): URL {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (raw) {
    try {
      return new URL(raw);
    } catch {
      /* fall through */
    }
  }
  return new URL('https://www.domain.financial');
}
