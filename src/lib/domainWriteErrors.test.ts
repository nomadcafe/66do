import { describe, it, expect } from 'vitest';
import { isDuplicateDomainNameError, DOMAIN_NAME_UNIQUE_INDEX } from './domainWriteErrors';

/** PostgREST 在唯一约束冲突时的报文形状 */
const uniqueViolation = (constraint: string) => ({
  code: '23505',
  message: `duplicate key value violates unique constraint "${constraint}"`,
});

describe('isDuplicateDomainNameError', () => {
  it('认得域名唯一索引的冲突', () => {
    expect(isDuplicateDomainNameError(uniqueViolation(DOMAIN_NAME_UNIQUE_INDEX))).toBe(true);
  });

  it('不把主键冲突当成重名', () => {
    // 客户端重发导致的 id 冲突 SQLSTATE 也是 23505，但那是 500 级故障，
    // 误判成 409 会让用户去改一个本来没问题的域名
    expect(isDuplicateDomainNameError(uniqueViolation('domains_pkey'))).toBe(false);
  });

  it('不把其他唯一约束当成重名', () => {
    expect(isDuplicateDomainNameError(uniqueViolation('domains_some_other_key'))).toBe(false);
  });

  it('非 23505 一律不算', () => {
    expect(
      isDuplicateDomainNameError({
        code: '23503',
        message: `insert violates foreign key constraint "${DOMAIN_NAME_UNIQUE_INDEX}"`,
      })
    ).toBe(false);
  });

  it('没有 code 时不算', () => {
    expect(isDuplicateDomainNameError({ message: DOMAIN_NAME_UNIQUE_INDEX })).toBe(false);
  });

  it('null / undefined 不算', () => {
    expect(isDuplicateDomainNameError(null)).toBe(false);
    expect(isDuplicateDomainNameError(undefined)).toBe(false);
  });

  it('message 缺失也不炸', () => {
    expect(isDuplicateDomainNameError({ code: '23505' } as { code: string; message: string })).toBe(false);
  });
});
