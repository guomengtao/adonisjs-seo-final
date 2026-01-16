import { Env } from '@adonisjs/core/env'

export default await Env.create(new URL('../', import.meta.url), {
  NODE_ENV: Env.schema.enum(['development', 'production', 'test'] as const),
  APP_KEY: Env.schema.string(),
  
  // 1. 将 Web 服务变量改为 optional，这样命令行执行时不会报错
  PORT: Env.schema.number.optional(),
  HOST: Env.schema.string.optional({ format: 'host' }),
  LOG_LEVEL: Env.schema.enum.optional(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']),
  
  // 2. 将旧的 AI Token 改为可选
  HF_TOKEN: Env.schema.string.optional(),

  // 3. 必须在这里定义 GEMINI_API_KEY，否则程序无法识别这个变量
  GEMINI_API_KEY: Env.schema.string(),

  // 4. 补充数据库相关的校验（确保数据库能连上）
  DB_CONNECTION: Env.schema.string.optional(),
  PG_HOST: Env.schema.string.optional(),
  PG_PORT: Env.schema.number.optional(),
  PG_USER: Env.schema.string.optional(),
  PG_PASSWORD: Env.schema.string.optional(),
  PG_DB_NAME: Env.schema.string.optional(),
})

