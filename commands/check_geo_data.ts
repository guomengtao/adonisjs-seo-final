import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import db from '@adonisjs/lucid/services/db'

export default class CheckGeoData extends BaseCommand {
  static commandName = 'check:geo-data'
  static description = '检查geo_translations表的内容'

  static options: CommandOptions = {}

  async run() {
    this.logger.info('🔍 检查geo_translations表的内容...')

    // 查看所有数据的基本信息
    this.logger.info('📋 geo_translations表数据示例：')
    const allData = await db.from('geo_translations').limit(10)
    allData.forEach((item: any) => {
      this.logger.info(`  ID: ${item.id}, FIPS代码: ${item.fips_code}, Geoname ID: ${item.geoname_id}, 名称: ${item.en_name}, 类型: ${item.geo_type}, Slug: ${item.slug}`)
    })

    this.logger.info('\n✅ 检查完成！')
  }
}