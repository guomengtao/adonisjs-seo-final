import { BaseSchema } from '@adonisjs/lucid/schema'

export default class CreateGeoTranslationsTable extends BaseSchema {
  protected tableName = 'geo_translations'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.integer('geoname_id').primary()
      table.string('en_name', 255).notNullable().unique()
      table.string('zh_name', 255).notNullable()
      table.string('es_name', 255).notNullable()
      table.string('geo_type', 50).notNullable() // state, county, city
      table.string('parent_state_code', 10).nullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}