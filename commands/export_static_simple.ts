import { BaseCommand, flags } from '@adonisjs/core/ace'
import { join, resolve } from 'node:path'
import db from '@adonisjs/lucid/services/db'
import { Edge } from 'edge.js'
import fs from 'node:fs/promises'

// 定义一个简化版的ExportStaticSimple命令类，用于生成静态文件
export default class ExportStaticSimple extends BaseCommand {
  static commandName = 'export:static-simple'
  static description = '简化版导出静态文件，专注于生成大量案件详情页'
  static options = { startApp: true }

  // 使用flags装饰器定义生成数量参数
  @flags.number({
    name: 'limit',
    alias: 'l',
    description: '生成的案件数量限制',
    default: 0
  })
  declare limit: number

  // 使用flags装饰器定义输出路径参数
  @flags.string({
    name: 'output',
    alias: 'o',
    description: '输出路径 (绝对路径)',
    required: false
  })
  declare output?: string

  // 使用flags装饰器定义并发数参数
  @flags.number({
    name: 'concurrency',
    alias: 'c',
    description: '并发处理数量 (1-100)',
    default: 20
  })
  declare concurrency: number

  // 使用flags装饰器定义是否跳过现有文件参数
  @flags.boolean({
    name: 'skip-existing',
    alias: 's',
    description: '跳过已存在的文件',
    default: false
  })
  declare skipExisting: boolean

