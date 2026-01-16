import { BaseSchema } from '@adonisjs/lucid/schema'

export default class CreateMissingPersonsTagsTables extends BaseSchema {
  protected tagsTableName = 'missing_persons_tags'
  protected tagRelationsTableName = 'missing_persons_tag_relations'

  async up() {
    // 创建标签定义表
    this.schema.createTable(this.tagsTableName, (table) => {
      table.increments('id').primary()
      table.string('name').notNullable()
      table.string('slug').notNullable().unique()
      table.timestamp('created_at').defaultTo(this.now())
      table.timestamp('updated_at').defaultTo(this.now())
    })

    // 创建标签关联表
    this.schema.createTable(this.tagRelationsTableName, (table) => {
      table.increments('id').primary()
      table.string('case_id').notNullable()
      table.integer('tag_id').notNullable().unsigned()
      table.timestamp('created_at').defaultTo(this.now())
      
      // 外键约束
      table.foreign('tag_id').references('id').inTable(this.tagsTableName).onDelete('CASCADE')
    })
  }

  async down() {
    this.schema.dropTable(this.tagRelationsTableName)
    this.schema.dropTable(this.tagsTableName)
  }
}