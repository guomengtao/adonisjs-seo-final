import app from '@adonisjs/core/services/app'
import { defineConfig } from '@adonisjs/lucid'
import env from '#start/env' // 确保导入了 env 

const dbConfig = defineConfig({
  // 关键点 1: 将默认连接改为 pg，这样 multiInsert 就会往 Neon 写
  connection: 'pg', 

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

    // 关键点 2: 必须添加 pg (Neon) 的配置
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
  },
})

export default dbConfig