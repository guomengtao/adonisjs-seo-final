import { BaseCommand } from '@adonisjs/core/ace'
import db from '@adonisjs/lucid/services/db'
import { execSync } from 'child_process'

export default class SyncCaseHtml extends BaseCommand {
  static commandName = 'sync:case-html'
  static description = '从Cloudflare D1同步case_html字段到Neon数据库'
  static options = { startApp: true }

  async run() {
    this.logger.info('🚀 启动case_html字段同步...')
    
    try {
      // 1. 查询Neon中case_html为null的记录
      this.logger.info('🔍 查询Neon中case_html为null的记录...')
      const initialNullCountResult = await db.from('missing_persons_cases').count('id as count').whereNull('case_html')
      const initialNullCount = parseInt(initialNullCountResult[0].count as unknown as string)
      this.logger.info(`   初始状态：Neon中case_html为空的记录总数: ${initialNullCount}`)
      
      if (initialNullCount === 0) {
        this.logger.success('✅ 所有记录的case_html字段都不为空，无需同步')
        return
      }
      
      // 2. 获取所有空记录
      this.logger.info('📥 获取所有case_html为null的记录...')
      const recordsWithNullHtml = await db.from('missing_persons_cases')
        .select('id', 'case_id', 'case_html')
        .whereNull('case_html')
        //.limit(100) // 可以设置限制，比如先处理100条
      
      const totalRecords = recordsWithNullHtml.length
      this.logger.info(`   找到空记录数量: ${totalRecords} 条，开始同步...`)
      
      // 统计变量
      let updateData = 0
      let skippedDueToEmptyD1 = 0
      
      // 3. 逐条从D1获取数据并更新到Neon
      for (const record of recordsWithNullHtml) {
        try {
          // 从D1查询数据
          const command = `npx wrangler d1 execute cloudflare-demo-db --remote --json --command "SELECT case_html FROM missing_persons_cases WHERE case_id = '${record.case_id.replace(/'/g, "''")}'"`
          const result = execSync(command, { encoding: 'utf-8', timeout: 30000 })
          
          // 提取JSON响应
          const jsonStartIndex = result.indexOf('[')
          const jsonEndIndex = result.lastIndexOf(']') + 1
          if (jsonStartIndex === -1 || jsonEndIndex === 0) {
            this.logger.error(`❌ 无法从D1响应中提取JSON数据 for case_id: ${record.case_id}`)
            continue
          }
          
          const jsonResult = result.substring(jsonStartIndex, jsonEndIndex)
          const d1Results = JSON.parse(jsonResult)
          const rows = d1Results[0]?.results || []
          
          if (rows.length > 0) {
            const caseHtml = rows[0].case_html
            
            // 关键改进：如果D1中的case_html也是空的，就不要更新到Neon
            if (!caseHtml || caseHtml === 'null' || caseHtml === null) {
              skippedDueToEmptyD1++
              continue
            }
            
            // 更新到Neon
            await db.from('missing_persons_cases')
              .where('id', record.id)
              .update({ case_html: caseHtml })
            
            updateData++
          }
        } catch (d1Error: any) {
          this.logger.error(`❌ 同步失败 for case_id: ${record.case_id}: ${d1Error.message}`)
        }
      }
      
      // 统计最终结果
      this.logger.info('\n📊 同步完成！')
      this.logger.info(`📈 处理记录总数: ${totalRecords} 条`)
      this.logger.info(`✅ 成功同步记录: ${updateData} 条`)
      this.logger.info(`⚠️  因D1为空跳过记录: ${skippedDueToEmptyD1} 条`)
      this.logger.info(`❌ 同步失败记录: ${totalRecords - updateData - skippedDueToEmptyD1} 条`)
      
      // 查询最终的空记录数量
      const finalNullCountResult = await db.from('missing_persons_cases').count('id as count').whereNull('case_html')
      const finalNullCount = parseInt(finalNullCountResult[0].count as unknown as string)
      
      const totalReduced = initialNullCount - finalNullCount
      
      this.logger.info(`\n📉 空记录数量变化：`)
      this.logger.info(`   初始空记录数: ${initialNullCount} 条`) 
      this.logger.info(`   最终空记录数: ${finalNullCount} 条`) 
      this.logger.info(`   减少的空记录数: ${totalReduced} 条`) 
      
      if (totalReduced > 0) {
        this.logger.success(`🎉 成功减少了 ${totalReduced} 条空记录！`) 
      } else if (totalReduced < 0) {
        this.logger.error(`❌ 空记录反而增加了 ${Math.abs(totalReduced)} 条！`) 
      } else {
        this.logger.info(`ℹ️  空记录数量没有变化，可能D1中对应记录的case_html也为空`) 
      }
      
    } catch (error: any) {
      this.logger.error(`❌ 同步失败: ${error.message}`) 
      this.logger.error(error.stack) 
    }
  }
}