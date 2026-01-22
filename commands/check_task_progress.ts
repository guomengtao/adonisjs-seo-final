import { BaseCommand } from '@adonisjs/core/ace'
import db from '@adonisjs/lucid/services/db'

export default class CheckTaskProgress extends BaseCommand {
  static commandName = 'check:task-progress'
  static description = '检查任务进度表内容'
  static options = { startApp: true }

  async run() {
    try {
      this.logger.info('🔍 检查任务进度表内容...')
      
      const result = await db.connection().rawQuery("SELECT * FROM task_progress")
      
      // 处理不同的结果格式
      let rows: any[] = []
      if (Array.isArray(result)) {
        rows = result
      } else if (result.rows) {
        rows = result.rows
      } else if (result && typeof result === 'object') {
        rows = [result]
      }
      
      if (rows.length === 0) {
        this.logger.info('📋 任务进度表为空')
        return
      }
      
      this.logger.info(`📊 任务进度表共有 ${rows.length} 条记录:`)
      
      for (const row of rows) {
        this.logger.info(`   📋 任务: ${row.task_name}, 最后ID: ${row.last_id}, 更新时间: ${row.updated_at}`)
      }
      
    } catch (error: any) {
      this.logger.error('❌ 检查任务进度表失败:', error.message)
    }
  }
}