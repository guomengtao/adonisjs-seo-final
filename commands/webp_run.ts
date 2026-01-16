import { BaseCommand } from '@adonisjs/core/ace'
import db from '@adonisjs/lucid/services/db'
import ImageProcessorService from '#services/image_processor_service'
import HfService, { HfFile } from '#services/hf_service'

export default class ProcessImages extends BaseCommand {
  static commandName = 'webp:run'
  static description = '全自动流水线：B2 同步 + HF 批量备份（精简解耦版）'
  static options = { startApp: true }

  async run() {
    this.logger.info('🚀 启动图片处理流水线...')
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
        .limit(50) // 每轮处理 50 个案件，防止内存溢出

      if (records.length === 0) {
        this.logger.success('✅ 所有任务已完成！')
        return
      }

      const hfQueue: HfFile[] = []
      let processedCasesCount = 0

      for (const record of records) {
        this.logger.info(`🔍 正在处理: ${record.case_id}`)
        
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
          continue
        }

        const cleanPath = (record.url_path || '').replace(/^\/|\/$/g, '')

        // 3. 调用 Service 处理核心业务 (B2 上传 + 数据库 Assets 录入)
        const { caseImageCount, processedForHf } = await processor.processCaseImages(
          record, 
          urls, 
          cleanPath
        )

        // 4. 将图片 buffer 存入 HF 待上传队列
        if (processedForHf && processedForHf.length > 0) {
          processedForHf.forEach(item => {
            hfQueue.push({
              path: item.path,
              content: new Blob([item.buffer])
            })
          })
        }

        // 5. 更新主表状态
        await db.from('missing_persons_cases').where('id', record.id).update({
          image_webp_status: 1,
          image_count: caseImageCount
        })

        processedCasesCount++
        this.logger.success(`   └─ ✅ 完成！存入 ${caseImageCount} 张图片`)
      }

      // 6. 统一推送到 Hugging Face 备份
      if (hfQueue.length > 0) {
        this.logger.info(`📤 正在推送本轮 ${hfQueue.length} 张图到 Hugging Face...`)
        const commitMsg = `Batch: ${processedCasesCount} cases (${hfQueue.length} images)`
        await HfService.batchUpload(hfQueue, commitMsg)
        this.logger.success(`✨ HF 备份同步成功！`)
      }

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