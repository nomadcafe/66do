# 交易保存 / 刷新后消失 — Git 时间线

| 提交 | 说明 | 可能影响 |
|------|------|----------|
| **3897ad5** | 有 session 时**用 API 拉**域名/交易 | 服务端 setSession 不稳 → GET 空列表 → 刷新像「记录没了」。**e72219f** 已改回浏览器 Supabase 拉取。 |
| **623e110** | 交易 POST 严格 payload | 字段不全可能影响插入；后续已补分期等字段。 |
| **a892369 前** | 新建域名用服务端随机 id | 交易 `domain_id` 对不上 → 插入失败。**a892369** 已用客户端域名 id。 |
| **saveData** | 曾 `if (!sessionToken) return` | **静默退出**：不保存、不更新界面。已改为 `getSession()` 补 token。 |

当前：列表与**新建交易**均走浏览器 Supabase（带登录 session）。

| 后续修复 | 说明 |
|----------|------|
| **session 等待 + 去掉内存 cache 捷径** | 硬刷新后 JWT 未恢复时 RLS 返回空 → 曾把空列表当有效数据；`/dashboard` 设 `force-dynamic` 减轻 HTML 304 干扰。保存成功后再次拉库与 DB 对齐。 |
