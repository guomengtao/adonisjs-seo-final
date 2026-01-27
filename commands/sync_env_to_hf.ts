import { BaseCommand } from '@adonisjs/core/ace'
import { uploadFiles } from '@huggingface/hub'
import fs from 'node:fs'
import path from 'node:path'
import env from '#start/env'

export default class SyncEnvToHf extends BaseCommand {
  static commandName = 'sync:hf-env'
  static description = '将本地 .env 内容安全同步到 Hugging Face Space Secrets'

  async run() {
    // 1. 动态获取配置，不留硬编码
    // HF_TOKEN 需要在本地 .env 中配置，或者运行时输入
    const token = env.get('HF_TOKEN') || await this.prompt.ask('请输入 Hugging Face Write Token (或在本地.env配置HF_TOKEN)')
    
    // HF_REPO_ID 也可以配在 .env 里，格式为 "用户名/仓库名"
    const repoId = env.get('HF_REPO_ID') || await this.prompt.ask('请输入 HF Space 仓库 ID (例如: username/space-name)')

    if (!token || !repoId) {
      this.logger.error('❌ 缺少必要参数，同步取消')
      return
    }

    // 2. 读取并解析本地 .env
    const envPath = path.resolve(process.cwd(), '.env')
    if (!fs.existsSync(envPath)) {
      this.logger.error('❌ 目录下未找到 .env 文件')
      return
    }

    // 手动解析 .env 文件内容
    const envContent = fs.readFileSync(envPath, 'utf-8')
    const envConfig: Record<string, string> = {}
    
    envContent.split('\n').forEach(line => {
      // 忽略空行和注释
      if (line.trim() && !line.startsWith('#')) {
        const [key, ...valueParts] = line.split('=')
        const value = valueParts.join('=').trim()
        // 移除引号
        const cleanedValue = value.replace(/^['"](.*)['"]$/, '$1')
        envConfig[key.trim()] = cleanedValue
      }
    })
    
    // 3. 过滤需要同步的 Key
    const keysToSync = Object.keys(envConfig).filter(key => {
      // 过滤掉本地运行专用的、或是同步脚本自身的变量
      const skipList = ['PORT', 'HOST', 'LOG_LEVEL', 'HF_TOKEN', 'HF_REPO_ID']
      return !skipList.includes(key)
    })

    this.logger.info(`🚀 准备同步 ${keysToSync.length} 个变量到 ${repoId}...`)

    // 4. 执行同步（使用uploadFiles API）
    try {
      await uploadFiles({
        repo: { type: 'space', name: repoId },
        accessToken: token,
        files: keysToSync.map((key) => ({
          path: `secrets/${key}`,
          content: new Blob([envConfig[key]], { type: 'text/plain' })
        }))
      })
      this.logger.success(`✅ 成功同步 ${keysToSync.length} 个变量到 ${repoId}`)
    } catch (error: any) {
      this.logger.error(`❌ 同步失败: ${error.message}`)
      return
    }

    this.logger.success('\n🏁 配置同步任务结束！Space 正在应用更改并准备重启。')
  }
}