import db from '@adonisjs/lucid/services/db'

async function main() {
  try {
    console.log('📋 检查本地SQLite数据库中的case_summaries表记录...')
    
    // 查询总记录数
    const totalResult = await db.rawQuery('SELECT COUNT(*) as total FROM case_summaries')
    const totalCount = totalResult.rows ? totalResult.rows[0].total : totalResult[0].total
    console.log(`✅ 总记录数: ${totalCount}`)
    
    // 查询不同语言的记录数
    const langResult = await db.rawQuery('SELECT lang, COUNT(*) as count FROM case_summaries GROUP BY lang')
    const langCounts = langResult.rows ? langResult.rows : langResult
    console.log('✅ 按语言统计:')
    langCounts.forEach((row: any) => {
      console.log(`   ${row.lang.toUpperCase()}: ${row.count}条记录`)
    })
    
    // 查询最近保存的几条记录
    console.log('\n📋 最近保存的5条记录:')
    const recentResult = await db.rawQuery('SELECT case_id, lang, created_at FROM case_summaries ORDER BY created_at DESC LIMIT 5')
    const recentRecords = recentResult.rows ? recentResult.rows : recentResult
    recentRecords.forEach((record: any) => {
      console.log(`   案件ID: ${record.case_id}, 语言: ${record.lang}, 创建时间: ${record.created_at}`)
    })
    
    console.log('\n🎉 检查完成!')
  } catch (error: any) {
    console.error('❌ 检查失败:', error.message)
    console.error('❌ 错误详细信息:', JSON.stringify(error, Object.getOwnPropertyNames(error)))
  } finally {
    // 脚本结束
    process.exit(0)
  }
}

main().catch(console.error)