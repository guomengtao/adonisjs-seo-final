const db = require('@adonisjs/lucid/services/db')

async function findCase() {
  try {
    const cases = await db.from('missing_persons_info')
      .select('case_id', 'state_en', 'county_en', 'city_en', 'path')
      .whereNotNull('state_en')
      .whereNotNull('county_en')
      .whereNotNull('city_en')
      .whereNotNull('path')
      .limit(5)
    
    console.log('找到的案件:')
    console.log(JSON.stringify(cases, null, 2))
  } catch (error) {
    console.error('查询错误:', error)
  } finally {
    process.exit()
  }
}

findCase()