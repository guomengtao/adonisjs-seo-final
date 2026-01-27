import { BaseCommand } from '@adonisjs/core/ace'
import fs from 'node:fs/promises'
import { join } from 'node:path'
import os from 'node:os'
import { Edge } from 'edge.js'
import app from '@adonisjs/core/services/app'

export default class GenerateSearchHtml extends BaseCommand {
  static commandName = 'generate:search-html'
  static description = 'Generate WeChat-friendly search page that uses existing search data'
  static options = { startApp: true }

  async run() {
    const BASE_SITE_ROOT = join(os.homedir(), 'Documents', 'html-save')
    
    // 支持的语言列表
    const supportedLanguages = ['zh', 'en', 'es']
    
    // 为每个语言版本生成搜索页面
    for (const lang of supportedLanguages) {
      const SITE_ROOT = join(BASE_SITE_ROOT, lang)
      const DIST_DIR = join(SITE_ROOT, 'dist')
      const SEARCH_DATA_FILE = join(DIST_DIR, 'search_local.txt')
      
      // 检查搜索数据文件是否存在
      try {
        await fs.access(SEARCH_DATA_FILE)
        this.logger.info(`✅ 找到搜索数据文件: ${SEARCH_DATA_FILE}`)
      } catch (error) {
        this.logger.warning(`⚠️  ${lang} 语言的搜索数据文件不存在，跳过该语言`)
        continue
      }
      
      // 创建Edge实例
      const edge = new Edge()
      edge.mount(app.viewsPath())
      
      // 根据语言设置页面标题
      let pageTitle: string
      switch (lang) {
        case 'zh':
          pageTitle = '案件搜索 - 失踪人员数据库'
          break
        case 'en':
          pageTitle = 'Case Search - Missing Persons Database'
          break
        case 'es':
          pageTitle = 'Búsqueda de Casos - Base de Datos de Personas Desaparecidas'
          break
        default:
          pageTitle = '案件搜索 - 失踪人员数据库'
      }
      
      // 使用search.edge模板生成搜索页面
      const html = await edge.render('search', {
        lang: lang,
        pageTitle: pageTitle,
        i18n: {
          formatMessage: (key: string) => {
            // 简单的翻译处理
            const translations: Record<string, Record<string, string>> = {
              'home': { 'zh': '首页', 'en': 'Home', 'es': 'Inicio' },
              'search': { 'zh': '搜索', 'en': 'Search', 'es': 'Buscar' },
              'missing_persons': { 'zh': '失踪人员', 'en': 'Missing Persons', 'es': 'Personas Desaparecidas' },
              'database': { 'zh': '数据库', 'en': 'Database', 'es': 'Base de Datos' }
            }
            return translations[key]?.[lang] || key
          }
        },
        process: { env: process.env }
      })
      
      // 保存搜索页面
      const searchPagePath = join(SITE_ROOT, 'search.html')
      await fs.writeFile(searchPagePath, html)
      
      this.logger.success(`✅ ${lang} 语言微信友好的搜索页面已生成：${searchPagePath}`)
      this.logger.info(`🌐 ${lang} 语言搜索页面地址：http://127.0.0.1:8080/${lang}/search.html`)
    }
  }
}