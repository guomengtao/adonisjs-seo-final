// @ts-nocheck
import { BaseCommand, args } from '@adonisjs/core/ace'
import db from '@adonisjs/lucid/services/db'
import env from '#start/env'

// 定义数据库查询结果类型
interface DbQueryResult<T> {
  rows: T[]
}

// 定义接口
interface AssetRow {
  new_filename: string
  alt_zh: string | null
  caption_zh: string | null
  width: number | null
  height: number | null
  is_primary: number
  sort_order: number
}

interface ImageInfo {
  url: string
  alt: string
  caption: string
  width: number
  height: number
  isPrimary: boolean
  sortOrder: number
}

interface Recommendation {
  case_id: string
  full_name: string
}

interface CaseInfo {
  id: number
  case_id: string
  full_name: string
  missing_state: string
  age_at_missing: number | null
  title: string
  case_summary: string
  url_path: string
  ai_status: number
  created_at: string
  updated_at: string
  prev_id: string | null
  next_id: string | null
  recommendations: Recommendation[] | null
}

export default class CaseView extends BaseCommand {
  static commandName = 'case:view'
  static description = '查看特定案件的详细信息，包括图片列表。默认显示随机案件，也可指定案件ID查看'
  static options = { startApp: true }

  // 使用args装饰器定义案件ID参数
  @args.string({
    required: false,
    description: '案件ID'
  })
  declare caseId?: string

  async run(): Promise<void> {
    try {
      console.log('🔍 正在查询案件信息...')
      
      let caseId: string
      
      // 使用args装饰器获取的参数
      if (this.caseId) {
        caseId = this.caseId
        console.log(`🔍 使用指定的案件ID: ${caseId}`)
      } else {
        // 否则获取一个随机案件ID
        console.log('🔍 正在随机获取一个案件...')
        const randomCaseResult = await db.rawQuery<DbQueryResult<{ case_id: string }>>(`
          SELECT case_id FROM missing_persons_info
          ORDER BY RANDOM()
          LIMIT 1
        `)
        
        if (randomCaseResult.rows.length === 0) {
          console.error('❌ 未找到任何案件')
          return
        }
        
        caseId = randomCaseResult.rows[0].case_id
      }
      
      console.log(`🔍 正在查询案件 ${caseId} 的信息...`)

      // 查询案件基本信息和相关数据
      const caseData = await db.rawQuery<DbQueryResult<CaseInfo>>(`
        WITH current_case AS (
          SELECT id, case_id, full_name, missing_state, age_at_missing, title, case_summary, url_path, ai_status, created_at, updated_at FROM missing_persons_info WHERE case_id = ?
        )
        SELECT
          c.*,
          (SELECT case_id FROM missing_persons_info WHERE id < c.id ORDER BY id DESC LIMIT 1) as prev_id,
          (SELECT case_id FROM missing_persons_info WHERE id > c.id ORDER BY id ASC LIMIT 1) as next_id,
          (SELECT jsonb_agg(r) FROM (
            SELECT case_id, full_name FROM missing_persons_info
            WHERE missing_state = c.missing_state AND case_id != c.case_id
            LIMIT 4
          ) r) as recommendations
        FROM current_case c
      `, [caseId])

      if (caseData.rows.length === 0) {
        console.error(`❌ 未找到案件 ${caseId}`)
        return
      }

      const caseInfo: CaseInfo = caseData.rows[0]

      // 查询所有图片信息
      const imageResult = await db.rawQuery<DbQueryResult<AssetRow>>(`
        SELECT new_filename, alt_zh, caption_zh, width, height, is_primary, sort_order
        FROM missing_persons_assets 
        WHERE case_id = ?
        ORDER BY sort_order ASC
      `, [caseId])

      const imgBaseUrl: string = env.get('IMG_BASE_URL', 'img.gudq.com')
      const images: ImageInfo[] = imageResult.rows.map((asset: AssetRow, index: number) => {
        // 构建正确的图片路径：/missing/州/县/城市/案件id/具体图片名
        const imagePath: string = `missing/${caseInfo.url_path}/${caseId}/${asset.new_filename}`
        return {
          url: `https://${imgBaseUrl}/${imagePath}`,
          alt: asset.alt_zh || '',
          caption: asset.caption_zh || '',
          width: asset.width || 0,
          height: asset.height || 0,
          isPrimary: asset.is_primary === 1,
          sortOrder: asset.sort_order
        }
      })

      // 输出案件基本信息
      console.log('✅ 案件信息查询成功！')
      console.log('\n📋 案件基本信息：')
      console.log(`案件 ID: ${caseInfo.case_id}`)
      console.log(`姓名: ${caseInfo.full_name}`)
      console.log(`失踪地点: ${caseInfo.missing_state}`)
      console.log(`失踪年龄: ${caseInfo.age_at_missing}`)
      console.log(`标题: ${caseInfo.title}`)
      console.log(`案件摘要: ${caseInfo.case_summary}`)
      console.log(`创建时间: ${new Date(caseInfo.created_at).toLocaleString()}`)
      console.log(`更新时间: ${new Date(caseInfo.updated_at).toLocaleString()}`)

      // 输出图片信息
      if (images.length > 0) {
        console.log(`\n🖼️  图片列表 (共 ${images.length} 张):`)
        images.forEach((image: ImageInfo, index: number) => {
          const primaryMark: string = image.isPrimary ? '⭐' : ''
          console.log(`${index + 1}. ${primaryMark} URL: ${image.url}`)
          console.log(`   替代文本: ${image.alt}`)
          console.log(`   说明文字: ${image.caption}`)
          console.log(`   尺寸: ${image.width}x${image.height}`)
        })
      } else {
        console.log('\n📷 该案件暂无图片')
      }

      // 输出相关推荐
      if (caseInfo.recommendations && caseInfo.recommendations.length > 0) {
        console.log('\n👥 相关推荐案件:')
        caseInfo.recommendations.forEach((rec: Recommendation, index: number) => {
          console.log(`${index + 1}. 案件 ID: ${rec.case_id} - ${rec.full_name}`)
        })
      }

      // 输出前后案件
      console.log('\n🔗 案件导航:')
      if (caseInfo.prev_id) {
        console.log(`上一个案件: ${caseInfo.prev_id}`)
      } else {
        console.log('上一个案件: 无')
      }
      if (caseInfo.next_id) {
        console.log(`下一个案件: ${caseInfo.next_id}`)
      } else {
        console.log('下一个案件: 无')
      }

    } catch (error: any) {
      console.error(`🚨 查询出错: ${error.message}`)
    }
  }
}