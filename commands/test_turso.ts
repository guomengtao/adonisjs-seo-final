import { BaseCommand } from '@adonisjs/core/ace'
import { createClient } from '@libsql/client'
import env from '#start/env'

export default class TestTurso extends BaseCommand {
  static commandName = 'test:turso'
  static options = { startApp: true }

  async run() {
    this.logger.info('测试Turso数据库连接...')
    
    try {
      // 直接使用@libsql/client创建连接
      const client = createClient({
        url: env.get('TURSO_URL') as string,
        authToken: env.get('TURSO_TOKEN') as string
      })
      
      // 尝试执行一个简单的查询
      const result = await client.execute('SELECT 1 as test')
      this.logger.info(`查询结果: ${JSON.stringify(result)}`)
      
      this.logger.success('✅ Turso数据库连接成功！')
    } catch (error) {
      this.logger.error('❌ Turso数据库连接失败:', error.message)
      this.logger.error(error.stack)
    }
  }
}