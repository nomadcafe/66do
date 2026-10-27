-- 给 public 下所有 SECURITY DEFINER 函数钉死 search_path。
--
-- 背景：
--   handle_new_user / handle_user_update 等用户同步触发器函数（见
--   complete_user_sync.sql / clean_sync.sql）是 SECURITY DEFINER，但没有
--   SET search_path。Supabase Advisor 会报 function_search_path_mutable：
--   以函数 owner 身份执行时，未限定 schema 的表名 / 函数名按调用方的
--   search_path 解析，理论上可被同名对象劫持。
--
--   这些函数只由 auth.users 上的触发器调用，实际可利用面很小，属于加固。
--
-- 为什么是 `public, pg_temp` 而不是 ''：
--   空 search_path 要求函数体里每个对象都写全 schema。历史函数体里有没有
--   不带 public. 的引用，仓库里的几份 SQL 版本不一致，没法保证；钉成 public
--   行为与现在完全一致，又把 pg_temp 排到最后，堵掉临时表劫持。
--
-- 执行顺序：
--   1. 先跑步骤 1 看会改哪些函数，确认名单符合预期。
--   2. 跑步骤 2。
--   3. 再跑一次步骤 1，应返回 0 行。

-- ============================================================
-- 步骤 1：列出尚未固定 search_path 的 SECURITY DEFINER 函数
-- ============================================================
SELECT p.oid::regprocedure AS fn
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.prosecdef
  AND NOT EXISTS (
    SELECT 1 FROM unnest(coalesce(p.proconfig, '{}')) c
    WHERE c LIKE 'search_path=%'
  );

-- ============================================================
-- 步骤 2：逐个钉死
-- ============================================================
DO $$
DECLARE
  fn regprocedure;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND NOT EXISTS (
        SELECT 1 FROM unnest(coalesce(p.proconfig, '{}')) c
        WHERE c LIKE 'search_path=%'
      )
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp', fn);
  END LOOP;
END $$;

INSERT INTO public.schema_migrations (filename, notes)
VALUES (
  'pin_security_definer_search_path.sql',
  'Pins search_path = public, pg_temp on every public SECURITY DEFINER function.'
)
ON CONFLICT (filename) DO NOTHING;
