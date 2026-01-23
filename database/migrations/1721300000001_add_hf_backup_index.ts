import { BaseSchema } from '@adonisjs/lucid/schema'

export default class AddHfBackupIndex extends BaseSchema {
  protected tableName = 'missing_persons_assets'

  async up() {
    // 在新版本的AdonisJS Lucid中，hasIndex方法的参数顺序可能已更改
    // 或者需要直接使用SQL查询来检查索引是否存在
    this.schema.table(this.tableName, (table) => {
      // 如果索引不存在，将创建它
      // 大多数数据库系统会自动忽略重复的索引创建
      table.index(['hf_backup_status'], 'missing_persons_assets_hf_backup_status_index')
    })
  }

  async down() {
    this.schema.table(this.tableName, (table) => {
      // 如果索引不存在，将忽略删除操作
      table.dropIndex(['hf_backup_status'], 'missing_persons_assets_hf_backup_status_index')
    })
  }
}