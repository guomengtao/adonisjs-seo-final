import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class Case extends BaseModel {
  // 关键修正：手动指定数据库中真实的表名
  public static table = 'missing_persons_cases'

  @column({ isPrimary: true })
  declare id: number

  // 确保这里的列名与数据库一致
  @column({ columnName: 'case_id' })
  declare caseId: string

  @column({ columnName: 'case_html' })
  declare caseHtml: string

  @column({ columnName: 'image_webp_status' })
  declare imageWebpStatus: number

  @column({ columnName: 'image_count' })
  declare imageCount: number

  // app/models/case.ts
  @column({ columnName: 'url_path' })
  declare urlPath: string
}