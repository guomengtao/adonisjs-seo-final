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

    // 严格清理字符串的函数
    const strictClean = (str: string | undefined | null, isUrl: boolean = false): string => {
      // 首先检查字符串是否为undefined或null
      if (!str) {
        return ''
      }
      // 首先移除所有ASCII码小于32的不可见字符（这是主要问题）
      str = str.replace(/[\x00-\x1F]/g, '')
      
      if (isUrl) {
        // 移除URL末尾的特殊字符，如]:等
        str = str.replace(/[\]\}\)\>\'\"\;\:\,\s]+$/g, '')
        
        // 移除URL中可能的非法字符，但保留URL必要的字符
        str = str.replace(/[^a-zA-Z0-9\-._~:\/?#\[\]@!$&'()*+,;=]/g, '')
        
        // 确保URL以http://或https://开头
        if (!str.startsWith('http://') && !str.startsWith('https://')) {
          // 如果没有协议，尝试添加http://
          str = 'http://' + str
        }
      } else {
        // 对于非URL字符串，移除所有特殊字符，只保留安全字符
        str = str.replace(/[^a-zA-Z0-9\-._\/\s]/g, '')
      }
      
      return str
    }

    // 清理文件名的函数已合并到strictClean中

    // 2. 遍历处理图片
    for (let i = 0; i < urls.length; i++) {
      try {
        let originalUrl = urls[i]
        
        // 严格清理URL
        originalUrl = strictClean(originalUrl, true)
        
        // 严格清理case_id和url_path
        const cleanedCaseId = strictClean(record.case_id)
        const cleanedUrlPath = strictClean(cleanUrlPath)
        
        // 统一文件名命名规范
        const safeCaseId = cleanedCaseId.replace(/\./g, '-')
        const fileName = `${safeCaseId}-${i + 1}.webp`
        
        // 生成存储路径并严格清理
        const key = strictClean(`${cleanedUrlPath}/${cleanedCaseId}/${fileName}`)

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
        const b2UploadResult = await B2Service.upload(webpBuffer, key)
        console.log(`   📦 B2上传完成: ${key} (${Math.round(webpBuffer.length / 1024)}KB)`)
        console.log(`   ✅ B2上传成功: ${typeof b2UploadResult === 'string' ? b2UploadResult : '上传完成'}`)

        // C. 写入资产明细表 (用于 SEO)
        await db.table('missing_persons_assets').insert({
          case_id: cleanedCaseId,
          is_primary: i === 0 ? 1 : 0,
          sort_order: i + 1,
          asset_type: 'photo',
          original_filename: strictClean(originalUrl.split('/').pop() || ''),
          new_filename: strictClean(fileName),
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