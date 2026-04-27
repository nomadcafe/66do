-- 在跑 drop_renewal_cost_history.sql 之前的预检清单。
-- 全部是只读查询，可以放心一个一个跑。
-- 一切符合预期再执行 drop。

-- ============================================================
-- Check 1: 表是否存在 + 行数
-- 期望：表存在；行数 = 你所有用户的 renew 交易总数（大致）
-- ============================================================
SELECT
  (SELECT count(*) FROM information_schema.tables
   WHERE table_schema = 'public' AND table_name = 'renewal_cost_history') AS table_exists,
  (SELECT count(*) FROM public.renewal_cost_history) AS row_count;


-- ============================================================
-- Check 2: trigger 是否还挂着
-- 期望：返回 1 行，trigger 名为 trigger_record_renewal_cost_history
-- ============================================================
SELECT
  trigger_name,
  event_manipulation,
  event_object_table,
  action_timing
FROM information_schema.triggers
WHERE event_object_table = 'domain_transactions'
  AND trigger_name LIKE '%renewal_cost_history%';


-- ============================================================
-- Check 3: 1:1 冗余验证 —— 表里的行能不能完全对应到 renew 交易
-- 期望：history_only_count = 0（即 renewal_cost_history 里没有
--       「找不到对应 renew 交易」的孤儿行）
--
-- 如果非 0，说明表里有些行是 trigger 之外的来源（旧手动插入、
-- 跨用户批量导入等），不能 100% 认为"丢弃零信息"。
-- ============================================================
SELECT count(*) AS history_only_count
FROM public.renewal_cost_history rch
WHERE NOT EXISTS (
  SELECT 1 FROM public.domain_transactions dt
  WHERE dt.domain_id = rch.domain_id
    AND dt.type = 'renew'
    AND dt.date::DATE = rch.renewal_date
    AND dt.amount = rch.renewal_cost
);


-- ============================================================
-- Check 4: 反向 1:1 —— 是否所有 renew 交易都在 history 里
-- 期望：renew_only_count = 0（即没有"创建了 renew 交易但 history
--       里漏了"的情况，证明 trigger 确实一直在工作）
--
-- 如果非 0：trigger 可能曾经短暂失效或交易直接绕过 trigger 写入
-- （不影响 drop 的安全性，因为我们要丢的是 history 那边）
-- ============================================================
SELECT count(*) AS renew_only_count
FROM public.domain_transactions dt
WHERE dt.type = 'renew'
  AND NOT EXISTS (
    SELECT 1 FROM public.renewal_cost_history rch
    WHERE rch.domain_id = dt.domain_id
      AND rch.renewal_date = dt.date::DATE
      AND rch.renewal_cost = dt.amount
  );


-- ============================================================
-- Check 5: 是否有其他外键 / 视图 / 触发器依赖这张表
-- 期望：以下三个查询都返回 0 行
-- ============================================================
-- 5a. 是否有其他表外键引用 renewal_cost_history（会阻止 DROP TABLE）
SELECT
  tc.table_name AS dependent_table,
  kcu.column_name AS dependent_column,
  ccu.table_name AS referenced_table
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND ccu.table_name = 'renewal_cost_history';

-- 5b. 是否有视图引用这张表
SELECT table_schema, table_name
FROM information_schema.views
WHERE view_definition ILIKE '%renewal_cost_history%';

-- 5c. 是否还有其他触发器 / 函数引用这张表
SELECT
  routine_schema,
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_definition ILIKE '%renewal_cost_history%'
  AND routine_name <> 'record_renewal_cost_history';
