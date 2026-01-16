import { BaseCommand } from '@adonisjs/core/ace'
import db from '@adonisjs/lucid/services/db'
import { Edge } from 'edge.js'
import fs from 'node:fs/promises'
import { join } from 'node:path'
import os from 'node:os'
import app from '@adonisjs/core/services/app'

export default class ExportStatic extends BaseCommand {
  static commandName = 'export:static'
  static options = { startApp: true }

  async run() {
    const edge = new Edge()
    edge.mount(app.viewsPath())

    const SITE_ROOT = join(os.homedir(), 'Documents', 'test-save')
    const SITE_URL = 'https://cn.miissing.gudq.com'

    // 核心存储结构
    const stateGroups: Record<string, Set<string>> = {} // { 'california': Set(['san-mateo/san-mateo', ...]) }
    const cityGroups: Record<string, any[]> = {}       // { 'california/san-mateo/san-mateo': [案件列表] }

    const cases = await db
      .from('missing_persons_cases as c')
      .join('missing_persons_info as i', 'c.case_id', 'i.case_id')
      .select('c.*', 'i.url_path')
      .whereIn('c.case_id', db.from('missing_persons_assets').where('ai_processed', 200).distinct('case_id'))

    this.logger.info(`🔍 处理 ${cases.length} 个案件并构建全站索引...`)

    const sitemapLinks: string[] = []

    // 1. 生成详情页并聚合数据
    for (const record of cases) {
      const images = await db.from('missing_persons_assets').where('case_id', record.case_id).where('ai_processed', 200)
      
      const relativePath = record.url_path.replace(/^case\//i, '').toLowerCase()
      const stateName = relativePath.split('/')[0] // 提取州名

      // 聚合：州 -> 城市路径
      if (!stateGroups[stateName]) stateGroups[stateName] = new Set()
      stateGroups[stateName].add(relativePath)

      // 聚合：城市路径 -> 案件
      if (!cityGroups[relativePath]) cityGroups[relativePath] = []
      cityGroups[relativePath].push({ id: record.case_id, name: record.full_name, date: record.missing_date, file: `${record.case_id}.html` })

      // 生成详情页
      const html = await edge.render('case_page', { record, images, relativePath })
      const finalDir = join(SITE_ROOT, relativePath)
      await fs.mkdir(finalDir, { recursive: true })
      await fs.writeFile(join(finalDir, `${record.case_id}.html`), html)
      sitemapLinks.push(`${relativePath}/${record.case_id}.html`)
    }

    // 2. 生成【城市索引页】
    for (const [path, members] of Object.entries(cityGroups)) {
      const html = await edge.render('city_index', { 
        path, 
        cases: members.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
        cityName: path.split('/').pop()?.toUpperCase()
      })
      await fs.writeFile(join(SITE_ROOT, path, 'index.html'), html)
      sitemapLinks.push(`${path}/index.html`)
    }

    // 3. 生成【州级汇总页】
    for (const [state, cities] of Object.entries(stateGroups)) {
      const html = await edge.render('state_index', { 
        stateName: state.toUpperCase(),
        cities: Array.from(cities) 
      })
      await fs.mkdir(join(SITE_ROOT, state), { recursive: true })
      await fs.writeFile(join(SITE_ROOT, state, 'index.html'), html)
      sitemapLinks.push(`${state}/index.html`)
    }

    // 4. 生成【首页】
    const homeHtml = await edge.render('home', { states: Object.keys(stateGroups) })
    await fs.writeFile(join(SITE_ROOT, 'index.html'), homeHtml)
    sitemapLinks.push('')

    await this.generateSitemap(SITE_ROOT, sitemapLinks, SITE_URL)
    this.logger.success('🚀 首页、州、城市、详情页全链路生成成功！')
  }

  private async generateSitemap(targetBase: string, links: string[], baseUrl: string) {
    const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      ${links.map(link => `<url><loc>${baseUrl}/${link}</loc></url>`).join('')}</urlset>`
    await fs.writeFile(join(targetBase, 'sitemap.xml'), xml)
  }
}