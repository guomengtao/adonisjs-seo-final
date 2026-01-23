import { BaseSchema } from '@adonisjs/lucid/schema'

export default class AddHfBackupIndex extends BaseSchema {
  protected tableName = 'missing_persons_assets'

  async up() {
    const hasIndex = await this.schema.hasIndex(this.tableName, 'missing_persons_assets_hf_backup_status_index')
    if (!hasIndex) {
      this.schema.table(this.tableName, (table) => {
        table.index(['hf_backup_status'], 'missing_persons_assets_hf_backup_status_index')
      })
    }
  }

  async down() {
    const hasIndex = await this.schema.hasIndex(this.tableName, 'missing_persons_assets_hf_backup_status_index')
    if (hasIndex) {
      this.schema.table(this.tableName, (table) => {
        table.dropIndex(['hf_backup_status'], 'missing_persons_assets_hf_backup_status_index')
      })
    }
  }
}