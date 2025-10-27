-- 添加加密字段到现有表
-- 这个脚本需要在Supabase SQL编辑器中运行

-- 为domains表添加加密字段
ALTER TABLE domains ADD COLUMN IF NOT EXISTS domain_name_encrypted TEXT;
ALTER TABLE domains ADD COLUMN IF NOT EXISTS registrar_encrypted TEXT;
ALTER TABLE domains ADD COLUMN IF NOT EXISTS purchase_date_encrypted TEXT;
ALTER TABLE domains ADD COLUMN IF NOT EXISTS expiry_date_encrypted TEXT;
ALTER TABLE domains ADD COLUMN IF NOT EXISTS sale_date_encrypted TEXT;
ALTER TABLE domains ADD COLUMN IF NOT EXISTS notes_encrypted TEXT;

-- 为domain_transactions表添加加密字段
ALTER TABLE domain_transactions ADD COLUMN IF NOT EXISTS notes_encrypted TEXT;
ALTER TABLE domain_transactions ADD COLUMN IF NOT EXISTS receipt_url_encrypted TEXT;
ALTER TABLE domain_transactions ADD COLUMN IF NOT EXISTS category_encrypted TEXT;

-- 为users表添加加密密钥字段（用于存储用户特定的加密密钥）
ALTER TABLE users ADD COLUMN IF NOT EXISTS encryption_key TEXT;

-- 创建索引以提高加密字段的查询性能
CREATE INDEX IF NOT EXISTS idx_domains_domain_name_encrypted ON domains(domain_name_encrypted);
CREATE INDEX IF NOT EXISTS idx_domains_registrar_encrypted ON domains(registrar_encrypted);
CREATE INDEX IF NOT EXISTS idx_transactions_notes_encrypted ON domain_transactions(notes_encrypted);

-- 添加注释说明加密字段的用途
COMMENT ON COLUMN domains.domain_name_encrypted IS 'Encrypted domain name for enhanced security';
COMMENT ON COLUMN domains.registrar_encrypted IS 'Encrypted registrar information';
COMMENT ON COLUMN domains.purchase_date_encrypted IS 'Encrypted purchase date';
COMMENT ON COLUMN domains.expiry_date_encrypted IS 'Encrypted expiry date';
COMMENT ON COLUMN domains.sale_date_encrypted IS 'Encrypted sale date';
COMMENT ON COLUMN domains.notes_encrypted IS 'Encrypted notes field';
COMMENT ON COLUMN domain_transactions.notes_encrypted IS 'Encrypted transaction notes';
COMMENT ON COLUMN domain_transactions.receipt_url_encrypted IS 'Encrypted receipt URL';
COMMENT ON COLUMN domain_transactions.category_encrypted IS 'Encrypted transaction category';
COMMENT ON COLUMN users.encryption_key IS 'User-specific encryption key for data protection';
