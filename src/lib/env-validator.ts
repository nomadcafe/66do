/**
 * 环境变量验证工具
 * 确保所有必需的环境变量都已设置
 */

const requiredEnvVars = {
  // 公共环境变量（客户端可见）
  public: [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  ],
  // 服务器端环境变量（仅服务器可见）
  server: [
    // 可以根据需要添加服务器端环境变量
  ],
} as const;

export interface EnvValidationResult {
  valid: boolean;
  missing: string[];
  errors: string[];
}

/**
 * 验证环境变量
 * @param isServerSide 是否为服务器端验证
 */
export function validateEnvVars(isServerSide = false): EnvValidationResult {
  const missing: string[] = [];
  const errors: string[] = [];

  // 验证公共环境变量
  for (const varName of requiredEnvVars.public) {
    const value = process.env[varName];
    if (!value || value.trim() === '') {
      missing.push(varName);
      errors.push(`Missing required environment variable: ${varName}`);
    }
  }

  // 验证服务器端环境变量
  if (isServerSide) {
    for (const varName of requiredEnvVars.server) {
      const value = process.env[varName];
      if (!value || value.trim() === '') {
        missing.push(varName);
        errors.push(`Missing required server-side environment variable: ${varName}`);
      }
    }
  }

  return {
    valid: missing.length === 0,
    missing,
    errors,
  };
}

/**
 * 在服务器端验证环境变量，如果验证失败则抛出错误
 */
export function assertEnvVars(isServerSide = false): void {
  const result = validateEnvVars(isServerSide);
  if (!result.valid) {
    throw new Error(
      `Environment variable validation failed:\n${result.errors.join('\n')}`
    );
  }
}

/**
 * 获取环境变量值，如果不存在则返回默认值
 */
export function getEnvVar(name: string, defaultValue?: string): string {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`Environment variable ${name} is required but not set`);
  }
  return value;
}

