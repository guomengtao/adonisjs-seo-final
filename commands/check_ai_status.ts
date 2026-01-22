import { BaseCommand } from '@adonisjs/core/ace'
import db from '@adonisjs/lucid/services/db'

export default class CheckAiStatus extends BaseCommand {
  static commandName = 'check:ai-status'
  static description = '检查AI处理状态'
  static options = { startApp: true }

  async run() {
    this.logger.info('检查AI处理状态...')
    
    try {
      // 查询ai_processed的分布情况
      const statusResult = await db
        .from('missing_persons_assets')
        .select('ai_processed')
        .count('* as count')
        .groupBy('ai_processed')
      
      this.logger.info('ai_processed分布:')
      statusResult.forEach(row => {
        this.logger.info(`  状态 ${row.ai_processed}: ${row.count} 条记录`)
      })
      
      // 查询待处理的记录数（ai_processed = 0）
      const pendingResult = await db
        .from('missing_persons_assets')
        .count('* as count')
        .where('ai_processed', 0)
      
      this.logger.info(`\n待处理的记录数（ai_processed = 0）: ${pendingResult[0].count}`)
      
      // 查询待处理的案件数
      const pendingCasesResult = await db
        .from('missing_persons_assets')
        .select('case_id')
        .count('* as count')
        .where('ai_processed', 0)
        .groupBy('case_id')
        .orderBy('count', 'desc')
        .limit(10)
      
      this.logger.info('\n待处理的案件（前10个）:')
      pendingCasesResult.forEach(row => {
        this.logger.info(`  ${row.case_id}: ${row.count} 张图片`)
      })
      
    } catch (error) {
      this.logger.error('查询失败:', error)
    }
  }
}