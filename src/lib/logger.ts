// 生产环境日志控制。
// 注意：故意用 ENABLE_DEBUG_LOGS（非 NEXT_PUBLIC_）—— 这个变量不能进客户端
// bundle，否则浏览器 console 会暴露所有 logger.debug 内容（含未来可能加进
// 来的对象快照、user 信息等）。客户端 prod 永远不打 debug 日志；服务端可
// 以在 Vercel 上按需打开。
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