  async run() {
    this.logger.info('🔍 正在启动简化版静态文件导出...')

    try {
      // 设置输出路径（确保为绝对路径）
      const BASE_SITE_ROOT = this.output ? resolve(this.output) : join(process.cwd(), 'site', 'en')
      this.logger.info(`💾 输出目录: ${BASE_SITE_ROOT}`)

      // 初始化模板引擎
      const edge = new Edge({ cache: true })
      edge.mount(join(process.cwd(), 'resources', 'views'))

      // 查询符合条件的案件总数
      this.logger.info('📊 正在查询符合条件的案件...')
      const totalQuery = db
        .from('missing_persons_info')
        .whereNotNull('path')
        .whereNotNull('full_name')
        .whereNotNull('case_id')
        .groupBy('case_id')
      
      const totalCount = await totalQuery.count('case_id as total').first()
      const total = totalCount ? Number(totalCount.total) : 0
      
      this.logger.info(`📋 找到 ${total} 个符合条件的案件`)

      // 查询需要处理的案件
      const query = db
        .from('missing_persons_info')
        .select('path', 'full_name', 'case_id', 'state_zh', 'county_zh', 'city_zh')
        .whereNotNull('path')
        .whereNotNull('full_name')
        .whereNotNull('case_id')
        .groupBy(['case_id', 'path', 'full_name', 'state_zh', 'county_zh', 'city_zh'])

      if (this.limit > 0) {
        query.limit(this.limit)
      }

      const cases = await query
      
      if (cases.length === 0) {
        this.logger.warning('⚠️  未找到符合条件的案件')
        return
      }

      this.logger.info(`🚀 开始生成 ${cases.length} 个案件详情页...`)

      // 生成案件详情页
      let successCount = 0
      let errorCount = 0
      let processedCount = 0
      
      const startTime = Date.now()
      
      // 定义并发处理函数
      const processCase = async (record: any) => {
        try {
          // 查询案件的完整信息
          const caseDetail = await db.from('missing_persons_cases')
            .where('case_id', record.case_id)
            .first()
          
          if (!caseDetail) {
            this.logger.warning(`⚠️  未找到案件 ${record.case_id} 的详细信息，跳过处理`)
            errorCount++
            return
          }
          
          // 查询图片信息
          const images = await db.from('missing_persons_assets')
            .where('case_id', record.case_id)
            .where('ai_processed', 200)
            .select('*')
          
          // 查询标签信息（使用JOIN优化查询性能）
          const tags = await db.from('missing_persons_tags')
            .join('missing_persons_tag_relations', 'missing_persons_tag_relations.tag_id', '=', 'missing_persons_tags.id')
            .select('missing_persons_tags.*')
            .where('missing_persons_tag_relations.case_id', record.case_id)
          
          // 生成详情页
          const html = await edge.render('case_detail', {
            missingCase: {
              ...caseDetail,
              ...record,
              name: record.full_name,
              summary: record.full_name + ' missing case details',
              ai_model: 'gemini',
              created_at: new Date(caseDetail?.created_at || Date.now()),
              updated_at: new Date(caseDetail?.updated_at || Date.now())
            },
            images: images,
            tags: tags.map(tag => ({
              ...tag,
              slug: tag.name?.toLowerCase().replace(/\s+/g, '-') || ''
            })),
            lang: 'en',
            urlPathSegments: record.path.split('/'),
            process: { env: process.env }
          })
          
          // 创建输出目录
          const caseDir = join(BASE_SITE_ROOT, record.path)
          await fs.mkdir(caseDir, { recursive: true })
          
          // 检查文件是否已存在
          const htmlPath = join(caseDir, `${record.case_id}.html`)
          
          if (this.skipExisting) {
            try {
              await fs.access(htmlPath)
              return
            } catch (e) {
              // 文件不存在，继续处理
            }
          }
          
          await fs.writeFile(htmlPath, html)
          
          successCount++
          
        } catch (error) {
          this.logger.error(`❌ 处理案件 ${record.case_id} 时出错: ${error.message}`)
          errorCount++
        } finally {
          processedCount++
          
          // 每生成100个文件输出一次进度
          if (processedCount % 100 === 0) {
            const elapsedTime = (Date.now() - startTime) / 1000
            const speed = processedCount / elapsedTime
            this.logger.info(`📊 进度: ${processedCount}/${cases.length} (${((processedCount / cases.length) * 100).toFixed(1)}%) | 速度: ${speed.toFixed(1)} 文件/秒`)
          }
        }
      }
      
      // 并发处理案件
      const concurrency = Math.max(1, Math.min(100, this.concurrency)) // 限制并发数在1-100之间
      this.logger.info(`🔄 使用并发数: ${concurrency} 进行处理`)
      
      for (let i = 0; i < cases.length; i += concurrency) {
        const batch = cases.slice(i, i + concurrency)
        await Promise.all(batch.map(processCase))
      }
      
      // 生成总结报告
      this.logger.info('\n📋 导出完成！')
      this.logger.success(`✅ 成功生成 ${successCount} 个案件详情页`)
      
      if (errorCount > 0) {
        this.logger.warning(`⚠️  处理失败 ${errorCount} 个案件`)
      }
      
      this.logger.info(`💾 输出目录: ${BASE_SITE_ROOT}`)
      
      // 计算总耗时
      const endTime = Date.now()
      const totalTime = (endTime - startTime) / 1000
      const averageSpeed = successCount / totalTime
      
      this.logger.info(`⏱️  总耗时: ${totalTime.toFixed(2)} 秒`)
      this.logger.info(`⚡ 平均速度: ${averageSpeed.toFixed(1)} 文件/秒`)
      this.logger.info(`📊 符合条件的案件总数: ${total}`)
    } catch (error) {
      this.logger.error(`❌ 导出过程中发生错误: ${error.message}`)
    }
  }
  
  // 统计生成的HTML文件数量
  private async countGeneratedFiles(directory: string): Promise<number> {
    let count = 0
    
    async function traverse(dir: string) {
      const entries = await fs.readdir(dir, { withFileTypes: true })
      
      for (const entry of entries) {
        const fullPath = join(dir, entry.name)
        
        if (entry.isDirectory()) {
          await traverse(fullPath)
        } else if (entry.isFile() && entry.name.endsWith('.html')) {
          count++
        }
      }
    }
    
    await traverse(directory)
    return count
  }
}