// CSV 格式适配层。每个注册商/市场的 CSV 导出列名各不相同（GoDaddy 用
// "Domain Name" 和 "Expiration Date"，Namecheap 用 "Domain Name" 和 "Expires"，
// 我们自家导出用 snake_case）。这里把"识别 + 映射"压在 adapter 里，上层只
// 看到 MappedDomain。要新增一个注册商只需要加一个 format 文件，路由 / UI /
// 验证层不变。

import type { Domain } from '../supabaseService'

/** 把 CSV 行映射后产生的部分域名对象。id 由 onImport 阶段决定（按 name
 *  匹配现有则复用，否则生成）。status 默认 active —— CSV 来源都没法可靠区分
 *  在售/已售，让用户事后在 UI 改即可。
 *
 *  注意：DB Row 里 tags 是 string（JSON 序列化），但前端 DomainWithTags 用
 *  string[]。MappedDomain 走前端形态（数组），合并阶段不重新序列化。*/
export type MappedDomain = Partial<
  Omit<Domain, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'tags'>
> & {
  domain_name: string
  tags?: string[]
}

export interface CsvFormat {
  /** 稳定 id，用于 i18n / 调试 */
  id: 'godaddy' | 'namecheap' | 'dynadot' | 'spaceship' | 'namecom' | 'generic'
  /** UI 显示名 */
  displayName: string
  /** 识别签名：CSV 头里**必须**全部出现这些列（大小写/空格不敏感）才算命中。
   *  保持小数量、判别力强的列，避免过度泛化。*/
  requiredHeaders: string[]
  /** 加分签名：出现得越多置信度越高，用于在多个格式都通过 requiredHeaders
   *  时打破平局。*/
  bonusHeaders?: string[]
  /** 把一行 CSV（papaparse 已 trim 过 header / value）映射到我们的 schema。
   *  返回 null 表示这行该跳过（如表头重复、空行）。 */
  mapRow: (row: Record<string, string>) => MappedDomain | null
}

/** Header 比较辅助：忽略大小写 + 空格 + 标点。 */
export function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[\s_\-./]+/g, '')
}
