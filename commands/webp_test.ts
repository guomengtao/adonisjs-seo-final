import { BaseCommand } from '@adonisjs/core/ace'
import db from '@adonisjs/lucid/services/db'
import ImageProcessorService from '#services/image_processor_service'

export default class ProcessImagesTest extends BaseCommand {
  static commandName = 'webp:test'
  static description = '快速测试：仅处理1个案件验证修复'
  static options = { startApp: true }

  async run() {
    this.logger.info('🚀 启动快速测试...')
    this.logger.info('💡 仅处理1个案件，跳过HF备份')
    
    const processor = new ImageProcessorService()

    try {
      // 获取1个待处理案件
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
        .limit(1)

      if (records.length === 0) {
        this.logger.success('✅ 没有待处理案件！')
        return
      }

      const record = records[0]
      this.logger.info(`🔍 正在处理: ${record.case_id}`)
      
      try {
        // 设置超时控制
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('处理超时 (15秒)')), 15000)
        })
        
        // 解析图片链接
        const imgRegex = /<img[^>]+src=["']([^"']+)["']/gi
        const matches = [...(record.case_html?.matchAll(imgRegex) || [])]
        const urls = matches.map(m => m[1])

        if (urls.length === 0) {
          this.logger.info(`📝 无图片案件`)
          return
        }

        const cleanPath = (record.url_path || '').replace(/^\/|\/$/g, '')

        // 处理核心业务
        const processPromise = processor.processCaseImages(record, urls, cleanPath)
        const result = await Promise.race([processPromise, timeoutPromise])
        
        const { caseImageCount } = result as { caseImageCount: number; processedForHf: { path: string; buffer: Buffer }[] }

        // 更新状态
        await db.from('missing_persons_cases').where('id', record.id).update({
          image_webp_status: 1,
          image_count: caseImageCount
        })

        this.logger.success(`✅ 测试完成！处理了 ${caseImageCount} 张图片`)
        
      } catch (caseError) {
        this.logger.error(`❌ 测试失败: ${caseError.message}`)
        console.error(caseError.stack)
      }

    } catch (error) {
      this.logger.error(`🚨 运行出错: ${error.message}`)
      console.error(error.stack)
    }
  }
}