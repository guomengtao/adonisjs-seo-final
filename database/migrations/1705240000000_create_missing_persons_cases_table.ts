import { BaseSchema } from '@adonisjs/lucid/schema'

export default class CreateMissingPersonsCasesTable extends BaseSchema {
  protected tableName = 'missing_persons_cases'

  async up() {
    const hasTable = await this.schema.hasTable(this.tableName)
    if (!hasTable) {
      this.schema.createTable(this.tableName, (table) => {
        table.increments('id').primary()
        table.string('case_title').notNullable()
        table.string('case_id').notNullable().unique()
        table.integer('image_webp_status').defaultTo(0)
        table.timestamp('created_at').defaultTo(this.now())
        table.timestamp('updated_at').defaultTo(this.now())
      })
    }
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}