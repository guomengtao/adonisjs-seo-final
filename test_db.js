const db = require('@adonisjs/lucid/services/db')

async function testDb() {
  try {
    // 连接到数据库
    await db.raw('SELECT 1')
    console.log('数据库连接成功')
    
    // 查询指定案件的资产数据
    const assets = await db.from('missing_persons_assets')
      .where('case_id', 'alan-rhys-dowden')
      .select('id', 'case_id', 'new_filename', 'alt_zh', 'caption_zh', 'ai_processed')
    
    console.log('\n查询结果:')
    console.log(JSON.stringify(assets, null, 2))
    
    // 检查是否有数据被正确更新
    const updatedAssets = assets.filter(asset => asset.ai_processed === 200 && asset.alt_zh && asset.caption_zh)
    console.log(`\n已更新的资产数量: ${updatedAssets.length}`)
    
    process.exit(0)
  } catch (error) {
    console.error('数据库操作失败:', error.message)
    process.exit(1)
  }
}

testDb()