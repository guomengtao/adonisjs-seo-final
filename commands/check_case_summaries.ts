import { BaseCommand } from '@adonisjs/core/ace'
import db from '@adonisjs/lucid/services/db'

export default class CheckCaseSummaries extends BaseCommand {
  static commandName = 'check:case-summaries'
  static description = '检查case_summaries表中的记录'
  static options = { startApp: true }

  async run() {
    try {
      this.logger.info('🔍 检查case_summaries表中的数据...')
      
      // 查询总记录数
      const totalResult = await db.rawQuery('SELECT COUNT(*) as total FROM case_summaries')
      const totalCount = totalResult.rows ? totalResult.rows[0].total : totalResult[0].total
      this.logger.success(`✅ 总记录数: ${totalCount}`)
      
      // 查询不同语言的记录数
      const langResult = await db.rawQuery('SELECT lang, COUNT(*) as count FROM case_summaries GROUP BY lang')
      const langCounts = langResult.rows ? langResult.rows : langResult
      this.logger.info('📊 按语言统计:')
      langCounts.forEach((row: any) => {
        this.logger.info(`   ${row.lang.toUpperCase()}: ${row.count}条记录`)
      })
      
      // 查询最近保存的几条记录
      this.logger.info('\n📋 最近保存的5条记录:')
      const recentResult = await db.rawQuery('SELECT case_id, lang, created_at FROM case_summaries ORDER BY created_at DESC LIMIT 5')
      const recentRecords = recentResult.rows ? recentResult.rows : recentResult
      recentRecords.forEach((record: any) => {
        this.logger.info(`   案件ID: ${record.case_id}, 语言: ${record.lang}, 创建时间: ${record.created_at}`)
      })
      
      this.logger.success('🎉 检查完成!')
    } catch (error: any) {
      this.logger.error('❌ 检查失败:', error.message)
    }
  }
}