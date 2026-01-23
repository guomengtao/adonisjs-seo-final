import { BaseCommand } from '@adonisjs/core/ace'
import db from '@adonisjs/lucid/services/db'

export default class AddAssetsColumns extends BaseCommand {
  static commandName = 'add:assets-columns'
  static options = { startApp: true }

  async run() {
    this.logger.info('正在向 missing_persons_assets 表添加 hf_backup_status 和 hf_path 列...')
    
    try {
      // 首先检查列是否已经存在
      const columns = await db.rawQuery('PRAGMA table_info(missing_persons_assets)')
      const existingColumns = columns.map((col: any) => col.name)
      
      if (!existingColumns.includes('hf_backup_status')) {
        await db.rawQuery('ALTER TABLE missing_persons_assets ADD COLUMN hf_backup_status INTEGER DEFAULT 0')
        this.logger.info('✓ 添加 hf_backup_status 列成功')
      } else {
        this.logger.info('✓ hf_backup_status 列已经存在')
      }
      
      if (!existingColumns.includes('hf_path')) {
        await db.rawQuery('ALTER TABLE missing_persons_assets ADD COLUMN hf_path TEXT NULL')
        this.logger.info('✓ 添加 hf_path 列成功')
      } else {
        this.logger.info('✓ hf_path 列已经存在')
      }
      
      this.logger.info('\n操作完成！')
    } catch (error) {
      this.logger.error(`错误: ${error.message}`)
    }
  }
}