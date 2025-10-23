-- 66Do Database Migration Script
-- 添加缺失的字段到现有表

-- 添加 expiry_date 字段到 domains 表
ALTER TABLE domains ADD COLUMN expiry_date TEXT;

-- 添加 renewal_cycle 字段到 domains 表  
ALTER TABLE domains ADD COLUMN renewal_cycle INTEGER DEFAULT 1;

-- 更新现有记录的 expiry_date（基于 next_renewal_date）
UPDATE domains 
SET expiry_date = next_renewal_date 
WHERE expiry_date IS NULL AND next_renewal_date IS NOT NULL;

-- 为没有 expiry_date 的记录设置默认值（1年后）
UPDATE domains 
SET expiry_date = date('now', '+1 year') 
WHERE expiry_date IS NULL;
