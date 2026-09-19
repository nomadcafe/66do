/**
 * sanitize* 不能替调用方把 key 补齐。
 *
 * buildDomain/TransactionUpdatePayload 按 `'x' in obj` 决定某字段进不进
 * UPDATE，注释写着"未传字段不动数据库现有值"。但 sanitizer 以前无条件把每个
 * 派生字段都写进产物，那套判断于是永远为真——每一次 PUT 都变成全量覆盖，
 * 请求里没带的字段被写成 null / 0 / ''。
 *
 * 应用自己的表单每次提交完整对象，所以第一方客户端碰不到；但这是个 REST 写
 * 接口，拿自己的 token 写脚本做局部更新的人会中招，而且是静默的数据损坏。
 */
import { describe, it, expect } from 'vitest';
import { sanitizeDomainData, sanitizeTransactionData } from './validation';
import { buildDomainUpdatePayload } from './domainPayloads';
import { buildTransactionUpdatePayload } from './transactionInsertPayload';

describe('域名的部分更新', () => {
  it('只改名字时，其余字段不进 UPDATE', () => {
    const payload = buildDomainUpdatePayload(sanitizeDomainData({ domain_name: 'renamed.com' }));
    expect(payload).toEqual({ domain_name: 'renamed.com' });
    // 旧行为：registrar / purchase_cost / expiry_date … 全被写成 null，
    // renewal_cycle 回到 1，tags 清空
    expect('registrar' in payload).toBe(false);
    expect('purchase_cost' in payload).toBe(false);
    expect('expiry_date' in payload).toBe(false);
    expect('renewal_cycle' in payload).toBe(false);
    expect('tags' in payload).toBe(false);
  });

  it('显式传 null 仍然是"清空"，不被当成没传', () => {
    const payload = buildDomainUpdatePayload(sanitizeDomainData({ registrar: null }));
    expect('registrar' in payload).toBe(true);
    expect(payload.registrar).toBeNull();
  });

  it('全量提交照旧（应用自己的表单走这条路）', () => {
    const payload = buildDomainUpdatePayload(
      sanitizeDomainData({
        domain_name: 'X.COM', registrar: ' NC ', purchase_cost: 100,
        renewal_cost: 12, renewal_cycle: 1, renewal_count: 2,
        expiry_date: '2027-01-01', estimated_value: 5000, tags: ['a'],
      })
    );
    expect(payload.domain_name).toBe('x.com');   // 归一化仍然生效
    expect(payload.registrar).toBe('NC');        // trim 仍然生效
    expect(payload.purchase_cost).toBe(100);
    expect(payload.estimated_value).toBe(5000);
    expect(payload.tags).toEqual(['a']);
  });

  it('超限值仍然被夹住', () => {
    const p = buildDomainUpdatePayload(sanitizeDomainData({ purchase_cost: 99_999_999_999 }));
    expect(p.purchase_cost).toBe(10_000_000);
  });
});

describe('交易的部分更新', () => {
  it('只改备注时，金额不会被写成 0', () => {
    const payload = buildTransactionUpdatePayload(sanitizeTransactionData({ notes: '改个备注' }));
    expect(payload).toEqual({ notes: '改个备注' });
    // 旧行为：amount 走 Number(undefined) || 0 → 这笔交易金额直接变成 0
    expect('amount' in payload).toBe(false);
    expect('platform_fee' in payload).toBe(false);
    expect('net_amount' in payload).toBe(false);
    expect('receipt_url' in payload).toBe(false);
  });

  it('全量提交照旧，且清洗仍然生效', () => {
    const payload = buildTransactionUpdatePayload(
      sanitizeTransactionData({
        amount: 1000, platform_fee: 100, net_amount: 900,
        notes: '  hi  ', category: ' Investment ',
        receipt_url: 'javascript:alert(1)',
      })
    );
    expect(payload.amount).toBe(1000);
    expect(payload.platform_fee).toBe(100);
    expect(payload.notes).toBe('hi');
    expect(payload.category).toBe('Investment');
    // 危险协议照样被挡掉（传了 key，值被清成 null）
    expect('receipt_url' in payload).toBe(true);
    expect(payload.receipt_url).toBeNull();
  });

  it('金额上限仍然被夹住', () => {
    const p = buildTransactionUpdatePayload(sanitizeTransactionData({ amount: 999_999_999_999 }));
    expect(p.amount).toBe(100_000_000);
  });
});

describe('sanitizer 不是安全边界，白名单才是', () => {
  it('额外字段能穿过 sanitizer，但进不了 payload', () => {
    const sanitized = sanitizeDomainData({
      domain_name: 'x.com', user_id: 'someone-else', created_at: '1999-01-01',
    });
    // sanitizer 会原样带过去 —— 它的职责是清洗已知字段，不是过滤未知字段
    expect('user_id' in sanitized).toBe(true);
    // 真正拦住的是 build*Payload 的白名单
    const payload = buildDomainUpdatePayload(sanitized);
    expect('user_id' in payload).toBe(false);
    expect('created_at' in payload).toBe(false);
  });
});
