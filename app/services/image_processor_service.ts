import db from '@adonisjs/lucid/services/db'
import sharp from 'sharp'
import axios from 'axios'
import B2Service from '#services/b2_service'

export default class ImageProcessorService {
  /**
   * 核心业务：优化图片、上传 B2、写入资产表
   */
  public async processCaseImages(record: any, urls: string[], cleanUrlPath: string) {
    // 1. 清理该案件旧的资产记录（确保数据唯一性）
    await db.from('missing_persons_assets').where('case_id', record.case_id).delete()

    const processedForHf: { path: string; buffer: Buffer }[] = []
    let caseImageCount = 0

    // 2. 遍历处理图片
    for (let i = 0; i < urls.length; i++) {
      try {
        const originalUrl = urls[i]
        
        // 统一文件名命名规范
        const safeCaseId = record.case_id.replace(/\./g, '-')
        const fileName = `${safeCaseId}-${i + 1}.webp`
        const key = `${cleanUrlPath}/${record.case_id}/${fileName}`

        // A. 下载与压缩
        const res = await axios.get(originalUrl, { 
          responseType: 'arraybuffer', 
          timeout: 15000,
          headers: { 'User-Agent': 'Mozilla/5.0 (AdonisTask)' }
        })
        
        const sharpInstance = sharp(Buffer.from(res.data))
          .resize(1000, 1000, { fit: 'inside', withoutEnlargement: true })
          .flatten({ background: '#ffffff' })
          .webp({ quality: 80 })

        const webpBuffer = await sharpInstance.toBuffer()
        const metadata = await sharp(webpBuffer).metadata()

        // B. 即时上传 B2
        await B2Service.upload(webpBuffer, key)

        // C. 写入资产明细表 (用于 SEO)
        await db.table('missing_persons_assets').insert({
          case_id: record.case_id,
          is_primary: i === 0 ? 1 : 0,
          sort_order: i + 1,
          asset_type: 'photo',
          original_filename: originalUrl.split('/').pop(),
          new_filename: fileName,
          storage_path: key,
          width: metadata.width || 0,
          height: metadata.height || 0,
          file_size: webpBuffer.length,
          ai_processed: 0
        })

        processedForHf.push({ path: key, buffer: webpBuffer })
        caseImageCount++

      } catch (error) {
        console.error(`  ❌ 图片处理失败 [${urls[i]}]: ${error.message}`)
      }
    }

    return { caseImageCount, processedForHf }
  }
}