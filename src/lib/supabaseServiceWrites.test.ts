import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';

/**
 * 这个文件锁的是写路径的一条不变量：**一次写 = 一次 DB 往返**。
 *
 * 背景：domains 的 PUT/DELETE 和 transactions 的 DELETE 原本都先 SELECT 一次
 * 确认"这行是不是你的"，再执行写。那次前置查询是多余的——写语句自带
 * `.eq('user_id')`，加上 RLS（FOR ALL USING auth.uid() = user_id），不是自己的
 * 行根本匹配不到；而且前置检查和写入之间还留着一个 TOCTOU 窗口。
 *
 * 去掉它之后，"不是你的 / 不存在"这个分支改由**回传行数**表达，所以下面
 * 两件事都要测：请求数是 1 不是 2，以及 0 行能和真正的错误区分开。
 */

type Captured = { url: string; method: string; headers: Headers; body?: string };

let captured: Captured[] = [];
let nextResponses: Array<{ status: number; body: string }> = [];

let DomainService: typeof import('./supabaseService').DomainService;
let TransactionService: typeof import('./supabaseService').TransactionService;
let makeClient: () => never;

beforeAll(async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test-project.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    captured.push({
      url: String(input),
      method: init?.method ?? 'GET',
      headers: new Headers(init?.headers),
      body: typeof init?.body === 'string' ? init.body : undefined,
    });
    const next = nextResponses.shift() ?? { status: 200, body: '[]' };
    return new Response(next.body, {
      status: next.status,
      headers: { 'Content-Type': 'application/json' },
    });
  });

  const { createClient } = await import('@supabase/supabase-js');
  ({ DomainService, TransactionService } = await import('./supabaseService'));
  makeClient = (() =>
    createClient('https://test-project.supabase.co', 'test-anon-key')) as unknown as () => never;
});

beforeEach(() => {
  captured = [];
  nextResponses = [];
});

const UUID = '11111111-2222-3333-4444-555555555555';
const USER = '99999999-8888-7777-6666-555555555555';

describe('DomainService.deleteDomainWithClient', () => {
  it('只发一个请求——没有前置的所有权 SELECT', async () => {
    nextResponses = [{ status: 200, body: JSON.stringify([{ id: UUID }]) }];
    const r = await DomainService.deleteDomainWithClient(makeClient(), UUID, USER);

    expect(r).toEqual({ deleted: 1, error: null });
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe('DELETE');
  });

  it('归属过滤写在同一条 DELETE 语句里', async () => {
    nextResponses = [{ status: 200, body: JSON.stringify([{ id: UUID }]) }];
    await DomainService.deleteDomainWithClient(makeClient(), UUID, USER);

    expect(captured[0].url).toContain(`id=eq.${UUID}`);
    expect(captured[0].url).toContain(`user_id=eq.${USER}`);
  });

  it('0 行 = 不存在或不是你的，不是错误', async () => {
    nextResponses = [{ status: 200, body: '[]' }];
    expect(await DomainService.deleteDomainWithClient(makeClient(), UUID, USER)).toEqual({
      deleted: 0,
      error: null,
    });
  });

  it('真正的 DB 错误带上 error，好让路由回 500 而不是 403', async () => {
    nextResponses = [
      { status: 500, body: JSON.stringify({ message: 'boom', code: 'XX000' }) },
    ];
    const r = await DomainService.deleteDomainWithClient(makeClient(), UUID, USER);
    expect(r.deleted).toBe(0);
    expect(r.error?.message).toBe('boom');
  });

  it('id 不是合法 uuid（22P02）按 0 行处理，不当故障', async () => {
    nextResponses = [
      { status: 400, body: JSON.stringify({ message: 'invalid input syntax', code: '22P02' }) },
    ];
    expect(await DomainService.deleteDomainWithClient(makeClient(), 'not-a-uuid', USER)).toEqual({
      deleted: 0,
      error: null,
    });
  });

  it('空 id 直接短路，一个请求都不发', async () => {
    expect(await DomainService.deleteDomainWithClient(makeClient(), '   ', USER)).toEqual({
      deleted: 0,
      error: null,
    });
    expect(captured).toHaveLength(0);
  });
});

describe('DomainService.updateDomainWithClient', () => {
  it('只发一个请求，并把更新后的行带回来', async () => {
    nextResponses = [
      { status: 200, body: JSON.stringify({ id: UUID, domain_name: 'example.com' }) },
    ];
    const r = await DomainService.updateDomainWithClient(
      makeClient(),
      UUID,
      { domain_name: 'example.com' },
      USER
    );

    expect(r.error).toBeNull();
    expect(r.data?.id).toBe(UUID);
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe('PATCH');
    expect(captured[0].url).toContain(`user_id=eq.${USER}`);
  });

  it('0 行返回 data:null 且 error:null——路由据此回 403', async () => {
    // return=representation 下 PostgREST 对"没匹配到行"回的是空数组
    nextResponses = [{ status: 200, body: '[]' }];
    expect(await DomainService.updateDomainWithClient(makeClient(), UUID, {}, USER)).toEqual({
      data: null,
      error: null,
    });
  });

  it('DB 错误照常上报', async () => {
    nextResponses = [
      { status: 500, body: JSON.stringify({ message: 'constraint violated', code: 'XX000' }) },
    ];
    const r = await DomainService.updateDomainWithClient(makeClient(), UUID, {}, USER);
    expect(r.data).toBeNull();
    expect(r.error?.message).toBe('constraint violated');
  });
});

describe('TransactionService.deleteTransactionWithClient', () => {
  it('同样是一次往返，0 行不当错误', async () => {
    nextResponses = [{ status: 200, body: '[]' }];
    expect(await TransactionService.deleteTransactionWithClient(makeClient(), UUID, USER)).toEqual({
      deleted: 0,
      error: null,
    });
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe('DELETE');
    expect(captured[0].url).toContain(`user_id=eq.${USER}`);
  });

  it('删掉一行时 deleted=1', async () => {
    nextResponses = [{ status: 200, body: JSON.stringify([{ id: UUID }]) }];
    expect(await TransactionService.deleteTransactionWithClient(makeClient(), UUID, USER)).toEqual({
      deleted: 1,
      error: null,
    });
  });
});

describe('回传行数依赖的那个 header', () => {
  // 整套"0 行 = 403"的分流，前提是 PostgREST 真的把受影响的行回传回来。
  // 这由 `.select()` 触发的 `Prefer: return=representation` 决定：谁要是把
  // `.select()` 摘了，PostgREST 会回 204 空 body，deleted 恒为 0，于是每次
  // 删除成功都会被路由报成 403。这条断言就是为了先炸在这儿。
  it('delete().select() 会带上 Prefer: return=representation', async () => {
    nextResponses = [{ status: 200, body: JSON.stringify([{ id: UUID }]) }];
    await DomainService.deleteDomainWithClient(makeClient(), UUID, USER);
    expect(captured[0].headers.get('prefer')).toContain('return=representation');
  });

  it('update().select() 同理', async () => {
    nextResponses = [{ status: 200, body: JSON.stringify({ id: UUID }) }];
    await DomainService.updateDomainWithClient(makeClient(), UUID, {}, USER);
    expect(captured[0].headers.get('prefer')).toContain('return=representation');
  });
});
