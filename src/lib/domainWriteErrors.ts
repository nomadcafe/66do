/** 写入失败信息。code 是 Postgres SQLSTATE（如唯一约束冲突的 23505），路由层据此选 HTTP 状态码 */
export interface WriteError {
  message: string;
  code?: string;
}

/** domains 上「每用户域名唯一」的索引名，见 database/add_domains_unique_domain_name_per_user.sql */
export const DOMAIN_NAME_UNIQUE_INDEX = 'domains_user_id_lower_domain_name_key';

/**
 * 区分「域名重名」和其他唯一约束冲突（比如客户端重发导致的主键冲突）——
 * 两者 SQLSTATE 都是 23505，只能靠约束名分辨。判错了会把一个 500 级别的
 * 写入故障伪装成 409「域名已存在」，用户会去改一个本来没问题的名字。
 */
export function isDuplicateDomainNameError(error: WriteError | null | undefined): boolean {
  return error?.code === '23505' && (error.message || '').includes(DOMAIN_NAME_UNIQUE_INDEX);
}
