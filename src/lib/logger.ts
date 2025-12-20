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

// 生产环境错误日志（仅记录到服务器）
export const serverLogger = {
  error: (...args: unknown[]) => {
    // 在生产环境中，这些应该发送到日志服务
    if (isProduction) {
      // TODO: 集成日志服务如 Sentry, LogRocket 等
      // 目前暂时不记录，避免敏感信息泄露
    } else {
      console.error(...args);
    }
  },
  
  log: (...args: unknown[]) => {
    if (!isProduction || enableDebugLogs) {
      console.log(...args);
    }
  }
};
