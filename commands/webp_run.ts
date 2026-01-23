import { BaseCommand } from '@adonisjs/core/ace'
import db from '@adonisjs/lucid/services/db'
import ImageProcessorService from '#services/image_processor_service'
import HfService, { HfFile } from '#services/hf_service'
import { args } from '@adonisjs/core/ace'

export default class ProcessImages extends BaseCommand {
  static commandName = 'webp:run'
  static description = '全自动流水线：B2 同步 + HF 批量备份'
  static options = { startApp: true }

  // 使用装饰器定义参数
  @args.string({
    description: '每批次处理的案件数量，默认3个',
    required: false
  })
  batchSize!: string // 添加明确赋值断言

  async run() {
    // 获取参数或使用默认值
    const batchSize = parseInt(this.batchSize || '3') || 3
    
    this.logger.info('🚀 启动图片处理流水线...')
    this.logger.info(`💡 每次处理${batchSize}个案件，B2即时上传，HF积累${batchSize}个案件后批量上传`)
    
    const processor = new ImageProcessorService()
    
    // HF批量上传队列和计数器
    const hfBatchQueue: HfFile[] = []
    let hfCaseCounter = 0
    const HF_BATCH_SIZE = batchSize // 使用参数值或默认值

    try {
      // 1. 获取进度统计
      const stats = await this.getStats()
      this.logger.info(`📊 总进度: ${stats.percent}% | 待处理: ${stats.remaining} 个案件`)

      // 2. 获取待处理案件 (关联 info 表获取 url_path) - 每次处理指定数量的案件
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
        .limit(batchSize) // 使用参数值或默认值

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
            setTimeout(() => reject(new Error('处理超时 (90秒)')), 90000)
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

          // 4. 将图片添加到 HF 批量上传队列
          if (processedForHf && processedForHf.length > 0) {
            this.logger.info(`📥 已将 ${processedForHf.length} 张图片加入HF批量上传队列`)
            
            // 将当前案件的图片添加到批量队列
            const hfFiles: HfFile[] = processedForHf.map(item => ({
              path: item.path,
              content: new Blob([item.buffer])
            }))
            hfBatchQueue.push(...hfFiles)
          }

          // 5. 更新主表状态
          await db.from('missing_persons_cases').where('id', record.id).update({
            image_webp_status: 1,
            image_count: caseImageCount
          })

          processedCasesCount++
          totalImagesProcessed += caseImageCount
          hfCaseCounter++ // 增加案件计数器
          
          this.logger.success(`   └─ ✅ 案件处理完成！存入 ${caseImageCount} 张图片`)
          this.logger.info(`   📊 HF批量上传进度: ${hfCaseCounter}/${HF_BATCH_SIZE} 个案件`)
          
          // 检查是否达到批量上传条件
          if (hfCaseCounter >= HF_BATCH_SIZE && hfBatchQueue.length > 0) {
            this.logger.info(`📤 达到${HF_BATCH_SIZE}个案件，开始批量上传 ${hfBatchQueue.length} 张图片到 Hugging Face...`)
            
            // HF上传重试机制
            let hfSuccess = false
            let retryCount = 0
            const maxRetries = 3
            
            while (retryCount < maxRetries && !hfSuccess) {
              try {
                const commitMsg = `Batch upload: ${hfBatchQueue.length} images from ${hfCaseCounter} cases`
                await HfService.batchUpload(hfBatchQueue, commitMsg)
                
                hfSuccess = true
                this.logger.success(`✨ HF 批量备份同步成功！共上传 ${hfBatchQueue.length} 张图片`)
                
                // 清空队列和计数器
                hfBatchQueue.length = 0
                hfCaseCounter = 0
              } catch (hfError) {
                retryCount++
                this.logger.error(`   └─ ❌ HF批量上传失败 (${retryCount}/${maxRetries}): ${hfError.message}`)
                
                if (retryCount < maxRetries) {
                  this.logger.info(`   └─ ⏳ 3秒后重试...`)
                  await new Promise(resolve => setTimeout(resolve, 3000))
                }
              }
            }
            
            if (!hfSuccess) {
              this.logger.error(`   └─ ❌ HF批量上传最终失败，已达到最大重试次数`)
            }
          }
          
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

    } catch (error) {
      this.logger.error(`🚨 运行出错: ${error.message}`)
      console.error(error.stack)
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