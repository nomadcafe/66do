# X Finance - 智能投资管理平台

一个专业的投资管理工具，帮助投资者追踪投资组合、管理成本和收益。

## 🚀 功能特性

### 核心功能
- **投资组合管理** - 添加、编辑、删除投资标的
- **成本追踪** - 购买成本、持有成本、总投入
- **收益分析** - 销售收入、ROI计算、利润分析
- **交易记录** - 详细的买卖交易历史
- **提醒系统** - 到期提醒、价格预警
- **数据分析** - 投资组合统计和趋势分析

### 高级功能
- **分期付款支持** - 支持分期付款交易记录
- **手续费计算** - 自动计算交易手续费
- **多货币支持** - 支持多种货币
- **数据加密** - 本地数据加密存储
- **数据导入/导出** - CSV格式支持

## 🛠 技术栈

### 前端
- **Next.js 14** - React 框架
- **TypeScript** - 类型安全
- **Tailwind CSS** - 样式框架
- **Lucide React** - 图标库

### 后端
- **Supabase** - 数据库和认证
- **PostgreSQL** - 数据库
- **Row Level Security** - 数据安全

## 📦 安装和运行

### 方法一：Docker 部署（推荐）

#### 1. 克隆项目
```bash
git clone https://github.com/handlegpt/xfinance.git
cd xfinance
```

#### 2. 配置环境变量
```bash
cp .env.example .env.local
# 编辑 .env.local 文件，填入你的配置
```

#### 3. 使用 Docker Compose 启动
```bash
# 开发环境
docker-compose -f docker-compose.dev.yml up -d

# 生产环境
docker-compose up -d
```

#### 4. 访问应用
- **应用**: [http://localhost:3078](http://localhost:3078)
- **开发服务器**: [http://localhost:3078](http://localhost:3078)
- **数据库管理**: [http://localhost:8080](http://localhost:8080) (pgAdmin)

### 方法二：本地开发

#### 1. 克隆项目
```bash
git clone https://github.com/handlegpt/xfinance.git
cd xfinance
```

#### 2. 安装依赖
```bash
npm install
```

#### 3. 配置环境变量
```bash
cp .env.example .env.local
# 编辑 .env.local 文件，填入你的配置
```

#### 4. 设置数据库
在 Supabase SQL 编辑器中执行 `database/schema.sql` 文件

#### 5. 启动开发服务器
```bash
npm run dev
```

访问 [http://localhost:3078](http://localhost:3078) 查看应用。

## 🐳 Docker 配置说明

### 环境变量
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase 项目 URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase 匿名密钥

### 获取 Supabase 配置
1. 访问 [Supabase Dashboard](https://app.supabase.com)
2. 创建新项目或选择现有项目
3. 在 Settings > API 中找到：
   - Project URL
   - anon/public key
4. 将这些值填入 `.env.local` 文件

### Docker 服务
- **xfinance**: 主应用服务
- **postgres**: PostgreSQL 数据库
- **redis**: Redis 缓存
- **nginx**: 反向代理
- **pgadmin**: 数据库管理界面

## 🗄 数据库表结构

### 核心表
- **domains** - 域名主表
- **domain_transactions** - 交易记录表
- **domain_alerts** - 提醒设置表
- **domain_settings** - 用户设置表

### 安全策略
所有表都启用了行级安全（RLS），确保用户只能访问自己的数据。

## 📱 界面预览

### 主页面
- 投资组合总览
- 关键统计数据
- 最近添加的投资标的

### 投资管理
- 投资标的列表
- 搜索和筛选
- 添加/编辑投资标的

### 交易记录
- 交易历史
- 交易类型分类
- 收益分析

## 🔒 安全特性

### 数据保护
- 用户数据加密存储
- HTTPS 强制使用
- 定期数据备份

### 访问控制
- 用户认证必需
- 数据隔离
- 操作日志记录

## 🚀 部署

### Vercel 部署
```bash
# 安装 Vercel CLI
npm install -g vercel

# 部署项目
vercel --prod
```

### 环境变量配置
确保在部署平台设置以下环境变量：
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## 📈 商业化建议

### 免费功能
- 最多 10 个投资标的
- 基础统计功能
- 简单提醒设置

### 付费功能
- 无限制投资标的数量
- 高级分析报告
- 自动价格提醒
- 数据导出功能
- 团队协作功能

### 定价策略
- **免费版**: 10个投资标的
- **专业版**: $9.99/月，无限制
- **团队版**: $29.99/月，多用户

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License

## 📞 支持

如有问题，请通过以下方式联系：
- GitHub Issues
- Email: hello@xfinance.app