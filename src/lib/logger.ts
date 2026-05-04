// 生产环境日志控制。
// 注意：故意用 ENABLE_DEBUG_LOGS（非 NEXT_PUBLIC_）—— 这个变量不能进客户端
// bundle，否则浏览器 console 会暴露所有 logger.debug 内容（含未来可能加进
// 来的对象快照、user 信息等）。客户端 prod 永远不打 debug 日志；服务端可
// 以在 Vercel 上按需打开。
//
// ⚠️ 日志卫生规范（重要）：
//   - **不要**把 email / access_token / refresh_token / user_id (UUID) /
//     domain 财务数据直接打进 logger 的参数。Vercel 服务端日志会留存所有
//     console.* 输出，落到 Vercel 基础设施。哪怕短期看不出问题，未来接 Sentry /
//     接日志查询工具时这些 PII 都会被索引。
//   - 只 log 错误对象（{message, status, name} 这种 supabase-js / fetch 标准
//     错误形态）+ 文字描述，不要 log 业务上下文里的具体值。
//   - 真要排查特定用户的问题时，让用户提供 last-4 of UUID 或事件时间戳，
//     反查 auth_events / Vercel logs 时再用全 UUID。
//   - 别忘了：logger.error 在 prod 也输出（设计如此），不像 .log/.warn 会
//     在 prod 静默——所以 .error 的卫生最关键。
const isProduction = process.env.NODE_ENV === 'production';
const enableDebugLogs = process.env.ENABLE_DEBUG_LOGS === 'true';

export const logger = {
  log: (...args: unknown[]) => {
    if (!isProduction || enableDebugLogs) {
      console.log(...args);
    }
  },
  
  error: (...args: unknown[]) => {
    // 错误日志始终输出，但在生产环境可以发送到日志服务
    console.error(...args);
  },
  
  warn: (...args: unknown[]) => {
    if (!isProduction || enableDebugLogs) {
      console.warn(...args);
    }
  },
  
  info: (...args: unknown[]) => {
    if (!isProduction || enableDebugLogs) {
      console.info(...args);
    }
  },
  
  debug: (...args: unknown[]) => {
    // 调试日志仅在开发环境或明确启用时输出
    if (!isProduction || enableDebugLogs) {
      console.debug(...args);
    }
  }
};

// 生产环境错误日志。输出到 console.error 即进入 Vercel 的服务端日志
// （不会发到客户端，也不会暴露到第三方），方便排查 auth / API 层故障。
// 接入 Sentry / LogRocket 等服务前，请确认已有敏感字段脱敏管线。
export const serverLogger = {
  error: (...args: unknown[]) => {
    console.error(...args);
  },

  log: (...args: unknown[]) => {
    if (!isProduction || enableDebugLogs) {
      console.log(...args);
    }
  }
};
