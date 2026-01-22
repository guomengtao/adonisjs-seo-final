import { BaseCommand } from '@adonisjs/core/ace'
import db from '@adonisjs/lucid/services/db'

export default class CheckSummaries extends BaseCommand {
  public static commandName = 'check:summaries'
  public static description = '检查案件摘要表中的数据'
  public static options = { startApp: true }

  public async run() {
    this.logger.info('🔍 检查案件摘要表中的数据...')

    try {
      // 查询摘要表中的所有数据
      const result = await db.connection().rawQuery(`SELECT * FROM case_summaries ORDER BY case_id, lang`); // 使用默认连接

      if (!result.rows || result.rows.length === 0) {
        this.logger.info('📊 案件摘要表中没有数据')
        return
      }

      this.logger.info(`📊 案件摘要表中共有 ${result.rows.length} 条记录`)  
      this.logger.info('\n📋 摘要列表：')

      // 按案件分组显示
      const cases: Record<string, any[]> = {}
      result.rows.forEach((row: any) => {
        if (!cases[row.case_id]) {
          cases[row.case_id] = []
        }
        cases[row.case_id].push(row)
      })

      // 显示每个案件的摘要信息
      Object.keys(cases).forEach(caseId => {
        this.logger.info(`\n📌 案件 ID: ${caseId}`)
        cases[caseId].forEach(summary => {
          this.logger.info(`   ${summary.lang.toUpperCase()}: ${summary.summary.substring(0, 100)}...`)
          this.logger.info(`      AI 模型: ${summary.ai_model}`)
          this.logger.info(`      创建时间: ${summary.created_at}`)
        })
      })

      this.logger.info('\n✅ 数据检查完成！')
    } catch (error: any) {
      this.logger.error(`❌ 检查摘要数据失败: ${error.message}`)
    }
  }
}