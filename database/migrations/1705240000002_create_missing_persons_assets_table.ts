import { BaseSchema } from '@adonisjs/lucid/schema'

export default class CreateMissingPersonsAssetsTable extends BaseSchema {
  protected tableName = 'missing_persons_assets'

  async up() {
    const hasTable = await this.schema.hasTable(this.tableName)
    if (!hasTable) {
      this.schema.createTable(this.tableName, (table) => {
        table.increments('id').primary()
        table.string('case_id').notNullable()
        
        // 排序与地位
        table.integer('is_primary').defaultTo(0)
        table.integer('sort_order').defaultTo(99)
        table.string('asset_type').defaultTo('photo')
        
        // 存储与 SEO
        table.string('original_filename').nullable()
        table.string('new_filename').notNullable()
        table.string('storage_path').notNullable()
        table.integer('width').nullable()
        table.integer('height').nullable()
        table.integer('file_size').nullable()
        
        // 多语言内容
        table.string('alt_en', 500).nullable()
        table.string('alt_zh', 500).nullable()
        table.string('alt_es', 500).nullable()
        table.text('caption_en').nullable()
        table.text('caption_zh').nullable()
        table.text('caption_es').nullable()
        
        // 状态与时间
        table.integer('ai_processed').defaultTo(0)
        table.timestamp('created_at').defaultTo(this.now())
        table.timestamp('updated_at').defaultTo(this.now())
      })
    }
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}