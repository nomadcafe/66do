-- 添加续费成本历史追踪表
-- 用于记录每次续费的实际成本变化

-- 创建续费成本历史表
CREATE TABLE IF NOT EXISTS renewal_cost_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  domain_id UUID NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
  renewal_date DATE NOT NULL,
  renewal_cost DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  exchange_rate DECIMAL(10,4) DEFAULT 1.0,
  base_amount DECIMAL(10,2),
  renewal_cycle INTEGER NOT NULL,
  registrar TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_renewal_cost_history_domain_id ON renewal_cost_history(domain_id);
CREATE INDEX IF NOT EXISTS idx_renewal_cost_history_date ON renewal_cost_history(renewal_date);
CREATE INDEX IF NOT EXISTS idx_renewal_cost_history_domain_date ON renewal_cost_history(domain_id, renewal_date);

-- 添加触发器，当域名续费时自动记录成本历史
CREATE OR REPLACE FUNCTION record_renewal_cost_history()
RETURNS TRIGGER AS $$
BEGIN
  -- 当交易类型为'renew'时，记录到续费成本历史表
  IF NEW.type = 'renew' THEN
    INSERT INTO renewal_cost_history (
      domain_id,
      renewal_date,
      renewal_cost,
      currency,
      exchange_rate,
      base_amount,
      renewal_cycle,
      registrar,
      notes
    ) VALUES (
      NEW.domain_id,
      NEW.date::DATE,
      NEW.amount,
      NEW.currency,
      NEW.exchange_rate,
      NEW.base_amount,
      (SELECT renewal_cycle FROM domains WHERE id = NEW.domain_id),
      NEW.category,
      NEW.notes
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 创建触发器
DROP TRIGGER IF EXISTS trigger_record_renewal_cost_history ON domain_transactions;
CREATE TRIGGER trigger_record_renewal_cost_history
  AFTER INSERT ON domain_transactions
  FOR EACH ROW
  EXECUTE FUNCTION record_renewal_cost_history();

-- 为现有续费交易创建历史记录（可选）
INSERT INTO renewal_cost_history (
  domain_id,
  renewal_date,
  renewal_cost,
  currency,
  exchange_rate,
  base_amount,
  renewal_cycle,
  registrar,
  notes
)
SELECT 
  dt.domain_id,
  dt.date::DATE,
  dt.amount,
  dt.currency,
  dt.exchange_rate,
  dt.base_amount,
  d.renewal_cycle,
  dt.category,
  dt.notes
FROM domain_transactions dt
JOIN domains d ON dt.domain_id = d.id
WHERE dt.type = 'renew'
AND NOT EXISTS (
  SELECT 1 FROM renewal_cost_history rch 
  WHERE rch.domain_id = dt.domain_id 
  AND rch.renewal_date = dt.date::DATE
);
