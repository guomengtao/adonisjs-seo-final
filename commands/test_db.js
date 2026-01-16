import { BaseCommand } from '@adonisjs/core/ace'
import db from '@adonisjs/lucid/services/db'

export default class TestDb extends BaseCommand {
  static commandName = 'test:db'
  static options = { startApp: true }

  async run() {
    this.logger.info('测试数据库连接...')
    
    try {
      // 查询指定案件的资产数据
      const assets = await db.from('missing_persons_assets')
        .where('case_id', 'alan-rhys-dowden')
        .select('id', 'case_id', 'new_filename', 'alt_zh', 'caption_zh', 'ai_processed')
      
      this.logger.info('\n查询结果:')
      this.logger.info(JSON.stringify(assets, null, 2))
      
      // 检查是否有数据被正确更新
      const updatedAssets = assets.filter(asset => asset.ai_processed === 200 && asset.alt_zh && asset.caption_zh)
      this.logger.info(`\n已更新的资产数量: ${updatedAssets.length}`)
      
      if (updatedAssets.length > 0) {
        this.logger.success('✅ 数据已成功写入 missing_persons_assets 表')
      } else {
        this.logger.error('❌ 未找到已更新的数据')
      }
      
    } catch (error) {
      this.logger.error('数据库操作失败:', error.message)
    }
  }
}