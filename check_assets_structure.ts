import db from '@adonisjs/lucid/services/db'

async function checkAssetsStructure() {
  console.log('🔍 检查 missing_persons_assets 表结构...')
  
  try {
    // 获取表结构
    const columns = await db.rawQuery('PRAGMA table_info(missing_persons_assets)')
    console.log('\n📋 表字段列表：')
    columns.forEach((column: any, index: number) => {
      console.log(`${index + 1}. ${column.name} (${column.type}) - 主键: ${column.pk}`)
    })
    
    // 获取一些数据样本
    console.log('\n📊 数据样本（前5条）：')
    const sample = await db.from('missing_persons_assets').limit(5)
    sample.forEach((row: any, index: number) => {
      console.log(`样本 ${index + 1}:`, {
        id: row.id,
        case_id: row.case_id,
        b2_url: row.b2_url || '无',
        hf_path: row.hf_path || '无',
        created_at: row.created_at
      })
    })
    
    return columns
    
  } catch (error) {
    console.error('🚨 错误:', error.message)
    return null
  }
}

checkAssetsStructure().then(() => process.exit(0))