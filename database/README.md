# `database/` — 历史 SQL 归档

> **⚠️ 本目录不是可执行的 migration 系统。**
> 这里的文件是历年在 Supabase SQL editor 里手跑过的快照，很多已经过时甚至互相冲突。未经审阅**不要**再次执行任何文件。新的 schema 变更请走 Supabase CLI 或其他真正的 migration 工具。

---

## 当前生产 RLS 真相（2026-04-22 审计）

以下是当下 Supabase 生产数据库的实际策略，以 `pg_policies` 为准：

| 表 | 策略 |
|---|---|
| `domains` | `Users can access own domains` — `FOR ALL USING (auth.uid() = user_id)` |
| `domain_transactions` | `Users can access own transactions` — `FOR ALL USING (auth.uid() = user_id)` |
| `renewal_cost_history` | 4 条 per-op policy，通过 `domains.user_id` 跨表检查所有权 |
| `users` | 仅 `users_select_self` — `FOR SELECT USING (auth.uid() = id)`；写入走 SECURITY DEFINER 触发器 |
| `verification_tokens` | RLS 开启、零 policy → 仅 `service_role` 可访问 |
| `password_reset_tokens` | **已 drop**（密码重置走 Supabase Auth 原生） |

### 对应当前 policy 的权威 SQL 文件

这几个文件的内容与生产一致，可作为参考或灾难恢复脚本：

- `simple_uuid_rls.sql` — `domains` / `domain_transactions` 的当前 policy
- `fix_renewal_cost_history_rls.sql` — `renewal_cost_history` 的 4 条 policy（2026-04-22 应用）
- `fix_users_verification_tokens_password_reset_rls.sql` — `users` 收紧、`verification_tokens` 清空、`password_reset_tokens` drop（2026-04-22 应用）
- `create_user_id_rls.sql` — `domains` / `domain_transactions` 的等效 baseline（策略名不同）

---

## 其他文件分类

### 表结构基线
- `users_table.sql` — users 表定义
- `migration.sql` — 旧版通用迁移

### 增量列/表
- `add_transaction_installment_columns.sql`
- `add_renewal_count.sql`
- `add_sale_fields.sql`
- `add_encryption_fields.sql`
- `add_renewal_cost_history.sql`
- `add_baseline_renewal_and_renewal_period_years.sql`
- `extend_domain_transactions_type_check.sql`

### 用户同步 / 修复（历史）
- `complete_user_sync.sql`, `fix_user_sync.sql`, `clean_sync.sql`
- `fix_email_conflict.sql`, `simplify_user_schema.sql`

> ⚠️ 这些文件里的 `CREATE POLICY` 块已被后续 `simple_uuid_rls.sql` +
> `fix_users_verification_tokens_password_reset_rls.sql` 覆盖。如需复用用户同步
> 触发器逻辑，请跳过其中的 RLS 部分。

### 工具
- `check_table_structure.sql` — 只读查询
- `enable_rls_when_ready.sql`, `quick_enable_rls.sql` — 仅 `ENABLE RLS`，无策略变更

---

## 已删除文件（2026-04-22 安全清理）

以下文件在 commit 中被删除，因为它们在当前 schema 下执行会造成数据泄漏或削弱 RLS：

- `fix_domains_rls.sql` — 为 `domains` 创建 `USING (true)` 开放策略
- `fix_transactions_rls.sql` — 为 `domain_transactions` 创建 `USING (true)` 开放策略
- `fix_rls_final.sql` — `USING (auth.uid() IS NOT NULL)`，任意登录用户可见全表
- `fix_rls_security.sql` — 引用不存在的列 `owner_user_id`
- `urgent_rls_fix.sql`, `temp_disable_rls.sql`, `disable_rls_temporarily.sql`, `simple_rls_fix.sql` — `DISABLE ROW LEVEL SECURITY`
- `fixed_rls_script.sql` — 若 `user_id` 列缺失会回退到 `USING (true)`
- `scripts/setup-password-reset-table.js` — 用 service role 重建已 drop 的 `password_reset_tokens` 表，并附 `USING (true)` 策略

## 第二批清理（RLS 核查）

- `fix_users_rls.sql` — 为 `public.users` 创建 `USING (true) WITH CHECK (true)` 的 anon 策略，正是 2026-04-22 第一轮清理要修的洞
- `fix_verification_tokens.sql` — DROP + 重建 `verification_tokens` 并附 `FOR ALL USING (true)` 全开放策略
- `schema.sql` — 引用不存在的列 `owner_user_id` 和不存在的表 `domain_alerts`/`domain_settings`，`DROP TABLE IF EXISTS` 前导句可能先跑成功，有丢表风险
- `supabase_schema.sql` — 重新给 `verification_tokens` 加 `FOR ALL USING (auth.uid()::text = user_id::text)`，与当前"零策略 + service_role 专属"的模型冲突

需要追溯历史请查 git log。
