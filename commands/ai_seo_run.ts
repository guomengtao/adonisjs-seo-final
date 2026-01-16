import { BaseCommand } from '@adonisjs/core/ace'
import db from '@adonisjs/lucid/services/db'
import SeoAiService from '#services/seo_ai_service'

export default class AiSeoRun extends BaseCommand {
  static commandName = 'ai:seo'
  static options = { startApp: true }



  async run() {
    this.logger.info('🚀 启动 SEO 自动化流水线...')

    const pendingCases = await db.from('missing_persons_assets')
      .where('ai_processed', 0)
      .distinct('case_id')

    if (pendingCases.length === 0) return this.logger.success('✅ 处理完毕')

    // 只处理第一条待处理案件
    const { case_id } = pendingCases[0]
    // 立即将任务状态改为100，避免死循环
    await this.updateStatus(case_id, 100)
    this.logger.info(`--------------------------------------------------`)
    this.logger.info(`🤖 处理案件: ${case_id}`)
    
    const record = await db.from('missing_persons_cases').where('case_id', case_id).first()
    if (!record || !record.case_html) {
      await this.updateStatus(case_id, 404)
      return
    }
    
    // 显示处理的表ID
    this.logger.info(`📋 案件表ID: ${record.id || 'N/A'}`)
    
    // 获取该案件下所有未处理的图片原始文件名
    const assets = await db.from('missing_persons_assets')
      .where('case_id', case_id)
      .where('ai_processed', 0)
      .select('original_filename', 'new_filename')
    
    let originalFilenames = assets.map(asset => asset.original_filename)
    this.logger.info(`📷 找到 ${originalFilenames.length} 张待处理图片`)    
    
    // 如果没有找到待处理图片，检查 HTML 中的图片
    if (originalFilenames.length === 0) {
      this.logger.warning('   ⚠️  未找到任何待处理图片的原始文件名')
      
      // 提取 HTML 中的图片标签
      const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi
      const imgMatches = [...(record.case_html?.matchAll(imgRegex) || [])]
      
      if (imgMatches.length > 0) {
        this.logger.info(`   🖼️  从 HTML 中提取到 ${imgMatches.length} 个图片标签:`)
        
        // 从图片 URL 中提取原始文件名
        originalFilenames = imgMatches.map(match => {
          const url = match[1]
          const filename = url.split('/').pop()
          this.logger.info(`      ${filename}: ${url}`)
          return filename
        })
        
        if (originalFilenames.length === 0) {
          this.logger.error('   ❌ 无法从图片 URL 中提取文件名')
          await this.updateStatus(case_id, 404)
          return
        }
        
        // 创建新的资产记录
        this.logger.info(`   📝 正在为 ${originalFilenames.length} 张图片创建资产记录...`)
        
        for (let i = 0; i < imgMatches.length; i++) {
          const originalFilename = originalFilenames[i]
          const safeCaseId = case_id.replace(/\./g, '-')
          const fileName = `${safeCaseId}-${i + 1}.webp`
          const key = `cases/${case_id}/${fileName}`
          
          try {
            await db.table('missing_persons_assets').insert({
              case_id: case_id,
              is_primary: i === 0 ? 1 : 0,
              sort_order: i + 1,
              asset_type: 'photo',
              original_filename: originalFilename,
              new_filename: fileName,
              storage_path: key,
              width: 0,
              height: 0,
              file_size: 0,
              ai_processed: 0
            })
            this.logger.info(`      ✅ 创建记录: ${originalFilename} -> ${fileName}`)
          } catch (error) {
            this.logger.error(`      ❌ 创建记录失败 [${originalFilename}]: ${error.message}`)
          }
        }
        
        this.logger.info(`   ✅ 已创建资产记录，将继续处理`)
      } else {
        this.logger.info(`   🖼️  未在 HTML 中找到任何图片标签`)
        await this.updateStatus(case_id, 404)
        return
      }
    } else {
      this.logger.info(`   原始文件名: ${originalFilenames.join(', ')}`)
    }

    let cleaned = record.case_html.replace(/<img[^>]+src=["'][^"']+\/([^"']+\.webp)["'][^>]*>/gi, '\n[IMAGE: $1]\n')
    cleaned = cleaned.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

    let result = await SeoAiService.analyze(case_id, cleaned, originalFilenames)
    let retryCount = 0
    const maxRetries = 3 // 最多重试3次
    
    // 显示AI返回的信息
    if (result && result !== 'RETRY') {
      this.logger.info('🤖 AI返回信息:')
      this.logger.info(JSON.stringify(result, null, 2))
    }

    if (result === 'RETRY') {
      while (result === 'RETRY' && retryCount < maxRetries) {
        retryCount++
        this.logger.info(`⏳ 模型预热中... (重试 ${retryCount}/${maxRetries})`)
        await new Promise(r => setTimeout(r, 20000)) // 20秒后重试
        result = await SeoAiService.analyze(case_id, cleaned, originalFilenames)
      }
    }

    if (result && typeof result === 'object' && Array.isArray(result.images)) {
      try {
        let processedImages = 0
        let skippedImages = 0
        const processedDetails: string[] = []
        
        await db.transaction(async (trx) => {
          for (const img of result.images) {
            // 验证必填字段是否存在
            if (!img.new_filename) {
              this.logger.info(`   ⚠️  跳过：缺少 new_filename 字段`)
              skippedImages++
              continue
            }
            
            if (!img.alt_zh) {
              this.logger.info(`   ⚠️  跳过 [${img.new_filename}]：缺少 alt_zh 字段`)
              skippedImages++
              continue
            }
            
            if (!img.caption_zh) {
              this.logger.info(`   ⚠️  跳过 [${img.new_filename}]：缺少 caption_zh 字段`)
              skippedImages++
              continue
            }

            // 显示要写入的数据
            this.logger.info('📝 准备写入数据库的内容:')
            this.logger.info(`   目标记录: case_id=${case_id}, new_filename=${img.new_filename}`)
            this.logger.info(`   写入内容: alt_zh=${img.alt_zh}, caption_zh=${img.caption_zh}, ai_processed=200`)
            
            // 根据 original_filename 查找并更新数据
            const updateResult = await trx.from('missing_persons_assets')
              .where('case_id', case_id)
              .where('original_filename', img.original_filename)
              .update({
                new_filename: img.new_filename,
                alt_zh: img.alt_zh,
                caption_zh: img.caption_zh,
                ai_processed: 200
              })
            
            // 确保正确处理受影响的行数
            const affectedRows = typeof updateResult === 'number' ? updateResult : updateResult[0]
            if (affectedRows > 0) {
              processedImages++
              processedDetails.push(`   - ${img.new_filename}: 更新成功`)
            } else {
              this.logger.info(`   ⚠️  [${img.new_filename}]：未找到匹配的记录，将创建新记录`)
              try {
                // 创建新的资产记录
                const key = `cases/${case_id}/${img.new_filename}`
                
                await trx.table('missing_persons_assets').insert({
                  case_id: case_id,
                  is_primary: 0,
                  sort_order: 99,
                  asset_type: 'photo',
                  original_filename: img.original_filename,
                  new_filename: img.new_filename,
                  storage_path: key,
                  width: 0,
                  height: 0,
                  file_size: 0,
                  alt_zh: img.alt_zh,
                  caption_zh: img.caption_zh,
                  ai_processed: 200
                })
                
                processedImages++
                processedDetails.push(`   - ${img.new_filename}: 插入成功`)
              } catch (insertError) {
                this.logger.error(`   ❌ 插入记录失败 [${img.new_filename}]: ${insertError.message}`)
                skippedImages++
              }
            }
          }
        })

        // 打印详细结果
        this.logger.success(`✅ [${case_id}] 持久化完成`)
        this.logger.info(`   ├─ 处理结果：`)
        if (processedDetails.length > 0) {
          processedDetails.forEach(detail => this.logger.info(detail))
        }
        this.logger.info(`   ├─ 成功处理：${processedImages} 张图片`)
        this.logger.info(`   └─ 跳过：${skippedImages} 张图片`)
        
        // 查询并打印数据库中保存的最终结果
        this.logger.info(`📊 数据库中保存的记录：`)
        const savedAssets = await db.from('missing_persons_assets')
          .where('case_id', case_id)
          .where('ai_processed', 200)
          .select('original_filename', 'new_filename', 'alt_zh', 'caption_zh')
        
        savedAssets.forEach((asset, index) => {
          this.logger.info(`   图片 ${index + 1}:`)
          this.logger.info(`   ├─ 原始文件名：${asset.original_filename}`)
          this.logger.info(`   ├─ 新文件名：${asset.new_filename}`)
          this.logger.info(`   ├─ Alt文本：${asset.alt_zh}`)
          this.logger.info(`   └─ 说明文字：${asset.caption_zh}`)
        })
      } catch (dbErr) {
        this.logger.error(`❌ 数据库错误: ${dbErr.message}`)
        await this.updateStatus(case_id, 500)
        return
      }
    } else {
      if (result === 'RETRY') {
        this.logger.error('❌ 模型加载超时，已达到最大重试次数')
      } else {
        this.logger.error('❌ AI返回无效数据格式')
      }
      await this.updateStatus(case_id, 400)
    }
    await new Promise(r => setTimeout(r, 1000)) // 添加适当的延迟避免API限流
  }

  async updateStatus(caseId: string, code: number) {
    await db.from('missing_persons_assets').where('case_id', caseId).update({ ai_processed: code })
  }
}