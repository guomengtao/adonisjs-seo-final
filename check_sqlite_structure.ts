import sqlite3 from 'sqlite3'
import { open } from 'sqlite'

async function checkSqliteStructure() {
  console.log('🔍 检查 SQLite 数据库结构...')
  
  try {
    // 打开数据库连接
    const db = await open({
      filename: './database.db',
      driver: sqlite3.Database
    })
    
    // 获取表结构
    const columns = await db.all('PRAGMA table_info(missing_persons_assets)')
    console.log('\n📋 missing_persons_assets 表字段：')
    columns.forEach((column: any, index: number) => {
      console.log(`${index + 1}. ${column.name} (${column.type}) - 主键: ${column.pk}`)
    })
    
    // 获取数据统计
    const count = await db.get('SELECT COUNT(*) as total FROM missing_persons_assets')
    console.log(`\n📊 表中总记录数：${count.total}`)
    
    // 添加 hf_backup_status 字段（如果不存在）
    try {
      await db.run('ALTER TABLE missing_persons_assets ADD COLUMN hf_backup_status INTEGER DEFAULT 0')
      console.log('✅ 已添加 hf_backup_status 字段')
    } catch (alterError) {
      if (alterError.message.includes('duplicate column name')) {
        console.log('ℹ️  hf_backup_status 字段已存在')
      } else {
        console.error('🚨 添加字段失败:', alterError.message)
      }
    }
    
    // 关闭连接
    await db.close()
    
  } catch (error) {
    console.error('🚨 错误:', error.message)
  }
}

checkSqliteStructure().then(() => process.exit(0))