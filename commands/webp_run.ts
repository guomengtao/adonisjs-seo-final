import { BaseCommand } from '@adonisjs/core/ace'
import db from '@adonisjs/lucid/services/db'
import ImageProcessorService from '#services/image_processor_service'
import HfService, { HfFile } from '#services/hf_service'
import { args } from '@adonisjs/core/ace'

export default class ProcessImages extends BaseCommand {
  static commandName = 'webp:run'
  static description = '全自动流水线：支持相对路径补全 + 强力正则匹配 + HF清尾'
  static options = { startApp: true }

  @args.string({
    description: '每批次处理的案件数量，默认3个',
    required: false
  })
  batchSize!: string

  async run() {
    const batchSize = parseInt(this.batchSize || '3') || 3
    const BASE_URL = 'https://charleyproject.org' // 用于补全相对路径
    
    this.logger.info('🚀 启动图片处理流水线 (增强版)...')
    
    const processor = new ImageProcessorService()
    const hfBatchQueue: HfFile[] = []
    let hfCaseCounter = 0

    try {
      const stats = await this.getStats()
      this.logger.info(`📊 总进度: ${stats.percent}% | 待处理: ${stats.remaining} 个案件`)

      // 获取待处理案件 (状态 0 为待处理，状态 2 为之前失败的尝试)
      const records = await db
        .from('missing_persons_cases')
        .join('missing_persons_info', 'missing_persons_cases.case_id', 'missing_persons_info.case_id')
        .select(
          'missing_persons_cases.id',
          'missing_persons_cases.case_id',
          'missing_persons_cases.case_html',
          'missing_persons_info.url_path'
        )
        .whereIn('missing_persons_cases.image_webp_status', [0, 2]) 
        .whereNotNull('missing_persons_info.url_path')
        .limit(batchSize)

      if (records.length === 0) {
        this.logger.success('✅ 所有任务已完成！')
        return
      }

      for (const record of records) {
        this.logger.info(`🔍 正在处理: ${record.case_id}`)
        
        try {
          const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('处理超时 (90秒)')), 90000)
          })
          
          /**
           * 改进 1: 强力正则提取
           * 直接匹配 .jpg 结尾的链接，无论是否在 img 标签内
           */
          const html = record.case_html || ''
          const jpgRegex = /(?:https?:\/\/[^"'>\s]+|wp-content\/uploads\/[^"'>\s]+)\.jpg/gi
          const rawMatches = html.match(jpgRegex) || []
          
          // 去重并补全 URL
          let urls = [...new Set(rawMatches)].map(url => {
            if (url.startsWith('http')) return url
            // 改进 2: 补全相对路径 (charleyproject.org/wp-content/...)
            return `${BASE_URL}/${url.startsWith('/') ? url.slice(1) : url}`
          })

          if (urls.length === 0) {
            await db.from('missing_persons_cases').where('id', record.id).update({ 
              image_webp_status: 1,
              image_count: 0 
            })
            this.logger.info(`   └─ 📝 无图片案件，已标记完成`)
            continue
          }

          this.logger.info(`   └─ 🔗 提取到 ${urls.length} 个图片链接`)

          const cleanPath = (record.url_path || '').replace(/^\/|\/$/g, '')

          const processPromise = processor.processCaseImages(record, urls, cleanPath)
          const result = await Promise.race([processPromise, timeoutPromise]) as any
          
          const { caseImageCount, processedForHf } = result

          // 累积到 HF 队列
          if (processedForHf && processedForHf.length > 0) {
            const hfFiles: HfFile[] = processedForHf.map((item: any) => ({
              path: item.path,
              content: new Blob([item.buffer])
            }))
            hfBatchQueue.push(...hfFiles)
          }

          // 更新状态
          await db.from('missing_persons_cases').where('id', record.id).update({
            image_webp_status: 1,
            image_count: caseImageCount
          })

          hfCaseCounter++
          this.logger.success(`   └─ ✅ 完成！存入 ${caseImageCount} 张图片`)
          
          // 达到批量上传条件
          if (hfCaseCounter >= batchSize && hfBatchQueue.length > 0) {
            await this.uploadToHf(hfBatchQueue)
            hfBatchQueue.length = 0
            hfCaseCounter = 0
          }
          
        } catch (caseError) {
          this.logger.error(`   └─ ❌ 失败: ${caseError.message}`)
          await db.from('missing_persons_cases').where('id', record.id).update({
            image_webp_status: 2, 
            image_count: 0
          })
        }
      }

      /**
       * 改进 3: HF 清尾逻辑
       * 循环结束后，如果队列里还有图片（不满一个 batch），也要上传
       */
      if (hfBatchQueue.length > 0) {
        this.logger.info(`🧹 正在处理剩余的 ${hfBatchQueue.length} 张图片备份...`)
        await this.uploadToHf(hfBatchQueue)
      }

      this.logger.success(`✨ 本轮任务处理结束`)

    } catch (error) {
      this.logger.error(`🚨 严重错误: ${error.message}`)
    }
  }

  /**
   * 封装 HF 上传重试逻辑
   */
  private async uploadToHf(queue: HfFile[]) {
    let success = false
    let retry = 0
    while (retry < 3 && !success) {
      try {
        await HfService.batchUpload(queue, `Batch upload: ${queue.length} images`)
        success = true
        this.logger.success(`✨ HF 备份成功 (${queue.length} 张)`)
      } catch (err) {
        retry++
        this.logger.error(`❌ HF 上传失败，重试中 (${retry}/3)...`)
        await new Promise(r => setTimeout(r, 2000))
      }
    }
  }

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