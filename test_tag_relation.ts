import db from '@adonisjs/lucid/services/db'

async function testTagRelation() {
  try {
    console.log('Testing tag relation insert...')
    
    // 测试数据
    const caseId = 'test-case'
    const tagId = 1
    
    // 直接执行INSERT语句
    const result = await db.connection().rawQuery(
      `INSERT INTO missing_persons_tag_relations (case_id, tag_id) VALUES (?, ?) ON CONFLICT (case_id, tag_id) DO NOTHING`,
      [caseId, tagId]
    )
    
    console.log('Insert result:', result)
    console.log('Test passed!')
  } catch (error) {
    console.error('Test failed:', error)
  } finally {
    process.exit()
  }
}

testTagRelation()