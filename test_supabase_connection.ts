import db from '@adonisjs/lucid/services/db'

async function testSupabaseConnection() {
  try {
    console.log('正在测试Supabase连接...')
    
    // 执行一个简单的查询来测试连接
    const result = await db.rawQuery('SELECT NOW() as current_time')
    console.log('连接成功！当前时间:', result.rows[0].current_time)
    
    // 测试数据库表结构
    const tables = await db.rawQuery(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
    )
    console.log('数据库中的表:', tables.rows.map((row: any) => row.table_name))
    
  } catch (error: any) {
    console.error('连接Supabase失败:', error.message || error)
    console.error('错误堆栈:', error.stack || '无')
  } finally {
    console.log('测试完成')
    process.exit(0)
  }
}

testSupabaseConnection()