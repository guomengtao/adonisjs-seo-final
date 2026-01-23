import app from '@adonisjs/core/services/app'
import { defineConfig } from '@adonisjs/lucid'
import env from '#start/env' // 确保导入了 env 

const dbConfig = defineConfig({
  // 将默认连接改回 turso
  connection: 'turso', 

  connections: {
    // 你的本地 SQLite
    sqlite: {
      client: 'better-sqlite3',
      connection: {
        filename: app.tmpPath('db.sqlite')
      },
      useNullAsDefault: true,
      migrations: {
        naturalSort: true,
        paths: ['database/migrations'],
      },
    },

    // 关键点 2: pg (Neon) 的配置
    pg: {
      client: 'pg',
      connection: {
        host: env.get('PG_HOST'),
        port: env.get('PG_PORT'),
        user: env.get('PG_USER'),
        password: env.get('PG_PASSWORD'),
        database: env.get('PG_DB_NAME'),
        ssl: { rejectUnauthorized: false }, // Neon 必须开启 SSL
      },
      migrations: {
        naturalSort: true,
        paths: ['database/migrations'],
      },
    },

    // 关键点 3: 添加 turso 的配置
    turso: {
      client: 'libsql',
      connection: {
        // 使用正确的 LibSQL 连接格式 - 将认证令牌包含在URL中
        filename: `${env.get('TURSO_URL')}?authToken=${env.get('TURSO_TOKEN')}` as string,
        // 添加超时设置
        connect_timeout: 10,
        read_timeout: 10,
        write_timeout: 10,
      },
      useNullAsDefault: true,
      migrations: {
        naturalSort: true,
        paths: ['database/migrations'],
        disableTransactions: true,
      },
      pool: {
        min: 1,
        max: 5,
        acquireTimeoutMillis: 30000,
        createTimeoutMillis: 30000,
        destroyTimeoutMillis: 30000,
        idleTimeoutMillis: 60000,
      },
    },
  },
})

export default dbConfig