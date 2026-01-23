import { BaseCommand } from '@adonisjs/core/ace'
import db from '@adonisjs/lucid/services/db'

export default class CheckAssetsColumns extends BaseCommand {
  static commandName = 'check:assets-columns'
  static options = { startApp: true }

  async run() {
    this.logger.info('检查 missing_persons_assets 表结构...')
    
    try {
      // 使用 PRAGMA table_info 来获取表的完整结构
      const columns = await db.rawQuery('PRAGMA table_info(missing_persons_assets)')
      
      this.logger.info('表结构:')
      columns.forEach((column: any) => {
        this.logger.info(`${column.name} (${column.type})`)
      })
      
      // 检查是否存在 hf_backup_status 列
      const hasHfBackupStatus = columns.some((column: any) => column.name === 'hf_backup_status')
      const hasHfPath = columns.some((column: any) => column.name === 'hf_path')
      
      this.logger.info(`\nhf_backup_status 列存在: ${hasHfBackupStatus}`)
      this.logger.info(`hf_path 列存在: ${hasHfPath}`)
      
    } catch (error) {
      this.logger.error(`错误: ${error.message}`)
    }
  }
}