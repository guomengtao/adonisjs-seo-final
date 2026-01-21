import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class GeoTranslation extends BaseModel {
  public static table = 'geo_translations'

  @column({ isPrimary: true, columnName: 'geoname_id' })
  declare geonameId: number

  @column({ columnName: 'en_name' })
  declare enName: string

  @column({ columnName: 'zh_name' })
  declare zhName: string | null

  @column({ columnName: 'es_name' })
  declare esName: string | null

  @column({ columnName: 'geo_type' })
  declare geoType: string | null

  @column({ columnName: 'parent_state_code' })
  declare parentStateCode: string | null
}