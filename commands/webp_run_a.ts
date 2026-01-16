import { BaseCommand } from '@adonisjs/core/ace'
import db from '@adonisjs/lucid/services/db'
import sharp from 'sharp'
import axios from 'axios'
import B2Service from '#services/b2_service'
import { execSync } from 'node:child_process'

export default class ProcessImages extends BaseCommand {
  static commandName = 'webp-a:run'
  static description = '全自动流水线：路径优先 + 明细显示 + 自动对账'
  static options = { startApp: true }

  async run() {
    this.logger.info('🚀 启动全自动流水线...')

    try {
      // 1. 获取最新进度和统计
      const stats = await this.getStats()
      this.logger.info(`📊 数据库进度: ${stats.percent}% (案件: ${stats.completed}/${stats.total}) | 待处理: ${stats.remaining}`)

      // 2. 抓取本轮 50 条记录 (Inner Join 确保路径完整)
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
        .whereNot('missing_persons_info.url_path', '')
        .limit(5000)

      this.logger.info(`📦 本轮成功抓取: ${records.length} 条记录`)

      if (records.length === 0) {
        this.logger.success('✅ 所有带路径的任务已完成！')
        return
      }

      // 3. 循环处理并打印明细
      for (const record of records) {
        this.logger.info(`--------------------------------------------`)
        this.logger.info(`🔍 正在扫描案件: ${record.case_id}`)

        // 清理路径前后的斜杠
        const cleanUrlPath = record.url_path.replace(/^\/|\/$/g, '')
        const html = record.case_html || ''
        const imgRegex = /<img[^>]+src=["']([^"']+)["']/gi
        const matches = [...html.matchAll(imgRegex)]
        const urls = matches.map(m => m[1])

        if (urls.length === 0) {
          this.logger.warning('⚠️ 无图片链接，标记跳过')
          await db.from('missing_persons_cases').where('id', record.id).update({ image_webp_status: 1 })
          continue
        }

        this.logger.info(`📸 发现 ${urls.length} 张图片，开始下载转换...`)

        let count = 0
        for (let i = 0; i < urls.length; i++) {
          try {
            const originalUrl = urls[i]
            // 获取原文件名
            const fileNameWithExt = originalUrl.split('/').pop() || `img_${i}`
            const originalName = fileNameWithExt.split('.')[0]

            // 下载
            const res = await axios.get(originalUrl, { responseType: 'arraybuffer', timeout: 10000 })

            // 转换
            const webp = await sharp(Buffer.from(res.data))
              .resize(1000, 1000, { fit: 'inside', withoutEnlargement: true })
              .webp({ quality: 80 })
              .toBuffer()

            // 【新路径逻辑】url_path/case_id/原名.webp
            const key = `${cleanUrlPath}/${record.case_id}/${originalName}.webp`
            
            await B2Service.upload(webp, key)
            
            // 保留你要求的明细打印
            this.logger.success(`  [${i+1}] ✅ 已上传: ${key}`)
            count++
          } catch (e) {
            this.logger.error(`  [${i+1}] ❌ 失败: ${e.message}`)
          }
        }

        // 更新数据库
        await db.from('missing_persons_cases').where('id', record.id).update({
          image_webp_status: 1,
          image_count: count
        })
        this.logger.info(`✅ 案件 ${record.case_id} 处理完毕`)
      }

      // 4. 本轮结束执行对账
      this.logger.info(`--------------------------------------------`)
      const finalStats = await this.getStats()
      await this.verifyB2Count(finalStats.dbImageSum)
      this.logger.success('🎊 本轮处理结束！')
      
    } catch (error) {
      this.logger.error(`🚨 运行报错: ${error.message}`)
    }
  }

  /**
   * 统计逻辑 (修复了 Ambiguous Column 报错)
   */
  async getStats() {
    const s = await db
      .from('missing_persons_cases')
      .join('missing_persons_info', 'missing_persons_cases.case_id', 'missing_persons_info.case_id')
      .whereNotNull('missing_persons_info.url_path')
      .select(
        db.raw('count(*) as total'),
        db.raw('sum(case when missing_persons_cases.image_webp_status = 1 then 1 else 0 end) as completed'),
        db.raw('sum(missing_persons_cases.image_count) as dbImageSum')
      ).first()
    
    const total = parseInt(s.total) || 0
    const completed = parseInt(s.completed) || 0
    const dbImageSum = parseInt(s.dbImageSum) || 0

    return {
      total,
      completed,
      remaining: total - completed,
      dbImageSum,
      percent: total > 0 ? ((completed / total) * 100).toFixed(2) : '0'
    }
  }

  /**
   * B2 自动对账
   */
  async verifyB2Count(expectedCount: number) {
    this.logger.info('🧐 正在发起 B2 云端核实...')
    try {
      const stdout = execSync('b2 ls --recursive b2://gudq-missing-assets | wc -l', { encoding: 'utf8' })
      const actualCount = parseInt(stdout.trim())

      this.logger.info(`---------------- 对账报告 ----------------`)
      this.logger.info(`📡 B2 线上文件实测: ${actualCount}`)
      this.logger.info(`📊 数据库记录图片: ${expectedCount}`)
      this.logger.info(`-----------------------------------------`)
      
      if (actualCount < expectedCount) {
        this.logger.warning(`⚠️ 注意：线上数少于数据库，请观察明细中是否有重复 Key。`)
      }
    } catch (e) {
      this.logger.error(`❌ 对账过程出错: ${e.message}`)
    }
  }
}