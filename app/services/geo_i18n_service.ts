import db from '@adonisjs/lucid/services/db'
import GeoTranslation from '#models/geo_translation'

interface GeoTranslationResult {
  originalName: string
  translatedName: string
}

/**
 * 将URL风格的名称（如"new-york"）转换为标题格式（如"New York"）
 */
function normalizeGeoName(name: string): string {
  return name
    .replace(/-/g, ' ')  // 将连字符替换为空格
    .replace(/\b\w/g, char => char.toUpperCase())  // 每个单词首字母大写
}

export default class GeoI18nService {
  /**
   * 翻译地理位置名称
   * @param name 原始名称（通常是英文）
   * @param targetLocale 目标语言 (en, zh, es)
   * @param geoType 可选的地理类型过滤 (如: 'state', 'county', 'city')
   * @returns 翻译结果对象
   */
  public static async translateGeoName(name: string, targetLocale: string, geoType?: string): Promise<GeoTranslationResult> {
    // 如果目标语言是英文，直接返回原始名称
    if (targetLocale === 'en') {
      return { originalName: name, translatedName: name }
    }

    try {
      const column = targetLocale === 'zh' ? 'zh_name' : targetLocale === 'es' ? 'es_name' : 'en_name'
      const normalizedName = normalizeGeoName(name)
      
      console.log(`🔍 正在翻译: "${name}" -> 规范化: "${normalizedName}", 语言: ${targetLocale}, 类型: ${geoType || 'any'}`)
      
      let query = db
        .from('geo_translations')
        .where('en_name', normalizedName)
        .select('en_name', column)
      
      // 如果提供了地理类型，则添加类型过滤
      if (geoType) {
        query = query.where('geo_type', geoType)
      }
      
      const translation = await query.first()
      
      console.log(`📝 翻译结果: ${JSON.stringify(translation)}`)

      if (translation && translation[column]) {
        return {
          originalName: name,
          translatedName: translation[column] as string
        }
      }
    } catch (error) {
      console.error(`Error translating geo name "${name}" to "${targetLocale}":`, error)
    }

    // 如果没有找到翻译，返回原始名称
    return { originalName: name, translatedName: name }
  }

  /**
   * 批量翻译地理位置名称
   * @param names 原始名称数组
   * @param targetLocale 目标语言
   * @param nameTypes 可选的地理类型数组，与names数组一一对应 (如: ['state', 'county', 'city'])
   * @returns 翻译结果映射
   */
  public static async translateGeoNames(names: string[], targetLocale: string, nameTypes?: string[]): Promise<Map<string, string>> {
    const result = new Map<string, string>()
    
    // 如果目标语言是英文，直接返回原始名称
    if (targetLocale === 'en') {
      names.forEach(name => result.set(name, name))
      return result
    }

    try {
      const column = targetLocale === 'zh' ? 'zh_name' : targetLocale === 'es' ? 'es_name' : 'en_name'
      const normalizedNames = names.map(name => normalizeGeoName(name))
      
      console.log(`🔍 批量翻译: ${JSON.stringify(names)} -> 规范化: ${JSON.stringify(normalizedNames)}, 语言: ${targetLocale}, 类型: ${JSON.stringify(nameTypes || [])}`)
      
      // 从数据库批量获取翻译
      const translations = await db
        .from('geo_translations')
        .whereIn('en_name', normalizedNames)
        .select('en_name', 'geo_type', column)
      
      console.log(`📝 批量翻译结果: ${JSON.stringify(translations)}`)

      // 创建一个Map，用于存储规范化名称和地理类型组合到翻译的映射
      const normalizedMap = new Map<string, string>()
      translations.forEach(translation => {
        // 使用规范化名称和地理类型的组合作为键，确保精确匹配
        const key = `${translation.en_name}|${translation.geo_type || 'any'}`
        normalizedMap.set(key, translation[column] as string || translation.en_name)
        // 同时也设置只使用名称作为键的映射，作为备选
        normalizedMap.set(translation.en_name, translation[column] as string || translation.en_name)
      })
      
      console.log(`📝 规范化映射: ${JSON.stringify(Array.from(normalizedMap))}`)

      // 创建结果Map，将翻译结果映射回原始输入名称
      for (let i = 0; i < names.length; i++) {
        const name = names[i]
        const normalizedName = normalizeGeoName(name)
        const geoType = nameTypes?.[i]
        
        let translatedName: string
        if (geoType) {
          // 优先尝试使用名称和类型的组合键
          const key = `${normalizedName}|${geoType}`
          translatedName = normalizedMap.get(key) || normalizedMap.get(normalizedName) || name
        } else {
          // 如果没有提供类型，则直接使用名称键
          translatedName = normalizedMap.get(normalizedName) || name
        }
        
        result.set(name, translatedName)
        console.log(`📝 映射结果: "${name}" -> "${translatedName}" (类型: ${geoType || 'any'})`)
      }
    } catch (error) {
      console.error(`Error translating geo names "${names.join(', ')}" to "${targetLocale}":`, error)
    }

    // 为没有找到翻译的名称设置默认值
    names.forEach(name => {
      if (!result.has(name)) {
        result.set(name, name)
      }
    })

    return result
  }

  /**
   * 根据geoname_id获取翻译
   * @param geonameId 地理编码ID
   * @param targetLocale 目标语言
   * @returns 翻译后的名称
   */
  public static async translateByGeonameId(geonameId: number, targetLocale: string): Promise<string | null> {
    try {
      const column = targetLocale === 'zh' ? 'zh_name' : targetLocale === 'es' ? 'es_name' : 'en_name'
      
      const translation = await db
        .from('geo_translations')
        .where('geoname_id', geonameId)
        .select(column)
        .first()

      return translation ? (translation[column] as string) : null
    } catch (error) {
      console.error('Geo translation by ID error:', error)
      return null
    }
  }

  /**
   * 获取指定类型的地理位置翻译
   * @param geoType 地理位置类型 (state, county, city)
   * @param targetLocale 目标语言
   * @returns 翻译结果数组
   */
  public static async getTranslationsByType(geoType: string, targetLocale: string): Promise<Array<{ id: number; name: string }>> {
    try {
      const column = targetLocale === 'zh' ? 'zh_name' : targetLocale === 'es' ? 'es_name' : 'en_name'
      
      const translations = await db
        .from('geo_translations')
        .where('geo_type', geoType)
        .select('geoname_id as id', column as 'name')
        .orderBy(column)

      return translations.map(t => ({
        id: t.id,
        name: t.name as string
      }))
    } catch (error) {
      console.error('Geo translations by type error:', error)
      return []
    }
  }
}