import { BaseCommand } from '@adonisjs/core/ace'
import db from '@adonisjs/lucid/services/db'
import HfService, { HfFile } from '#services/hf_service'
import axios from 'axios'

export default class WebpHfUpload extends BaseCommand {
  static commandName = 'webp:hf'
  static description = '专门用于Hugging Face备份：从B2同步已处理的WebP图片到HF'
  static options = { startApp: true }

  async run() {
    this.logger.info('🚀 启动Hugging Face专门备份命令...')
    this.logger.info('💡 特性：批量上传 + 重试机制 + 错误恢复 + 进度跟踪')
    
    // 配置参数
    const batchSize = 50  // 每次批量上传50张图片
    const maxRetries = 3  // 最大重试次数
    const retryDelay = 5000 // 重试延迟5秒

    try {
      // 1. 获取待备份图片统计
      const stats = await this.getStats()
      this.logger.info(`📊 待备份图片: ${stats.total} 张`)
      
      if (stats.total === 0) {
        this.logger.success('✅ 所有图片已备份到Hugging Face！')
        return
      }

      // 2. 分页处理所有待备份图片
      let processedCount = 0
      let successCount = 0
      let failedCount = 0
      let currentPage = 0
      
      while (processedCount < stats.total) {
        // 获取当前页的待备份图片
        const images = await db
          .from('missing_persons_assets')
          .where('hf_backup_status', 0) // 0表示未备份
          .limit(batchSize)
          .offset(currentPage * batchSize)
          .select('id', 'b2_url', 'hf_path')

        if (images.length === 0) break

        this.logger.info(`📦 正在处理批次 ${currentPage + 1}：${images.length} 张图片`)
        
        // 3. 批量处理当前页图片
        const hfQueue: HfFile[] = []
        
        for (const image of images) {
          try {
            this.logger.info(`🔍 正在准备: ${image.hf_path}`)
            
            // 从B2下载图片
            const response = await axios.get(image.b2_url, {
              responseType: 'arraybuffer',
              timeout: 30000 // 30秒超时
            })
            
            // 转换为Buffer
            const buffer = Buffer.from(response.data)
            
            // 添加到HF上传队列
            hfQueue.push({
              path: image.hf_path,
              content: new Blob([buffer])
            })
            
            this.logger.success(`   └─ ✅ 已准备好上传`)
            
          } catch (imageError) {
            this.logger.error(`   └─ ❌ 准备失败: ${imageError.message}`)
            failedCount++
            
            // 标记为下载失败
            await db.from('missing_persons_assets')
              .where('id', image.id)
              .update({ hf_backup_status: 2 }) // 2表示下载失败
          }
        }
        
        // 4. 批量上传到HF
        if (hfQueue.length > 0) {
          let uploadSuccess = false
          let retryCount = 0
          
          while (retryCount < maxRetries && !uploadSuccess) {
            try {
              this.logger.info(`📤 正在上传 ${hfQueue.length} 张图片到 Hugging Face... (尝试 ${retryCount + 1}/${maxRetries})`)
              
              const commitMsg = `Batch ${currentPage + 1}: ${hfQueue.length} images backup`
              await HfService.batchUpload(hfQueue, commitMsg)
              
              uploadSuccess = true
              this.logger.success(`✨ 批次 ${currentPage + 1} 上传成功！`)
              
              // 更新数据库状态
              const uploadedPaths = hfQueue.map(file => file.path)
              await db.from('missing_persons_assets')
                .whereIn('hf_path', uploadedPaths)
                .update({ hf_backup_status: 1 }) // 1表示备份成功
              
              successCount += hfQueue.length
              
            } catch (uploadError) {
              retryCount++
              this.logger.error(`🚨 上传失败 (${retryCount}/${maxRetries}): ${uploadError.message}`)
              
              if (retryCount < maxRetries) {
                this.logger.info(`⏳ ${retryDelay / 1000}秒后重试...`)
                await new Promise(resolve => setTimeout(resolve, retryDelay))
              } else {
                this.logger.error(`❌ 批次上传最终失败，已达到最大重试次数`)
                failedCount += hfQueue.length
              }
            }
          }
        }
        
        processedCount += images.length
        currentPage++
        
        // 批次之间休息1秒，避免服务器负载过高
        await new Promise(resolve => setTimeout(resolve, 1000))
      }

      // 5. 显示最终统计
      this.logger.info('======================================')
      this.logger.success(`✨ 备份完成：`)
      this.logger.info(`   - 处理图片总数：${processedCount} 张`)
      this.logger.info(`   - 成功备份：${successCount} 张`)
      this.logger.info(`   - 备份失败：${failedCount} 张`)
      this.logger.info('======================================')
      this.logger.info('💡 提示：可再次运行此命令继续备份失败的图片')
      this.logger.info('💡 失败的图片可通过 hf_backup_status = 2 进行查询')

    } catch (error) {
      this.logger.error(`🚨 运行出错: ${error.message}`)
      console.error(error.stack)
    }
  }
  
  async getStats() {
    const total = await db.from('missing_persons_assets')
      .where('hf_backup_status', 0)
      .count('id as total')
      .first()
    
    return {
      total: parseInt(total?.total || '0')
    }
  }
}