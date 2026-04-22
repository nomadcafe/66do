// 生产环境日志控制
const isProduction = process.env.NODE_ENV === 'production';
const enableDebugLogs = process.env.NEXT_PUBLIC_ENABLE_DEBUG_LOGS === 'true';

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
