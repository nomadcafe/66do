# 数据库脚本说明

## 生产环境必用

- **schema.sql** / **supabase_schema.sql**：表结构及 RLS 策略的主定义，按实际部署目标选用。
- **fix_domains_rls.sql**、**fix_transactions_rls.sql**、**fix_rls_*.sql**、**simple_uuid_rls.sql** 等：用于修复或启用 RLS，按需在迁移中执行一次。

## 迁移脚本（按顺序执行）

- `add_transaction_installment_columns.sql`、`add_renewal_count.sql`、`add_sale_fields.sql`、`add_encryption_fields.sql`、`add_renewal_cost_history.sql` 等：增量迁移，按时间顺序执行。

## 仅调试 / 临时用（勿在生产长期使用）

- **disable_rls_temporarily.sql**、**temp_disable_rls.sql**：临时关闭 RLS，仅用于排查问题或一次性数据修复。**生产环境禁止长期禁用 RLS**，用后请用 `enable_rls_when_ready.sql` 或对应 fix 脚本重新启用。

## 其他

- **check_table_structure.sql**：仅查询表结构，不改数据。
- **d1_schema.sql**：D1 数据库用，若未使用 D1 可忽略。
