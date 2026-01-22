import { BaseCommand } from '@adonisjs/core/ace'
import db from '@adonisjs/lucid/services/db'
import ImageProcessorService from '#services/image_processor_service'

export default class ProcessImagesStable extends BaseCommand {
  static commandName = 'webp:stable'
  static description = '稳定版本：分批处理 + 超时控制 + 错误恢复（推荐使用）'
  static options = { startApp: true }

  async run() {
    this.logger.info('🚀 启动稳定版图片处理流水线...')
    this.logger.info('💡 特性：分批处理 + 超时控制 + 错误恢复 + 跳过HF备份')
    
    const processor = new ImageProcessorService()
    const batchSize = 5  // 每次处理5个案件，确保稳定性
    const timeout = 30000 // 每个案件30秒超时

    try {
      // 获取初始进度统计
      const stats = await this.getStats()
      this.logger.info(`📊 总进度: ${stats.percent}% | 待处理: ${stats.remaining} 个案件`)

      let processedInThisRun = 0
      let totalImagesInThisRun = 0
      let failedCases = 0
      
      // 持续处理直到没有待处理案件或达到最大处理数量
      const maxProcessedInRun = 100 // 单次运行最多处理100个案件
      let processedSoFar = 0
      
      while (processedSoFar < maxProcessedInRun) {
        // 获取待处理案件
        const records = await db
          .from('missing_persons_cases')
          .join('missing_persons_info', 'missing_persons_cases.case_id', 'missing_persons_info.case_id')
          .select(
            'missing_persons_cases.id',
            'missing_persons_cases.case_id',
            'missing_persons_cases.case_html',
            'missing_persons_info.url_path'
          )
          .where('missing_persons_cases.image_webp_status', 0)
          .whereNotNull('missing_persons_info.url_path')
          .limit(batchSize)

        if (records.length === 0) {
          this.logger.success('✅ 所有任务已完成！')
          break
        }

        this.logger.info(`📦 开始处理新批次：${records.length} 个案件`)
        
        // 处理当前批次
        for (const record of records) {
          processedSoFar++
          if (processedSoFar > maxProcessedInRun) break

          this.logger.info(`🔍 正在处理 (${processedSoFar}/${maxProcessedInRun}): ${record.case_id}`)
          
          try {
            // 设置超时控制
            const timeoutPromise = new Promise<never>((_, reject) => {
              setTimeout(() => reject(new Error('处理超时')), timeout)
            })
            
            // 解析 HTML 中的图片链接
            const imgRegex = /<img[^>]+src=["']([^"']+)["']/gi
            const matches = [...(record.case_html?.matchAll(imgRegex) || [])]
            const urls = matches.map(m => m[1])

            if (urls.length === 0) {
              // 无图案件直接标记完成
              await db.from('missing_persons_cases').where('id', record.id).update({ 
                image_webp_status: 1,
                image_count: 0 
              })
              this.logger.info(`   └─ 📝 无图片案件，已标记完成`)
              continue
            }

            const cleanPath = (record.url_path || '').replace(/^\/|\/$/g, '')

            // 处理核心业务 (B2 上传 + 数据库 Assets 录入)
            const processPromise = processor.processCaseImages(record, urls, cleanPath)
            const result = await Promise.race([processPromise, timeoutPromise])
            
            // 类型断言确保result是正确类型
            const { caseImageCount } = result as { caseImageCount: number; processedForHf: { path: string; buffer: Buffer }[] }

            // 更新主表状态
            await db.from('missing_persons_cases').where('id', record.id).update({
              image_webp_status: 1,
              image_count: caseImageCount
            })

            processedInThisRun++
            totalImagesInThisRun += caseImageCount
            this.logger.success(`   └─ ✅ 完成！存入 ${caseImageCount} 张图片`)
            
          } catch (caseError) {
            this.logger.error(`   └─ ❌ 案件处理失败: ${caseError.message}`)
            failedCases++
            // 标记为失败状态，避免重复处理
            await db.from('missing_persons_cases').where('id', record.id).update({
              image_webp_status: 2, // 2 表示处理失败
              image_count: 0
            })
          }
        }
        
        // 批次之间短暂休息，避免服务器负载过高
        await new Promise(resolve => setTimeout(resolve, 1000))
      }

      // 显示本轮运行统计
      this.logger.info('======================================')
      this.logger.success(`✨ 本轮完成：`)
      this.logger.info(`   - 成功处理案件：${processedInThisRun} 个`)
      this.logger.info(`   - 成功上传图片：${totalImagesInThisRun} 张`)
      this.logger.info(`   - 处理失败案件：${failedCases} 个`)
      this.logger.info('======================================')
      this.logger.info('💡 提示：可再次运行此命令继续处理剩余案件')
      this.logger.info('💡 失败的案件可通过 image_webp_status = 2 进行查询')

    } catch (error) {
      this.logger.error(`🚨 运行出错: ${error.message}`)
      console.error(error.stack)
    }
  }
  
  async getStats() {
    const total = await db.from('missing_persons_cases').count('id as total').first()
    const completed = await db.from('missing_persons_cases')
      .where('image_webp_status', 1)
      .count('id as completed')
      .first()
    
    const totalCount = parseInt(total?.total || '0')
    const completedCount = parseInt(completed?.completed || '0')
    const remainingCount = totalCount - completedCount
    const percent = totalCount > 0 ? ((completedCount / totalCount) * 100).toFixed(2) : '0.00'
    
    return { total: totalCount, completed: completedCount, remaining: remainingCount, percent }
  }
}