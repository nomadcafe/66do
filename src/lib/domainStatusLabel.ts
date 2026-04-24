/** 域名状态字到 i18n 标签的映射，避免在多处重复 `domain.status.replace('_', ' ')`
 *  这种未本地化的展示。fall through 时返回原 status 字符串当兜底。 */
export function domainStatusLabel(
  status: string,
  t: (key: string) => string
): string {
  switch (status) {
    case 'active':
      return t('common.active');
    case 'for_sale':
      return t('common.forSale');
    case 'sold':
      return t('common.sold');
    case 'expired':
      return t('common.expired');
    default:
      return status;
  }
}
