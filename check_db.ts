import Database from '@adonisjs/lucid/services/db'

async function checkDatabase() {
  try {
    // 获取所有表
    const tables = await Database.rawQuery("SELECT name FROM sqlite_master WHERE type='table'")
    console.log('Existing tables:', tables.rows.map((row: any) => row.name))

    // 检查missing_persons_cases表结构
    if (tables.rows.some((row: any) => row.name === 'missing_persons_cases')) {
      const casesStructure = await Database.rawQuery("PRAGMA table_info(missing_persons_cases)")
      console.log('\nmissing_persons_cases structure:', casesStructure.rows)
    }

    // 检查missing_persons_info表结构
    if (tables.rows.some((row: any) => row.name === 'missing_persons_info')) {
      const infoStructure = await Database.rawQuery("PRAGMA table_info(missing_persons_info)")
      console.log('\nmissing_persons_info structure:', infoStructure.rows)
    }

    // 检查missing_persons_assets表结构
    if (tables.rows.some((row: any) => row.name === 'missing_persons_assets')) {
      const assetsStructure = await Database.rawQuery("PRAGMA table_info(missing_persons_assets)")
      console.log('\nmissing_persons_assets structure:', assetsStructure.rows)
    }

  } catch (error) {
    console.error('Error checking database:', error)
  } finally {
    await Database.manager.closeAll()
  }
}

checkDatabase()