import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';

/**
 * 这个文件锁的是一条不变量：API 路由的 Supabase 客户端靠显式的
 * `Authorization: Bearer <用户 JWT>` header 让 RLS 认出 auth.uid()，
 * 不依赖 SDK 内部的 session。
 *
 * 之所以值得单独测：这里曾经有一句 `await client.auth.setSession(...)`，
 * 每个写请求因此多打一次 GoTrue 往返。删掉它是安全的——但"安全"依赖于
 * supabase-js 内部 fetchWithAuth 只在 `!headers.has("Authorization")` 时
 * 才塞自己的 token。如果哪天 SDK 改了这个优先级，或者有人为了"保险"把
 * setSession 加回来，下面这条断言会先炸。
 */

type Captured = { url: string; headers: Headers };

let captured: Captured[] = [];

let createAuthenticatedSupabaseClient: typeof import('./supabaseAuthClient').createAuthenticatedSupabaseClient;

beforeAll(async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test-project.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    captured.push({
      url: String(input),
      headers: new Headers(init?.headers),
    });
    return new Response('[]', {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });

  ({ createAuthenticatedSupabaseClient } = await import('./supabaseAuthClient'));
});

afterEach(() => {
  captured = [];
});

describe('createAuthenticatedSupabaseClient', () => {
  it('查询带上用户 JWT，而不是 anon key —— RLS 全靠这个', async () => {
    const client = await createAuthenticatedSupabaseClient('user-jwt-token');

    await client.from('domains').select('id');

    const rest = captured.find((c) => c.url.includes('/rest/v1/'));
    expect(rest, 'expected a PostgREST request').toBeDefined();
    expect(rest!.headers.get('authorization')).toBe('Bearer user-jwt-token');
    expect(rest!.headers.get('authorization')).not.toContain('test-anon-key');
  });

  it('不为了建客户端去打 auth 接口（setSession 曾经在这里多花一次往返）', async () => {
    await createAuthenticatedSupabaseClient('user-jwt-token');

    expect(captured.filter((c) => c.url.includes('/auth/v1/'))).toHaveLength(0);
  });

  it('一次查询只产生一个请求，没有隐藏的 auth 往返', async () => {
    const client = await createAuthenticatedSupabaseClient('user-jwt-token');
    captured = [];

    await client.from('domains').select('id');

    expect(captured).toHaveLength(1);
  });

  it('没有 access token 时退回 anon key（未认证请求照样能发，交给 RLS 拒）', async () => {
    const client = await createAuthenticatedSupabaseClient();

    await client.from('domains').select('id');

    const rest = captured.find((c) => c.url.includes('/rest/v1/'));
    expect(rest!.headers.get('authorization')).toBe('Bearer test-anon-key');
  });
});
