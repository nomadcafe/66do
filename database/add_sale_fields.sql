-- 添加出售相关字段到domains表
-- 适用于D1数据库

-- 添加出售日期字段
ALTER TABLE domains ADD COLUMN sale_date TEXT;

-- 添加出售价格字段  
ALTER TABLE domains ADD COLUMN sale_price REAL;

-- 添加注释
-- sale_date: 域名出售日期
-- sale_price: 域名出售价格
