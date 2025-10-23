-- 添加renewal_count字段到domains表
-- 用于追踪域名已续费次数

-- 添加renewal_count列
ALTER TABLE domains ADD COLUMN renewal_count INTEGER DEFAULT 0;

-- 更新现有记录，根据交易记录计算续费次数
-- 注意：这是一个简化的计算，实际应用中可能需要更复杂的逻辑
UPDATE domains 
SET renewal_count = (
  SELECT COUNT(*) 
  FROM domain_transactions 
  WHERE domain_transactions.domain_id = domains.id 
  AND domain_transactions.type = 'renew'
);

-- 验证更新结果
SELECT 
  domain_name, 
  renewal_count, 
  renewal_cost,
  (renewal_count * renewal_cost) as total_renewal_paid,
  purchase_cost,
  (purchase_cost + (renewal_count * renewal_cost)) as total_holding_cost
FROM domains 
WHERE renewal_count > 0;
