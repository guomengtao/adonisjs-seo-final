import { BaseCommand } from '@adonisjs/core/ace'
import Case from '#models/case'
import sharp from 'sharp'
import axios from 'axios'
import B2Service from '#services/b2_service'

export default class ProcessImages extends BaseCommand {
  static commandName = 'hello:run'
  static options = { startApp: true }

  async run() {
    this.logger.info('🚀 启动全自动流水线 (剩余待处理: 8477)...')

    try {
      // 1. 获取 50 条待处理数据
      const records = await Case.query()
        .where('image_webp_status', 0)
        .whereNotNull('case_html')
        .limit(50)

      this.logger.info(`📦 本轮成功抓取: ${records.length} 条记录`)

      if (records.length === 0) {
        this.logger.success('✅ 任务全部完成，没有待处理的数据了！')
        return
      }

      for (const record of records) {
        this.logger.info(`--------------------------------------------`)
        this.logger.info(`🔍 正在扫描案件: ${record.caseId}`)

        const html = record.caseHtml || ''
        const imgRegex = /<img[^>]+src=["']([^"']+)["']/gi
        const matches = [...html.matchAll(imgRegex)]
        const urls = matches.map(m => m[1])

        if (urls.length === 0) {
          this.logger.warning('⚠️ 无图片链接，标记跳过')
          record.imageWebpStatus = 1
          await record.save()
          continue
        }

        this.logger.info(`📸 发现 ${urls.length} 张图片，开始下载转换...`)

        let count = 0
        for (let i = 0; i < urls.length; i++) {
          try {
            // 下载
            const res = await axios.get(urls[i], { 
              responseType: 'arraybuffer', 
              timeout: 10000 
            })

            // 转换
            const webp = await sharp(Buffer.from(res.data))
              .resize(1000, 1000, { fit: 'inside', withoutEnlargement: true })
              .webp({ quality: 80 })
              .toBuffer()

            // 上传
            const key = `cases/${record.caseId}/image_${i + 1}.webp`
            await B2Service.upload(webp, key)
            
            this.logger.success(`  [${i+1}] ✅ 已上传: ${key}`)
            count++
          } catch (e) {
            this.logger.error(`  [${i+1}] ❌ 失败: ${e.message}`)
          }
        }

        // 更新数据库
        record.imageWebpStatus = 1
        record.imageCount = count
        await record.save()
        this.logger.info(`✅ 案件 ${record.caseId} 处理完毕`)
      }

      this.logger.success('🎊 本轮处理结束！')
      
    } catch (error) {
      this.logger.error(`🚨 运行报错: ${error.message}`)
    }
  }
}