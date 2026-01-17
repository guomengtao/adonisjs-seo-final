import { BaseCommand } from '@adonisjs/core/ace'
import db from '@adonisjs/lucid/services/db'

export default class CheckUrlPath extends BaseCommand {
  static commandName = 'check:url-path'
  static description = '检查missing_persons_info表中url_path的分布情况'
  static options = { startApp: true }

  async run() {
    this.logger.info('检查url_path分布情况...')
    
    try {
      // 查询非空url_path的记录数
      const notNullResult = await db
        .from('missing_persons_info')
        .count('* as count')
        .whereNotNull('url_path')
        .where('url_path', '<>', '')
      
      // 查询空url_path的记录数
      const nullResult = await db
        .from('missing_persons_info')
        .count('* as count')
        .whereNull('url_path')
        .orWhere('url_path', '')
      
      this.logger.info('url_path分布:')
      this.logger.info(`  非空值: ${notNullResult[0].count} 条记录`)
      this.logger.info(`  空值: ${nullResult[0].count} 条记录`)
      
      // 查询总记录数
      const totalResult = await db.from('missing_persons_info').count('* as count')
      this.logger.info(`\nmissing_persons_info表总记录数: ${totalResult[0].count}`)
      
      // 查询missing_persons_cases表总记录数
      const casesTotalResult = await db.from('missing_persons_cases').count('* as count')
      this.logger.info(`missing_persons_cases表总记录数: ${casesTotalResult[0].count}`)
      
      // 查询没有对应info记录的cases
      const missingInfoResult = await db
        .from('missing_persons_cases')
        .leftJoin('missing_persons_info', 'missing_persons_cases.case_id', 'missing_persons_info.case_id')
        .whereNull('missing_persons_info.case_id')
        .count('* as count')
      
      this.logger.info(`没有对应info记录的cases数量: ${missingInfoResult[0].count}`)
      
      // 查询有url_path但状态为0的记录
      const pendingWithUrlResult = await db
        .from('missing_persons_cases')
        .join('missing_persons_info', 'missing_persons_cases.case_id', 'missing_persons_info.case_id')
        .where('missing_persons_cases.image_webp_status', 0)
        .whereNotNull('missing_persons_info.url_path')
        .where('missing_persons_info.url_path', '<>', '')
        .count('* as count')
      
      this.logger.info(`有url_path但状态为0的记录数: ${pendingWithUrlResult[0].count}`)
      
    } catch (error) {
      this.logger.error('查询失败:', error)
    }
  }
}