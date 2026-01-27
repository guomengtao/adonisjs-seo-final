import { BaseCommand } from '@adonisjs/core/ace'
import db from '@adonisjs/lucid/services/db'
import fs from 'node:fs/promises'
import { join } from 'node:path'
import os from 'node:os'
import { Edge } from 'edge.js'
import app from '@adonisjs/core/services/app'
import { readFileSync } from 'node:fs'

// 定义一个简化版的ExportStaticEnglishClear命令类，用于生成静态文件
export default class ExportStaticEnglishClear extends BaseCommand {
  static commandName = 'export:static-english-clear'
  static description = '导出英文简化版静态文件'
  static options = { startApp: true }

  async run() {
    this.logger.info('🔍 正在启动英文简化版静态文件导出...')
    
    // 设置基本路径
    const BASE_SITE_ROOT = join(os.homedir(), 'Documents', 'html-save', 'english-clear')
    
    // 创建Edge实例
    const edge = new Edge()
    edge.mount(app.viewsPath())
    
    // 查询所有有效的案件信息
    const cases = await db.from('missing_persons_info')
      .whereNotNull('path')
      .whereNotNull('full_name')
      .whereNotNull('case_id')
      .select('id', 'full_name', 'case_id', 'path')
    
    this.logger.info(`📋 找到 ${cases.length} 个符合条件的案件`)
    
    // 生成搜索页面使用search.edge模板
    this.logger.info('📄 正在生成搜索页面...')
    const html = await edge.render('search', {
      lang: 'en',
      urlPathSegments: [],
      translatedPathSegments: [],
      pageTitle: 'Search Missing Persons - Missing Persons Database',
      i18n: {
        formatMessage: (key: string) => {
          // 简单的翻译处理
          const translations: Record<string, string> = {
            'home': 'Home',
            'search': 'Search',
            'missing_persons': 'Missing Persons',
            'database': 'Database'
          }
          return translations[key] || key
        }
      },
      process: { env: process.env }
    })
    await fs.writeFile(join(BASE_SITE_ROOT, 'search.html'), html)
    
    this.logger.success('✅ 英文简化版静态文件导出完成！')
  }


}