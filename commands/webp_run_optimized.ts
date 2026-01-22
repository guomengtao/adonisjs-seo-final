import { BaseCommand } from '@adonisjs/core/ace'
import db from '@adonisjs/lucid/services/db'
import ImageProcessorService from '#services/image_processor_service'

export default class ProcessImagesOptimized extends BaseCommand {
  static commandName = 'webp:run-optimized'
  static description = '优化版图片处理流水线：专注B2上传，跳过HF备份'
  static options = { startApp: true }

  async run() {
    this.logger.info('🚀 启动优化版图片处理流水线...')
    this.logger.info('💡 专注B2上传，跳过Hugging Face备份（避免网络问题）')
    
    const processor = new ImageProcessorService()

    try {
      // 1. 获取进度统计
      const stats = await this.getStats()
      this.logger.info(`📊 总进度: ${stats.percent}% | 待处理: ${stats.remaining} 个案件`)

      // 2. 获取待处理案件 (关联 info 表获取 url_path)
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
        .limit(20) // 增加每轮处理数量，提高效率

      if (records.length === 0) {
        this.logger.success('✅ 所有任务已完成！')
        return
      }

      let processedCasesCount = 0
      let totalImagesProcessed = 0

      for (const record of records) {
        this.logger.info(`🔍 正在处理: ${record.case_id}`)
        
        try {
          // 设置超时控制
          const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('处理超时 (30秒)')), 30000)
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

          // 3. 调用 Service 处理核心业务 (B2 上传 + 数据库 Assets 录入)
          const processPromise = processor.processCaseImages(record, urls, cleanPath)
          const result = await Promise.race([processPromise, timeoutPromise])
          
          // 类型断言确保result是正确类型
          const { caseImageCount } = result as { caseImageCount: number; processedForHf: { path: string; buffer: Buffer }[] }

          // 4. 更新主表状态
          await db.from('missing_persons_cases').where('id', record.id).update({
            image_webp_status: 1,
            image_count: caseImageCount
          })

          processedCasesCount++
          totalImagesProcessed += caseImageCount
          this.logger.success(`   └─ ✅ 完成！存入 ${caseImageCount} 张图片到B2`)
          
        } catch (caseError) {
          this.logger.error(`   └─ ❌ 案件处理失败: ${caseError.message}`)
          // 标记为失败状态，避免重复处理
          await db.from('missing_persons_cases').where('id', record.id).update({
            image_webp_status: 2, // 2 表示处理失败
            image_count: 0
          })
        }
      }

      this.logger.success(`✨ 本轮完成：${processedCasesCount} 个案件，${totalImagesProcessed} 张图片已上传到B2`)
      this.logger.info(`💡 HF备份已跳过，可稍后单独运行HF同步命令`)

    } catch (error) {
      this.logger.error(`🚨 运行出错: ${error.message}`)
    }
  }

  /**
   * 获取处理进度统计
   */
  async getStats() {
    const s = await db
      .from('missing_persons_cases')
      .join('missing_persons_info', 'missing_persons_cases.case_id', 'missing_persons_info.case_id')
      .whereNotNull('missing_persons_info.url_path')
      .select(
        db.raw('count(*) as total'),
        db.raw('sum(case when image_webp_status = 1 then 1 else 0 end) as completed')
      ).first()
    
    const total = parseInt(s.total) || 0
    const completed = parseInt(s.completed) || 0

    return {
      total,
      completed,
      remaining: total - completed,
      percent: total > 0 ? ((completed / total) * 100).toFixed(2) : '0'
    }
  }
}