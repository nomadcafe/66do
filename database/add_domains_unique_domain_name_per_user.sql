-- 每个用户下域名唯一（大小写不敏感）。
--
-- 为什么需要：
--   去重此前完全靠 app 层在 POST /api/domains 里「拉全表 → 内存比对」，
--   有三个洞：
--     1. TOCTOU —— 两个并发请求会同时通过检查，双双插入。
--     2. 批量分支根本不查（注释写着"客户端已经去过重了"），也就是把
--        服务端不变量交给客户端去守。
--     3. 那次全表查询受 PostgREST 1000 行上限影响，域名超过 1000 个之后
--        新域名永远查不到重复。（分页已在
--        add_domains_unique_domain_name_per_user 之前的提交里修掉，但前两
--        个洞只能靠数据库约束堵。）
--   唯一索引把不变量放回数据库，插入冲突时 Postgres 报 23505，路由层捕获
--   后返回 409。
--
-- 大小写：
--   写入路径的 sanitizeDomainData 已经把 domain_name 转小写，但更早的数据
--   可能是混合大小写，所以索引建在 lower(domain_name) 上，而不是列本身。
--
-- ⚠️ 跑之前先查有没有已存在的重复，否则建索引会直接失败：
--
--     SELECT user_id, lower(domain_name) AS name, count(*), array_agg(id) AS ids
--     FROM public.domains
--     GROUP BY user_id, lower(domain_name)
--     HAVING count(*) > 1
--     ORDER BY count(*) DESC;
--
--   如果有结果，先决定每组保留哪一行（通常是 created_at 最早、或
--   transactions 关联最多的那条），把其余的关联交易改挂到保留行上再删除。
--   不要盲目 DELETE —— domain_transactions.domain_id 指向的是被删的那行。
--   查每组各行挂了多少交易：
--
--     SELECT d.id, d.domain_name, d.created_at, count(t.id) AS tx_count
--     FROM public.domains d
--     LEFT JOIN public.domain_transactions t ON t.domain_id = d.id
--     WHERE (d.user_id, lower(d.domain_name)) IN (
--       SELECT user_id, lower(domain_name) FROM public.domains
--       GROUP BY user_id, lower(domain_name) HAVING count(*) > 1
--     )
--     GROUP BY d.id, d.domain_name, d.created_at
--     ORDER BY d.user_id, lower(d.domain_name), d.created_at;
--
-- 影响：
--   - 建索引会短暂持有 domains 的写锁。表规模在个人组合级别（几千行以内），
--     锁时间可忽略；真要零停机就改用 CREATE UNIQUE INDEX CONCURRENTLY，但
--     那条语句不能在事务块里跑，Supabase SQL editor 里需要单独执行。
--   - 已售出（status='sold'）的域名行仍然占用名字，重新添加同名域名会被拒。
--     这与改动前 app 层的行为一致（那边也不区分 status），不是新增限制。

CREATE UNIQUE INDEX IF NOT EXISTS domains_user_id_lower_domain_name_key
  ON public.domains (user_id, lower(domain_name));

COMMENT ON INDEX public.domains_user_id_lower_domain_name_key IS
  'One domain name per user, case-insensitive. App layer maps the resulting 23505 to HTTP 409. Do not drop without restoring an equivalent server-side uniqueness guarantee -- the app-level check it replaced was TOCTOU-prone and skipped entirely on the bulk-create path.';

INSERT INTO public.schema_migrations (filename, notes)
VALUES (
  'add_domains_unique_domain_name_per_user.sql',
  'Unique index on (user_id, lower(domain_name)); replaces the app-level dedup check in POST /api/domains.'
)
ON CONFLICT (filename) DO NOTHING;
