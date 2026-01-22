// @ts-nocheck
import env from '#start/env'
import GeminiService from '#services/gemini_service'

export default class SeoAiService {
  // 使用Gemini替代Cloudflare AI
  private static geminiService = GeminiService.getInstance()
  private static modelIndex = 0 // 使用gemini-2.5-flash模型
  // @cf/meta/llama-3.2-3b-instruct
  // const aiEndpoint = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/ai/run/@cf/meta/llama-3.2-3b-instruct`;


  public static async analyze(caseId: string, content: string, originalFilenames: string[]): Promise<{ images: Array<{original_filename: string, new_filename: string, alt_zh: string, caption_zh: string}> } | null | 'RETRY'> {
    try {
      console.log(`🚀 发送 Gemini AI 分析请求 [${caseId}]...`)

      const prompt = `您是一位顶级的Google谷歌公司 中文的SEO专家。针对同一案件的多张图片，您必须执行【差异化描述策略】和【语义化长尾词命名策略】。

 图片网址结构信息：
 - 示例：img.gudq.com/missing/Texas/Harlingen/abigail-estrada/abigail-estrada-tattoo-shawn.webp

 核心规则：
 1. 绝对不允许返回JSON格式，必须以竖线分隔：new_filename|alt_zh|caption_zh
 2. 语义化文件名 (SEO关键)：
    - 严禁简单的序号（如 abigail-1.webp）。
    - 必须结合图片内容生成关键词文件名。格式：[姓名]-[描述特征]-[地点].webp
    - 例如：识别到纹身则用 -tattoo-，识别到模拟图则用 -age-progression-，识别到童年则用 -childhood-。
 3. 差异化 Alt 文本 (严禁重复)：
    - 同一案件的每张图片 alt_zh 必须唯一。
    - 必须包含：[姓名] + [关键差异化特征（如：衣着/纹身/身体标记）] + [案件状态/地点]。
    - 长度要求在20-35字之间，嵌入搜索关键词。
 4. 深度说明文字 (Caption)：
    - 必须包含案件的关键时间点。
    - 长度必须大于alt_zh，详细描述图片背景。
 5. 所有文本必须为中文，文件名必须为全小写英文和中划线。
 6. 不要包含任何解释或额外文本。

分析以下失踪人员案件信息，并为该案件涉及的多张图片生成SEO数据。请根据内容深度挖掘每张图可能的侧重点：

案件ID: ${caseId}

案件内容: ${content.substring(0, 1500)}

原始图片文件名列表: [${originalFilenames.join(', ')}]

注意：
1. 确保每张原始图片都有对应的SEO数据
2. 如果有多张图，请分别侧重长相、纹身、痣、衣着或模拟年龄图，确保描述不重复
3. 必须返回原始文件名和新生成的SEO文件名的对应关系

返回结果必须使用精确格式，每行一条记录：
original_filename|new_filename|alt_zh|caption_zh`

      // 使用GeminiService发送请求
      const response = await this.geminiService.generateMultiLangSummary(prompt, this.modelIndex)
      
      // 检查结果是否有效
      if (!response || !response.summaries || response.summaries.length === 0) {
        throw new Error('Gemini AI 返回无效响应')
      }
      
      // 获取中文摘要作为AI响应
      const zhSummary = response.summaries.find(s => s.lang === 'zh')
      if (!zhSummary || !zhSummary.summary) {
        throw new Error('Gemini AI 返回无效的中文摘要')
      }
      
      let text = zhSummary.summary
      
      if (text) {
        console.log(`Raw Gemini AI response [${caseId}]:\n`, text)
        
        try {
          const lines: string[] = text.split('\n').filter((line: string) => line.trim() !== '')
          const images: Array<{original_filename: string, new_filename: string, alt_zh: string, caption_zh: string}> = []
          
          // 使用 Set 防止文件名在同一批次中由于 AI 出错而重复
          const localUsedFiles = new Set<string>()
          
          // 预先将原始文件名转换为小写用于匹配
          const originalFilenamesLower = originalFilenames.map(fn => fn.toLowerCase())

          // 状态机解析多行格式的图片数据
          interface ImageData {
            original_filename?: string;
            new_filename?: string;
            alt_zh?: string;
            caption_zh?: string;
          }

          let currentImage: ImageData = {}
          let isProcessingImage = false

          for (const line of lines) {
            // 过滤掉说明行
            if (line.toLowerCase().startsWith('note:') || line.startsWith('*') || 
                line.includes('the results are in the exact format specified') || 
                line.includes('after analyzing') || 
                line.includes('here are the results')) {
              continue
            }
            
            // 处理图片编号行（如 "1. " 或 "2. "）
            const imageNumberMatch = line.match(/^(\d+)\./)
            if (imageNumberMatch) {
              // 如果当前有正在处理的图片，先保存它
              if (isProcessingImage && 
                  currentImage.original_filename && 
                  currentImage.new_filename && 
                  currentImage.alt_zh && 
                  currentImage.caption_zh) {
                images.push(currentImage as any)
              }
              // 开始新的图片处理
              currentImage = {}
              isProcessingImage = true
              // 检查行中是否直接包含原始文件名（有些格式可能在编号后直接开始字段）
              const remainingLine = line.replace(/^\d+\.\s*/, '')
              if (remainingLine.includes('original_filename:')) {
                const value = remainingLine.replace('original_filename:', '').trim()
                currentImage.original_filename = value.toLowerCase().replace(/["']/g, '')
              }
              continue
            }
            
            // 处理字段行
            if (isProcessingImage) {
              // 提取字段名和值
              const fieldMatch = line.match(/^([a-z_]+):\s*(.+)$/i)
              if (fieldMatch) {
                const [, fieldName, fieldValue] = fieldMatch
                const normalizedField = fieldName.toLowerCase()
                
                switch (normalizedField) {
                  case 'original_filename':
                    currentImage.original_filename = fieldValue.toLowerCase().replace(/["']/g, '')
                    break
                  case 'new_filename':
                    currentImage.new_filename = fieldValue.toLowerCase().replace(/["']/g, '')
                    break
                  case 'alt_zh':
                  case 'alt_text':
                    currentImage.alt_zh = fieldValue.trim()
                    break
                  case 'caption_zh':
                  case 'caption_text':
                    currentImage.caption_zh = fieldValue.trim()
                    break
                }
              }
            }
            
            // 同时支持 | 分隔格式
            if (line.includes('|') && !isProcessingImage) {
              // 去掉可能的前缀（如 "1. "）
              const cleanLine = line.replace(/^\d+\.\s*/, '')
              
              const parts = cleanLine.split('|').map((item: string) => item.trim())
              
              if (parts.length >= 4) {
                let [original_filename, new_filename, alt_zh, caption_zh] = parts
                
                original_filename = original_filename.toLowerCase().replace(/["']/g, '')
                new_filename = new_filename.toLowerCase().replace(/["']/g, '')
                
                if (original_filename && new_filename && alt_zh && caption_zh) {
                  images.push({ original_filename, new_filename, alt_zh, caption_zh })
                }
              }
            }
          }
          
          // 保存最后一张图片
          if (isProcessingImage && 
              currentImage.original_filename && 
              currentImage.new_filename && 
              currentImage.alt_zh && 
              currentImage.caption_zh) {
            images.push(currentImage as any)
          }
          
          // 过滤掉与原始文件名不匹配的图片
          const filteredImages = images.filter(img => 
            img.original_filename && originalFilenamesLower.includes(img.original_filename.toLowerCase())
          )
          
          // 对过滤后的图片进行最终处理
          const processedImages = filteredImages.map(img => {
            // 确保文件名后缀正确
            let new_filename = img.new_filename || ''
            if (!new_filename.endsWith('.webp')) {
              new_filename = new_filename.split('.')[0] + '.webp'
            }

            // 确保文件名格式正确
            new_filename = new_filename
              .replace(/[^a-z0-9\-_\.]/g, '-')
              .replace(/-+/g, '-')
              .replace(/^-|-$/g, '')

            // 简单的防重逻辑
            if (localUsedFiles.has(new_filename)) {
              new_filename = new_filename.replace('.webp', `-${Math.random().toString(36).substring(2, 5)}.webp`)
            }
              
            localUsedFiles.add(new_filename)
            
            return {
              original_filename: img.original_filename || '',
              new_filename,
              alt_zh: img.alt_zh || '',
              caption_zh: img.caption_zh || ''
            }
          }).filter(img => 
            img.original_filename && img.new_filename && img.alt_zh && img.caption_zh
          )
            
          if (processedImages.length > 0) {
            console.log(`✅ 成功解析 ${processedImages.length} 张图片的差异化SEO数据`)
            return { images: processedImages }
          }
        } catch (pipeError) {
          console.error(`🟡 解析逻辑异常:`, pipeError.message)
        }
        
        // AI返回的数据不完整，直接失败
        console.error(`❌ AI识别失败 [${caseId}]: 返回的数据不完整，无法提取足够的SEO信息`)
        console.error(`   期望处理 ${originalFilenames.length} 张图片，但实际解析到 0 张有效图片数据`)
        return null
      }
      return null
    } catch (e: any) {
      console.error(`❌ Gemini AI Error [${caseId}]:`, e.response?.data || e.message)
      const status = e.response?.status
      if (status === 503 || status === 429 || e.message.includes('quota') || e.message.includes('rate limit')) return 'RETRY'
      return null
    }
  }
}