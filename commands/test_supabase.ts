import { BaseCommand } from '@adonisjs/core/ace'
import { inject } from '@adonisjs/core'  
import db from '@adonisjs/lucid/services/db'
import env from '#start/env'

export default class TestSupabaseCommand extends BaseCommand {
  public static commandName = 'test:supabase'
  public static description = 'Test Supabase database connection'

  @inject()
  async run() {
    try {
      this.logger.info('正在测试Supabase连接...')
      
      // 检查数据库配置
      this.logger.info(`当前数据库连接: ${env.get('DB_CONNECTION') || '未设置'}`)
      
      // 执行一个简单的查询来测试连接
      const result = await db.rawQuery('SELECT NOW() as current_time')
      this.logger.success(`连接成功！当前时间: ${result.rows[0].current_time}`)
      
      // 测试数据库表结构
      const tables = await db.rawQuery(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
      )
      this.logger.info(`数据库中的表: ${tables.rows.map((row: any) => row.table_name).join(', ')}`)
      
    } catch (error: any) {
      this.logger.error('连接Supabase失败:')
      this.logger.error(`错误信息: ${error.message || '未知'}`)
      this.logger.error(`错误堆栈: ${error.stack || '无'}`)
      if (error.code) this.logger.error(`错误代码: ${error.code}`)
      if (error.detail) this.logger.error(`错误详情: ${error.detail}`)
    }
  }
}