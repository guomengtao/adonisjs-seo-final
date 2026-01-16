import { Env } from '@adonisjs/core/env'

export default await Env.create(new URL('../', import.meta.url), {
  NODE_ENV: Env.schema.enum(['development', 'production', 'test'] as const),
  APP_KEY: Env.schema.string(),
  
  PORT: Env.schema.number.optional(),
  HOST: Env.schema.string.optional({ format: 'host' }),
  LOG_LEVEL: Env.schema.enum.optional(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']),
  
  // 旧模型 Token 改为可选，保持兼容性
  HF_TOKEN: Env.schema.string.optional(),
  GEMINI_API_KEY: Env.schema.string.optional(),

  // 关键：添加 Cloudflare 配置校验
  CF_ACCOUNT_ID: Env.schema.string(),
  CF_API_TOKEN: Env.schema.string(),

  // 数据库相关
  DB_CONNECTION: Env.schema.string.optional(),
  PG_HOST: Env.schema.string.optional(),
  PG_PORT: Env.schema.number.optional(),
  PG_USER: Env.schema.string.optional(),
  PG_PASSWORD: Env.schema.string.optional(),
  PG_DB_NAME: Env.schema.string.optional(),
})