import { commit } from '@huggingface/hub'
import env from '#start/env'

export interface HfFile {
  path: string
  content: Blob
}

export default class HfService {
  private static repo = 'mengtaoguo/missing-persons-assets'
  private static token = env.get('HF_TOKEN')

   public static async batchUpload(files: HfFile[], commitMessage: string) {
    if (files.length === 0) return

    try {
      await commit({
        repo: { type: 'dataset', name: this.repo },
        accessToken: this.token,
        title: commitMessage,
        operations: files.map((file) => ({
          // ⚠️ 关键修改：把 'add' 改为 'addOrUpdate'
          // 这既解决了报错，又支持了“幂等性”（即使重传也不会炸）
          operation: 'addOrUpdate', 
          path: file.path,
          content: file.content,
        })),
      })
      return true
    } catch (error) {
      console.error('❌ HF 批量上传失败详情:', error)
      // 这里的 throw 建议暂时注释掉，防止 HF 报错打断你 B2 的后续上传
      // throw error 
    }
  }
}