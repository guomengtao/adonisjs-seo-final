import { BaseCommand } from '@adonisjs/core/ace'
import db from '@adonisjs/lucid/services/db'

export default class CheckWebpStatus extends BaseCommand {
  static commandName = 'check:webp-status'
  static description = '检查webp处理状态'
  static options = { startApp: true }

  async run() {
    this.logger.info('检查webp状态分布...')
    
    try {
      // 查询image_webp_status的分布情况
      const statusResult = await db
        .from('missing_persons_cases')
        .select('image_webp_status')
        .count('* as count')
        .groupBy('image_webp_status')
      
      this.logger.info('image_webp_status分布:')
      statusResult.forEach(row => {
        this.logger.info(`  状态 ${row.image_webp_status}: ${row.count} 条记录`)
      })
      
      // 查询缺少url_path的记录数
      const urlPathResult = await db
        .from('missing_persons_cases')
        .join('missing_persons_info', 'missing_persons_cases.case_id', 'missing_persons_info.case_id')
        .count('* as count')
        .whereNotNull('missing_persons_info.url_path')
        
      this.logger.info(`\n有url_path的记录数: ${urlPathResult[0].count}`)
      
      // 查询待处理的记录数（与webp:run命令相同的条件）
      const pendingResult = await db
        .from('missing_persons_cases')
        .join('missing_persons_info', 'missing_persons_cases.case_id', 'missing_persons_info.case_id')
        .count('* as count')
        .where('missing_persons_cases.image_webp_status', 0)
        .whereNotNull('missing_persons_info.url_path')
      
      this.logger.info(`待处理的记录数（与webp:run相同条件）: ${pendingResult[0].count}`)
      
    } catch (error) {
      this.logger.error('查询失败:', error)
    }
  }
}