// 生产环境日志控制
const isProduction = process.env.NODE_ENV === 'production';

export const logger = {
  log: (...args: unknown[]) => {
    if (!isProduction) {
      console.log(...args);
    }
  },
  
  error: (...args: unknown[]) => {
    if (!isProduction) {
      console.error(...args);
    }
  },
  
  warn: (...args: unknown[]) => {
    if (!isProduction) {
      console.warn(...args);
    }
  },
  
  info: (...args: unknown[]) => {
    if (!isProduction) {
      console.info(...args);
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
  }
};
