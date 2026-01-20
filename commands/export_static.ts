import { BaseCommand, args } from '@adonisjs/core/ace'
import { flags } from '@adonisjs/ace'
import db from '@adonisjs/lucid/services/db'
import fs from 'node:fs/promises'
import { join } from 'node:path'
import os from 'node:os'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { Edge } from 'edge.js'
import app from '@adonisjs/core/services/app'
import { readFileSync } from 'node:fs'

export default class ExportStatic extends BaseCommand {
  static commandName = 'export:static'
  static description = '导出静态文件，支持指定案件ID或数量生成详情页'
  static options = { startApp: true }

  // 使用args装饰器定义案件ID或名称参数
  @args.string({
    required: false,
    description: '案件ID或名称，用于指定生成特定案件的详情页'
  })
  declare caseId?: string

  // 使用flags装饰器定义生成数量参数
  @flags.number({
    name: 'limit',
    alias: 'l',
    description: '指定生成的详情页数量',
    default: 1
  })
  declare limit: number

  // 使用flags装饰器定义是否启动本地预览服务器参数
  @flags.boolean({
    name: 'serve',
    alias: 's',
    description: '是否启动本地预览服务器',
    default: false
  })
  declare serve: boolean

  // 使用flags装饰器定义语言参数
  @flags.string({
    name: 'language',
    alias: 'lang',
    description: '指定生成的语言版本 (zh/en/es)',
    default: 'zh'
  })
  declare language: string

