import env from '#start/env'

export default class SeoAiService {
  private static accountId = env.get('CF_ACCOUNT_ID')
  private static apiToken = env.get('CF_AI_TOKEN')
  // 使用 Llama-3 8B，平衡速度与质量
  private static model = '@cf/meta/llama-3-8b-instruct'

  public static async analyze(caseId: string, content: string, originalFilenames: string[]): Promise<{ images: Array<{original_filename: string, new_filename: string, alt_zh: string, caption_zh: string}> } | null | 'RETRY'> {
    try {
      console.log(`🚀 发送 Cloudflare AI 分析请求 [${caseId}]...`)

      const aiRequest = {
        messages: [
          {
            role: "system",
            content: `您是一位顶级的Google谷歌公司 中文的SEO专家。针对同一案件的多张图片，您必须执行【差异化描述策略】和【语义化长尾词命名策略】。

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
 6. 不要包含任何解释或额外文本。`
          },
          {
            role: "user",
            content: `分析以下失踪人员案件信息，并为该案件涉及的多张图片生成SEO数据。请根据内容深度挖掘每张图可能的侧重点：\n\n案件ID: ${caseId}\n\n案件内容: ${content.substring(0, 1500)}\n\n原始图片文件名列表: [${originalFilenames.join(', ')}]\n\n注意：\n1. 确保每张原始图片都有对应的SEO数据\n2. 如果有多张图，请分别侧重长相、纹身、痣、衣着或模拟年龄图，确保描述不重复\n3. 必须返回原始文件名和新生成的SEO文件名的对应关系\n\n返回结果必须使用精确格式，每行一条记录：\noriginal_filename|new_filename|alt_zh|caption_zh`
          }
        ],
        max_tokens: 1200,
        temperature: 0.4 // 稍微提高温度以增加描述的多样性
      }

      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/ai/run/${this.model}`,
        {
          headers: {
            Authorization: `Bearer ${this.apiToken}`,
            "Content-Type": "application/json",
          },
          method: "POST",
          body: JSON.stringify(aiRequest),
        }
      )

      const result: { success: boolean; errors?: any[]; result: { response: string } } = await response.json() as { success: boolean; errors?: any[]; result: { response: string } }

      if (!result.success) {
        throw new Error(`CF AI Error: ${JSON.stringify(result.errors)}`)
      }

      // Cloudflare Workers AI 的标准返回路径
      let text = result.result.response
      
      if (text) {
        console.log(`Raw Cloudflare AI response [${caseId}]:\n`, text)
        
        try {
          const lines: string[] = text.split('\n').filter((line: string) => line.trim() !== '')
          const images: Array<{original_filename: string, new_filename: string, alt_zh: string, caption_zh: string}> = []
          
          // 使用 Set 防止文件名在同一批次中由于 AI 出错而重复
          const localUsedFiles = new Set<string>()

          for (const line of lines) {
            if (line.includes('|')) {
              // 去掉可能的前缀（如 "1. "）
              const cleanLine = line.replace(/^\d+\.\s*/, '')
              
              let [original_filename, new_filename, alt_zh, caption_zh] = cleanLine.split('|').map((item: string) => item.trim())
              
              if (original_filename && new_filename && alt_zh && caption_zh) {
                // 基础清洗：确保文件名后缀正确且无引号
                original_filename = original_filename.toLowerCase().replace(/["']/g, '')
                new_filename = new_filename.toLowerCase().replace(/["']/g, '')
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
                images.push({ original_filename, new_filename, alt_zh, caption_zh })
              }
            }
          }
            
          if (images.length > 0) {
            console.log(`✅ 成功解析 ${images.length} 张图片的差异化SEO数据`)
            return { images }
          }
        } catch (pipeError) {
          console.error(`🟡 解析逻辑异常:`, pipeError.message)
        }
        
        // 如果 AI 返回的数据不完整，使用默认方法生成
        const processedImages: any[] = []
        for (const origFilename of originalFilenames) {
          const newFile = origFilename.toLowerCase()
            .replace(/\.jpg$|\.jpeg$|\.png$|\.gif$/i, '.webp')
            .replace(/[^a-z0-9\-_\.]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '')
          
          const alt_zh = `${caseId.replace(/-/g, ' ')} 相关图片`
          const caption_zh = `${caseId.replace(/-/g, ' ')} 的相关图片`
          
          processedImages.push({
            original_filename: origFilename,
            new_filename: newFile,
            alt_zh: alt_zh,
            caption_zh: caption_zh
          })
        }
          
        if (processedImages.length > 0) {
          return { images: processedImages }
        }
      }
      return null
    } catch (e: any) {
      console.error(`❌ Cloudflare AI Error [${caseId}]:`, e.response?.data || e.message)
      const status = e.response?.status
      if (status === 503 || status === 429 || e.message.includes('quota')) return 'RETRY'
      return null
    }
  }
}