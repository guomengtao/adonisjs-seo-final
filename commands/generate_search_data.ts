import { BaseCommand } from '@adonisjs/core/ace'
import db from '@adonisjs/lucid/services/db'
import fs from 'node:fs/promises'
import { join } from 'node:path'
import os from 'node:os'

export default class GenerateSearchData extends BaseCommand {
  static commandName = 'generate:search-data'
  static description = 'Generate search data file for all cases'
  static options = { startApp: true }

  async run() {
    const BASE_SITE_ROOT = join(os.homedir(), 'Documents', 'html-save')
    
    // 支持的语言列表
    const supportedLanguages = ['zh', 'en', 'es']
    
    // 查询所有 path 不为空的案件，确保每个案件只出现一次
    const cases = await db.from('missing_persons_info')
      .whereNotNull('path')
      .whereNotNull('full_name')
      .whereNotNull('case_id')
      .distinct('case_id') // 按 case_id 去重
      .select('id', 'full_name', 'case_id', 'path')
    
    this.logger.info(`🔍 找到 ${cases.length} 个符合条件的案件（path 不为空）`)
    
    // 为每个语言版本生成搜索数据文件
    for (const lang of supportedLanguages) {
      const SITE_ROOT = join(BASE_SITE_ROOT, lang)
      const DIST_DIR = join(SITE_ROOT, 'dist')
      
      // 生成搜索数据
      const searchData = cases
        .map(c => `${c.full_name}|${c.case_id}|${c.path.replace(/^case\//i, '')}`)
        .join('\n')
      
      // 创建 dist 目录
      await fs.mkdir(DIST_DIR, { recursive: true })
      
      // 保存搜索数据文件
      const searchFilePath = join(DIST_DIR, 'search_local.txt')
      await fs.writeFile(searchFilePath, searchData)
      
      this.logger.success(`✅ ${lang} 语言搜索数据文件已生成：${searchFilePath}`)
    }
    
    this.logger.info(`📋 共包含 ${cases.length} 个案件信息`)
    this.logger.info(`💾 文件格式：案件名称|案件ID|案件路径`)
    this.logger.info(`💡 运行 generate:search-html 命令生成搜索页面`)
  }
}