import { BaseSchema } from '@adonisjs/lucid/schema'

export default class CreateMissingPersonsInfoTable extends BaseSchema {
  protected tableName = 'missing_persons_info'

  async up() {
    // 检查表是否存在
    const hasTable = await this.schema.hasTable(this.tableName)
    
    if (!hasTable) {
      this.schema.createTable(this.tableName, (table) => {
        table.increments('id').primary()
        table.string('case_id').notNullable().unique()
        table.string('title').nullable()
        table.string('seo_title').nullable()
        table.text('case_summary').nullable()
        table.string('url_path').nullable()
        table.integer('ai_status').defaultTo(0)
        table.timestamp('created_at').defaultTo(this.now())
        table.timestamp('updated_at').defaultTo(this.now())
      })
    } else {
      // 对于已存在的表，使用 alterTable 来添加缺失的列
      // 使用 try/catch 来处理列已存在的情况
      try {
        this.schema.alterTable(this.tableName, (table) => {
          table.string('seo_title').nullable()
        })
      } catch (e) {
        // 忽略列已存在的错误
      }
    }
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}