import { BaseCommand } from '@adonisjs/core/ace'

export default class TestSqliteQuery extends BaseCommand {
  static commandName = 'test:sqlite'
  static options = { startApp: true }

  async run() {
    this.logger.info('测试SQLite查询...')
    
    const db = await this.app.container.make('lucid.db')
    
    try {
      // 检查连接配置
      const connection = db.connection() as any
      this.logger.info('连接配置: ' + JSON.stringify(connection.config, null, 2))
      this.logger.info('客户端类型: ' + (connection.client || '未知'))
      
      // 先查询所有表，不进行过滤
      const allTablesResult = await db.rawQuery(`SELECT name, type FROM sqlite_master ORDER BY name`)
      
      this.logger.info('所有表信息:')
      this.logger.info('完整结果: ' + JSON.stringify(allTablesResult, null, 2))
      this.logger.info('rows: ' + JSON.stringify(allTablesResult.rows, null, 2))
      this.logger.info('rows类型: ' + typeof allTablesResult.rows)
      
      // 检查查询结果的所有属性
      if (allTablesResult) {
        this.logger.info('查询结果属性列表:')
        for (const key in allTablesResult) {
          this.logger.info(`  ${key}: ${typeof allTablesResult[key]} = ${JSON.stringify(allTablesResult[key])}`)
        }
      }
      
      // 然后测试我们的过滤查询
      const result = await db.rawQuery(`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name`)
      
      this.logger.success('过滤查询成功!')
      this.logger.info('结果行数: ' + (result.rows ? result.rows.length : 0))
      this.logger.info('表名: ' + (result.rows ? result.rows.map((row: any) => row.name).join(', ') : '[]'))
      
      // 测试直接查询一个已知的表
      try {
        const testTableResult = await db.rawQuery(`SELECT COUNT(*) as count FROM missing_persons_assets`)
        this.logger.info('missing_persons_assets表记录数: ' + (testTableResult.rows ? testTableResult.rows[0].count : 'N/A'))
      } catch (tableError: any) {
      this.logger.error('无法查询missing_persons_assets表: ' + tableError.message)
    }
      
    } catch (error: any) {
      this.logger.error('查询失败: ' + error.message)
      this.logger.error('错误详情: ' + JSON.stringify(error, null, 2))
    }
  }
}