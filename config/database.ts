import { defineConfig } from '@adonisjs/lucid'
import env from '#start/env' // 确保导入了 env 

const dbConfig = defineConfig({
  // 默认连接为 supabase
  connection: env.get('DB_CONNECTION', 'supabase'), 

  connections: {
    // Supabase 配置
    supabase: {
      client: 'pg',
      connection: {
        host: env.get('PG_HOST'),
        port: env.get('PG_PORT'),
        user: env.get('PG_USER'),
        password: env.get('PG_PASSWORD'),
        database: env.get('PG_DB_NAME'),
        // SSL 配置
        ssl: env.get('PG_SSL', 'true') === 'true' ? { rejectUnauthorized: false } : false,
      },
      migrations: {
        naturalSort: true,
        paths: ['database/migrations'],
      },
    },
  },
})

export default dbConfig