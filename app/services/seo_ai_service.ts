import { GoogleGenerativeAI } from '@google/generative-ai'
import env from '#start/env'

export default class SeoAiService {
  // 1. 确保读取的变量名与 .env 一致
  private static API_KEY = env.get('GEMINI_API_KEY') || env.get('GOOGLE_API_KEY')
  private static genAI = new GoogleGenerativeAI(this.API_KEY)
  
  /**
   * 关键：锁定 models/gemma-3-4b (1.4W RPD)
   * 4b 是 Gemma 3 的核心型号，处理速度快且配额充足
   */
//   private static model = this.genAI.getGenerativeModel({ model: "models/gemma-3-4b" })

  // ✅ 修正点：使用 Gemma 2 的 9B 指令微调版 (Instruction Tuned)
// 1. 加上 models/ 前缀
// 2. 加上 -it 后缀 (这非常关键！)
// 3. 使用 gemma-2 (目前 API 最稳定的版本)
private static model = this.genAI.getGenerativeModel({ model: "models/gemma-2-9b-it" })

  public static async analyze(caseId: string, content: string, originalFilenames: string[]): Promise<{ images: Array<{original_filename: string, new_filename: string, alt_zh: string, caption_zh: string}> } | null | 'RETRY'> {
    try {
      console.log(`🚀 发送 Gemma-3 (1.4W/天配额) 分析请求 [${caseId}]...`)

      const prompt = `你是一位顶级的Google SEO专家。请根据以下内容生成图片SEO数据：
      内容：${content.substring(0, 1000)}
      原始文件：${originalFilenames.join(', ')}
      格式要求：original_filename|new_filename|alt_zh|caption_zh
      规则：全小写英文文件名、中文Alt/Caption、严禁Markdown。`

      const result = await this.model.generateContent(prompt)
      const text = result.response.text()

      if (text) {
        console.log(`Raw Gemma response [${caseId}]:\n`, text)
        const lines = text.split('\n').filter(line => line.includes('|'))
        const images: any[] = []
        for (const line of lines) {
          let [orig, newFile, alt, cap] = line.split('|').map(i => i.trim())
          if (orig && newFile && alt && cap) {
            newFile = newFile.toLowerCase().replace(/["']/g, '')
            if (!newFile.endsWith('.webp')) newFile += '.webp'
            images.push({ original_filename: orig, new_filename: newFile, alt_zh: alt, caption_zh: cap })
          }
        }
        if (images.length > 0) return { images }
      }
      return null
    } catch (e: any) {
      console.error(`❌ Gemma Error [${caseId}]:`, e.message)
      // 处理配额限制重试
      if (e.message.includes('429') || e.message.includes('503') || e.message.includes('quota')) return 'RETRY'
      return null
    }
  }
}