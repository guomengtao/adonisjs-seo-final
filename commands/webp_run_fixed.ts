import { BaseCommand } from '@adonisjs/core/ace'
import db from '@adonisjs/lucid/services/db'
import ImageProcessorService from '#services/image_processor_service'
import HfService, { HfFile } from '#services/hf_service'

export default class ProcessImagesFixed extends BaseCommand {
  static commandName = 'webp:run-fixed'
  static description = '修复版图片处理流水线：添加超时控制和错误处理'
  static options = { startApp: true }

  async run() {
    this.logger.info('🚀 启动修复版图片处理流水线...')
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
        .limit(10) // 减少每轮处理数量，避免阻塞

      if (records.length === 0) {
        this.logger.success('✅ 所有任务已完成！')
        return
      }

      const hfQueue: HfFile[] = []
      let processedCasesCount = 0

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
          const { caseImageCount, processedForHf } = result as { caseImageCount: number; processedForHf: { path: string; buffer: Buffer }[] }

          // 4. 将图片 buffer 存入 HF 待上传队列
          if (processedForHf && processedForHf.length > 0) {
            processedForHf.forEach((item: { path: string; buffer: Buffer }) => {
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
          
        } catch (caseError) {
          this.logger.error(`   └─ ❌ 案件处理失败: ${caseError.message}`)
          // 标记为失败状态，避免重复处理
          await db.from('missing_persons_cases').where('id', record.id).update({
            image_webp_status: 2, // 2 表示处理失败
            image_count: 0
          })
        }
      }

      // 6. 统一推送到 Hugging Face 备份（带重试机制）
      if (hfQueue.length > 0) {
        this.logger.info(`📤 正在推送本轮 ${hfQueue.length} 张图到 Hugging Face...`)
        
        let hfSuccess = false
        let retryCount = 0
        const maxRetries = 3
        
        while (!hfSuccess && retryCount < maxRetries) {
          try {
            const commitMsg = `Batch: ${processedCasesCount} cases (${hfQueue.length} images)`
            await HfService.batchUpload(hfQueue, commitMsg)
            hfSuccess = true
            this.logger.success(`✨ HF 备份同步成功！`)
          } catch (hfError) {
            retryCount++
            if (retryCount < maxRetries) {
              this.logger.warning(`⚠️ HF 上传失败 (${retryCount}/${maxRetries})，${hfError.message}，${retryCount * 10}秒后重试...`)
              await new Promise(resolve => setTimeout(resolve, retryCount * 10000)) // 指数退避
            } else {
              this.logger.error(`❌ HF 上传最终失败: ${hfError.message}`)
              this.logger.info(`💡 建议：网络连接问题，可稍后手动重试或检查HF_TOKEN配置`)
            }
          }
        }
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