  async run() {
    // 支持的语言列表
    const supportedLanguages = ['zh', 'en', 'es']
    
    // 验证语言参数
    if (!supportedLanguages.includes(this.language)) {
      this.logger.error(`❌ 无效的语言参数: ${this.language}`)
      this.logger.error(`✅ 支持的语言: ${supportedLanguages.join(', ')}`)
      return
    }
    
    // 设置当前生成的语言
    const currentLanguage = this.language
    
    // 创建Edge实例并挂载views目录
    const edge = new Edge()
    edge.mount(app.viewsPath())
    edge.mount('/Users/Banner/Documents/temp-seo-fix/resources/views')

    const BASE_SITE_ROOT = join(os.homedir(), 'Documents', 'html-save')
    const LOCAL_PORT = 3000
    const LOCAL_BASE_URL = `http://localhost:${LOCAL_PORT}`

    // 核心存储结构
    const stateGroups: Record<string, Set<string>> = {} // { 'california': Set(['san-mateo/san-mateo', ...]) }
    const cityGroups: Record<string, any[]> = {}       // { 'california/san-mateo/san-mateo': [案件列表] }
    const generatedUrls: string[] = []                 // 存储生成的所有URL

    // 构建查询
    let query = db
      .from('missing_persons_cases as c')
      .join('missing_persons_info as i', 'c.case_id', 'i.case_id')
      .select('c.*', 'i.url_path', 'i.full_name', 'i.missing_state')

    // 如果提供了案件ID或名称，只处理该案件
    const caseIdValue = this.caseId
    if (caseIdValue) {
      query = query.where((builder) => {
        builder.where('c.case_id', caseIdValue)
          .orWhere('i.full_name', 'like', `%${caseIdValue}%`)
      })
    } else {
      // 如果没有提供案件ID，只处理有图片的案件，并限制数量
      query = query
        .whereIn('c.case_id', db.from('missing_persons_assets').where('ai_processed', 200).distinct('case_id'))
        .limit(this.limit)
    }

    const cases = await query

    this.logger.info(`🔍 处理 ${cases.length} 个案件并构建全站索引...`)

    const sitemapLinks: string[] = []  // 存储sitemap链接

    // 加载翻译文件
    const headerTranslations = JSON.parse(readFileSync(join(app.viewsPath(), '_header.json'), 'utf-8'))

    // 1. 生成详情页并聚合数据
    for (const record of cases) {
      // 查询图片信息（允许没有图片）
      const images = await db.from('missing_persons_assets').where('case_id', record.case_id).where('ai_processed', 200).select('*')
      
      // 检查record.url_path是否存在
      if (!record.url_path) {
        this.logger.warning(`⚠️  案件 ${record.case_id} 缺少url_path字段，跳过处理`)
        continue
      }
      
      // 处理url_path
      const urlPath = String(record.url_path)
      const cleanedPath = urlPath.replace(/^case\//i, '')
      const relativePath = cleanedPath.toLowerCase()
      const stateName = relativePath.split('/')[0] // 提取州名

      // 聚合：州 -> 城市路径
      if (!stateGroups[stateName]) {
        stateGroups[stateName] = new Set()
      }
      stateGroups[stateName].add(relativePath)

      // 聚合：城市路径 -> 案件
      if (!cityGroups[relativePath]) {
        cityGroups[relativePath] = []
      }
      cityGroups[relativePath].push({
        id: record.case_id,
        name: record.full_name,
        date: record.missing_date,
        file: `${record.case_id}.html`
      })

      // 查询案件的标签数据（只获取与当前案件相关的标签）
      const tagRelations = await db.from('missing_persons_tag_relations')
        .where('case_id', record.case_id)
        .select('tag_id')
      
      // 提取标签ID
      const tagIds = tagRelations.map(relation => relation.tag_id)
      
      // 查询这些标签的详细信息
      const tags = tagIds.length > 0 
        ? await db.from('missing_persons_tags').whereIn('id', tagIds).select('*')
        : []
      
      // 为指定语言生成详情页
      const SITE_ROOT = join(BASE_SITE_ROOT, currentLanguage)
      
      // 生成详情页使用新的case_detail.edge模板
      const html = await edge.render('case_detail', {
        missingCase: {
          ...record,
          name_zh: record.full_name,
          name_en: record.full_name,
          name_es: record.full_name,
          summary_zh: record.full_name + '的失踪案件详情',
          summary_en: record.full_name + ' missing case details',
          summary_es: record.full_name + ' detalles del caso de desaparición',
          ai_model: 'gemini',
          created_at: new Date(record.created_at),
          updated_at: new Date(record.updated_at)
        },
        images: images,
        tags: tags.map(tag => {
          // 根据当前语言选择标签名称
          const tagName = tag[`name_${currentLanguage}`] || tag.name || '';
          return {
            ...tag,
            // 确保name_zh、name_en、name_es字段使用数据库中的值
            // 不需要手动设置，因为已经从数据库中查询到了
            slug: tagName.toLowerCase().replace(/\s+/g, '-'),
            cases_count: tag.cases_count || 1
          };
        }),
        lang: currentLanguage,
        i18n: {
          formatMessage: (key: string) => {
            // 从键名中提取实际的翻译键（移除'ui.'前缀）
            const actualKey = key.replace('ui.', '')
            
            // 检查翻译文件中是否包含该键
            if (headerTranslations[actualKey]) {
              return headerTranslations[actualKey][currentLanguage] || key
            } else {
              // 如果没有找到翻译，返回键名作为默认值
              return key
            }
          }
        },
        process: { env: process.env }
      })
      
      const finalDir = join(SITE_ROOT, relativePath)
      await fs.mkdir(finalDir, { recursive: true })
      await fs.writeFile(join(finalDir, `${record.case_id}.html`), html)
      sitemapLinks.push(`${relativePath}/${record.case_id}.html`)
      
      // 存储生成的详情页URL
      const caseUrl = `${LOCAL_BASE_URL}/${relativePath}/${record.case_id}.html`
      generatedUrls.push(caseUrl)
    }

    // 如果没有提供案件ID参数，才生成索引页和首页
    if (!this.caseId) {
      const SITE_ROOT = join(BASE_SITE_ROOT, currentLanguage)
      const SITE_URL = `https://${currentLanguage}.miissing.gudq.com`
      
      // 2. 生成【城市索引页】
      for (const [path, members] of Object.entries(cityGroups)) {
        // 生成简单的城市索引页HTML
        const cityIndexHtml = `
<!DOCTYPE html>
<html lang="${currentLanguage}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${path.split('/').pop()?.toUpperCase()} - ${currentLanguage === 'zh' ? '城市索引' : currentLanguage === 'en' ? 'City Index' : 'Índice de Ciudad'}</title>
</head>
<body>
    <h1>${path.split('/').pop()?.toUpperCase()} - ${currentLanguage === 'zh' ? '城市索引' : currentLanguage === 'en' ? 'City Index' : 'Índice de Ciudad'}</h1>
    <ul>
        ${members.map(c => `<li><a href="${c.file}">${c.name}</a> - ${c.date}</li>`).join('')}
    </ul>
</body>
</html>
        `
        await fs.writeFile(join(SITE_ROOT, path, 'index.html'), cityIndexHtml)
        sitemapLinks.push(`${path}/index.html`)
        
        // 存储生成的城市索引页URL
        const cityUrl = `${LOCAL_BASE_URL}/${path}/index.html`
        generatedUrls.push(cityUrl)
      }

      // 3. 生成【州级汇总页】
      for (const [state, cities] of Object.entries(stateGroups)) {
        // 生成简单的州级汇总页HTML
        const stateIndexHtml = `
<!DOCTYPE html>
<html lang="${currentLanguage}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${state.toUpperCase()} - ${currentLanguage === 'zh' ? '州级汇总' : currentLanguage === 'en' ? 'State Summary' : 'Resumen Estatal'}</title>
</head>
<body>
    <h1>${state.toUpperCase()} - ${currentLanguage === 'zh' ? '州级汇总' : currentLanguage === 'en' ? 'State Summary' : 'Resumen Estatal'}</h1>
    <ul>
        ${Array.from(cities).map(city => `<li><a href="${city}/index.html">${city}</a></li>`).join('')}
    </ul>
</body>
</html>
        `
        await fs.mkdir(join(SITE_ROOT, state), { recursive: true })
        await fs.writeFile(join(SITE_ROOT, state, 'index.html'), stateIndexHtml)
        sitemapLinks.push(`${state}/index.html`)
        
        // 存储生成的州级汇总页URL
        const stateUrl = `${LOCAL_BASE_URL}/${state}/index.html`
        generatedUrls.push(stateUrl)
      }

      // 4. 生成【首页】
      // 生成简单的首页HTML
      const homeHtml = `
<!DOCTYPE html>
<html lang="${currentLanguage}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${currentLanguage === 'zh' ? '首页' : currentLanguage === 'en' ? 'Home' : 'Inicio'}</title>
</head>
<body>
    <h1>${currentLanguage === 'zh' ? '首页' : currentLanguage === 'en' ? 'Home' : 'Inicio'}</h1>
    <ul>
        ${Object.keys(stateGroups).map(state => `<li><a href="${state}/index.html">${state.toUpperCase()}</a></li>`).join('')}
    </ul>
</body>
</html>
      `
      await fs.writeFile(join(SITE_ROOT, 'index.html'), homeHtml)
      sitemapLinks.push('')
      
      // 存储生成的首页URL
      generatedUrls.push(`${LOCAL_BASE_URL}/`)
      
      // 生成搜索索引文件
      const searchIndex = cases
        .filter(c => c.full_name && c.url_path)
        .map(c => `${c.full_name}|${c.url_path.replace(/^case\//i, '')}`)
        .join('\n')
      await fs.writeFile(join(SITE_ROOT, 'search_data.txt'), searchIndex)
      
      await this.generateSitemap(SITE_ROOT, sitemapLinks, SITE_URL)
    }

    // 打印生成的所有URL
    this.logger.info(`📋 ${currentLanguage.toUpperCase()} 语言生成的本地预览URL：`)
    this.logger.info('='.repeat(60))
    generatedUrls.forEach(url => {
      this.logger.info(`🔗 ${url}`)
    })
    this.logger.info('='.repeat(60))
    this.logger.info(`🔍 ${currentLanguage.toUpperCase()} 语言搜索索引文件已生成：search_data.txt`)
    
    // 如果指定了serve参数，启动本地预览服务器
    if (this.serve) {
      const serveRootDir = join(BASE_SITE_ROOT, currentLanguage)
      this.startLocalServer(serveRootDir, LOCAL_PORT)
      this.logger.success(`🚀 首页、州、城市、详情页全链路生成成功！\n🌐 本地预览服务器已启动（${currentLanguage.toUpperCase()}）：${LOCAL_BASE_URL}`)
    } else {
      this.logger.info(`📋 生成的文件保存在：${join(BASE_SITE_ROOT, currentLanguage)}`)
      this.logger.info(`💡 提示：使用 --serve 或 -s 参数可启动本地预览服务器`)
      this.logger.success(`🚀 首页、州、城市、详情页全链路生成成功！`)
    }
  }
  
  /**
   * 启动本地web服务器
   */
  private startLocalServer(rootDir: string, port: number) {
    const server = createServer(async (req, res) => {
      // 处理请求路径
      let filePath = req.url === '/' ? '/index.html' : req.url
      let fullPath = join(rootDir, filePath!)
      
      try {
        // 读取文件内容
        const content = await readFile(fullPath, 'utf8')
        
        // 设置响应头
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(content)
      } catch (error) {
        // 处理文件不存在的情况
        res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end('<h1>404 Not Found</h1><p>页面不存在</p>')
      }
    })
    
    // 启动服务器
    server.listen(port, () => {
      // 服务器启动成功，不输出额外信息（避免重复）
    })
    
    // 监听服务器错误
    server.on('error', (err) => {
      if (err.message.includes('EADDRINUSE')) {
        this.logger.warning(`⚠️  端口 ${port} 已被占用，正在尝试使用端口 ${port + 1}...`)
        // 尝试使用下一个端口
        server.close()
        this.startLocalServer(rootDir, port + 1)
      } else {
        this.logger.error(`❌ 服务器启动失败: ${err.message}`)
      }
    })
  }

  private async generateSitemap(targetBase: string, links: string[], baseUrl: string) {
    const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      ${links.map(link => `<url><loc>${baseUrl}/${link}</loc></url>`).join('')}</urlset>`
    await fs.writeFile(join(targetBase, 'sitemap.xml'), xml)
  }
}