import { BaseSchema } from '@adonisjs/lucid/schema'

export default class AddHfBackupColumns extends BaseSchema {
  protected tableName = 'missing_persons_assets'

  async up() {
    const hasHfBackupStatus = await this.schema.hasColumn(this.tableName, 'hf_backup_status')
    if (!hasHfBackupStatus) {
      this.schema.alterTable(this.tableName, (table) => {
        table.integer('hf_backup_status').defaultTo(0).comment('0:未备份, 1:备份成功, 2:备份失败')
        table.string('hf_path').nullable().comment('Hugging Face存储路径')
      })
    }
  }

  async down() {
    const hasHfBackupStatus = await this.schema.hasColumn(this.tableName, 'hf_backup_status')
    if (hasHfBackupStatus) {
      this.schema.alterTable(this.tableName, (table) => {
        table.dropColumn('hf_backup_status')
        table.dropColumn('hf_path')
      })
    }
  }
}