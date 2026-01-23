/**
 * 应用常量定义
 * 统一管理所有硬编码值和魔法数字
 */

export const CONSTANTS = {
  // UI相关常量
  UI: {
    ERROR_MESSAGE_TIMEOUT: 3000, // 错误消息显示时间（毫秒）
    DEBOUNCE_DELAY: 300, // 防抖延迟时间（毫秒）
    TOAST_DURATION: 5000, // Toast提示显示时间（毫秒）
  },

  // API相关常量
  API: {
    MAX_BULK_OPERATION_SIZE: 100, // 批量操作最大数量
    MAX_PAGE_SIZE: 50, // 分页最大每页数量
    REQUEST_TIMEOUT: 30000, // 请求超时时间（毫秒）
  },

  // 缓存相关常量
  CACHE: {
    DEFAULT_TTL: 5 * 60 * 1000, // 默认缓存TTL：5分钟
    USER_DATA_TTL: 10 * 60 * 1000, // 用户数据缓存TTL：10分钟
    STATS_TTL: 2 * 60 * 1000, // 统计数据缓存TTL：2分钟
  },

  // 时间相关常量
  TIME: {
    DAYS_IN_YEAR: 365, // 一年天数
    DAYS_IN_MONTH: 30, // 一个月天数（近似值）
    MS_PER_DAY: 24 * 60 * 60 * 1000, // 一天的毫秒数
    MS_PER_HOUR: 60 * 60 * 1000, // 一小时的毫秒数
    MS_PER_MINUTE: 60 * 1000, // 一分钟的毫秒数
  },

  // 持有期判断常量
  HOLDING_PERIOD: {
    SHORT_TERM: 30, // 短期持有：30天
    MEDIUM_TERM: 180, // 中期持有：180天
    LONG_TERM: 365, // 长期持有：365天
  },

  // 文件上传相关常量
  FILE_UPLOAD: {
    MAX_FILE_SIZE: 10 * 1024 * 1024, // 最大文件大小：10MB
    ALLOWED_CSV_TYPES: ['text/csv', 'text/plain', 'application/vnd.ms-excel'],
    ALLOWED_JSON_TYPES: ['application/json', 'text/json'],
    ALLOWED_EXTENSIONS: ['.csv', '.json'],
  },

  // 数据验证相关常量（与validation.ts保持一致）
  VALIDATION: {
    MAX_DOMAIN_NAME_LENGTH: 255,
    MAX_REGISTRAR_LENGTH: 100,
    MAX_TAG_LENGTH: 50,
    MAX_TAGS_COUNT: 20,
    MAX_PURCHASE_COST: 10000000, // $10M
    MAX_RENEWAL_COST: 1000000, // $1M
    MAX_ESTIMATED_VALUE: 100000000, // $100M
    MAX_RENEWAL_CYCLE: 10, // 10 years
    MAX_RENEWAL_COUNT: 100, // 100 renewals
    MAX_TRANSACTION_AMOUNT: 100000000, // $100M
    MAX_NOTES_LENGTH: 1000,
    MAX_CATEGORY_LENGTH: 100,
    MAX_RECEIPT_URL_LENGTH: 500,
  },
} as const;

// 导出常用常量以便直接使用
export const ERROR_MESSAGE_TIMEOUT = CONSTANTS.UI.ERROR_MESSAGE_TIMEOUT;
export const MAX_BULK_OPERATION_SIZE = CONSTANTS.API.MAX_BULK_OPERATION_SIZE;
export const MAX_FILE_SIZE = CONSTANTS.FILE_UPLOAD.MAX_FILE_SIZE;
export const ALLOWED_FILE_TYPES = [
  ...CONSTANTS.FILE_UPLOAD.ALLOWED_CSV_TYPES,
  ...CONSTANTS.FILE_UPLOAD.ALLOWED_JSON_TYPES,
];
export const ALLOWED_EXTENSIONS = CONSTANTS.FILE_UPLOAD.ALLOWED_EXTENSIONS;

