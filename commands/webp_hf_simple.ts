import { BaseCommand } from '@adonisjs/core/ace'
import db from '@adonisjs/lucid/services/db'
import HfService, { HfFile } from '#services/hf_service'
import axios from 'axios'

export default class WebpHfSimple extends BaseCommand {
  static commandName = 'webp:hf-simple'
  static description = '简单版HF备份：直接从B2同步已处理的案件图片'
  static options = { startApp: true }

  async run() {
    this.logger.info('🚀 启动简单版Hugging Face备份命令...')
    this.logger.info('💡 特性：按案件分批 + 重试机制 + 错误处理')
    
    // 配置参数
    const batchSize = 10  // 每次处理10个案件
    const maxRetries = 3  // 最大重试次数
    const retryDelay = 5000 // 重试延迟5秒

    try {
      // 1. 获取已处理的案件（已生成webp但未备份到HF）
      const stats = await this.getStats()
      this.logger.info(`📊 已处理案件: ${stats.total} 个`)
      
      if (stats.total === 0) {
        this.logger.success('✅ 没有需要备份的案件！')
        return
      }

      // 2. 分页处理案件
      let processedCases = 0
      let totalImages = 0
      let successImages = 0
      let failedImages = 0
      let currentPage = 0
      
      while (processedCases < stats.total) {
        // 获取当前页的案件
        const cases = await db
          .from('missing_persons_cases')
          .where('image_webp_status', 1) // 1表示已处理完成
          .limit(batchSize)
          .offset(currentPage * batchSize)
          .select('id', 'case_id', 'image_count')

        if (cases.length === 0) break

        this.logger.info(`📦 正在处理批次 ${currentPage + 1}：${cases.length} 个案件`)
        
        // 处理每个案件
        for (const caseRecord of cases) {
          this.logger.info(`🔍 正在处理案件: ${caseRecord.case_id}`)
          
          try {
            // 3. 获取案件的图片URL（这里假设我们知道图片的B2 URL模式）
            const imageUrls = this.generateImageUrls(caseRecord)
            this.logger.info(`   └─ 找到 ${imageUrls.length} 张图片`)
            
            // 4. 批量上传到HF
            if (imageUrls.length > 0) {
              const hfQueue: HfFile[] = []
              
              // 从B2下载图片
              for (let i = 0; i < imageUrls.length; i++) {
                const url = imageUrls[i]
                const hfPath = `cases/${caseRecord.case_id}/image_${i + 1}.webp`
                
                try {
                  this.logger.info(`   ├─ 正在下载: ${url}`)
                  const response = await axios.get(url, {
                    responseType: 'arraybuffer',
                    timeout: 30000
                  })
                  
                  const buffer = Buffer.from(response.data)
                  hfQueue.push({
                    path: hfPath,
                    content: new Blob([buffer])
                  })
                  
                  this.logger.success(`   └─ ✅ 下载成功`)
                } catch (downloadError) {
                  this.logger.error(`   └─ ❌ 下载失败: ${downloadError.message}`)
                  failedImages++
                  continue
                }
              }
              
              // 批量上传到HF
              if (hfQueue.length > 0) {
                let uploadSuccess = false
                let retryCount = 0
                
                while (retryCount < maxRetries && !uploadSuccess) {
                  try {
                    this.logger.info(`📤 正在上传 ${hfQueue.length} 张图片到HF... (${retryCount + 1}/${maxRetries})`)
                    
                    const commitMsg = `Backup case ${caseRecord.case_id}: ${hfQueue.length} images`
                    await HfService.batchUpload(hfQueue, commitMsg)
                    
                    uploadSuccess = true
                    successImages += hfQueue.length
                    this.logger.success(`✨ 上传成功！`)
                    
                  } catch (uploadError) {
                    retryCount++
                    this.logger.error(`🚨 上传失败: ${uploadError.message}`)
                    
                    if (retryCount < maxRetries) {
                      this.logger.info(`⏳ ${retryDelay / 1000}秒后重试...`)
                      await new Promise(resolve => setTimeout(resolve, retryDelay))
                    } else {
                      this.logger.error(`❌ 上传最终失败`)
                      failedImages += hfQueue.length
                    }
                  }
                }
              }
            }
            
            processedCases++
            totalImages += caseRecord.image_count
            
          } catch (caseError) {
            this.logger.error(`❌ 案件处理失败: ${caseError.message}`)
            failedImages += caseRecord.image_count
          }
        }
        
        currentPage++
        
        // 批次之间休息1秒
        await new Promise(resolve => setTimeout(resolve, 1000))
      }

      // 5. 显示统计信息
      this.logger.info('======================================')
      this.logger.success(`✨ 备份完成：`)
      this.logger.info(`   - 处理案件：${processedCases} 个`)
      this.logger.info(`   - 总图片数：${totalImages} 张`)
      this.logger.info(`   - 成功备份：${successImages} 张`)
      this.logger.info(`   - 备份失败：${failedImages} 张`)
      this.logger.info('======================================')

    } catch (error) {
      this.logger.error(`🚨 运行出错: ${error.message}`)
      console.error(error.stack)
    }
  }
  
  // 生成图片URL的方法（需要根据实际情况调整）
  generateImageUrls(caseRecord: { case_id: string; image_count: number }) {
    const urls: string[] = []
    
    // 假设B2 URL格式为：https://b2.example.com/cases/{case_id}/image_{index}.webp
    // 请根据实际情况调整此格式
    for (let i = 1; i <= caseRecord.image_count; i++) {
      urls.push(`https://b2.example.com/cases/${caseRecord.case_id}/image_${i}.webp`)
    }
    
    return urls
  }
  
  async getStats() {
    const total = await db.from('missing_persons_cases')
      .where('image_webp_status', 1)
      .count('id as total')
      .first()
    
    return {
      total: parseInt(total?.total || '0')
    }
  }
}