 import { BaseCommand } from '@adonisjs/core/ace'

export default class SyncToNeon extends BaseCommand {
  static commandName = 'sync:neon'
  static description = '把本地 SQLite 数据同步到远程 Neon Postgres'

  static options = {
    startApp: true,
  }

  async run() {
    this.logger.info('🚀 正在启动同步程序...')
    const db = await this.app.container.make('lucid.db')

    try {
      const tables = ['missing_persons_cases', 'missing_persons_info', 'missing_persons_assets']

      for (const table of tables) {
        this.logger.info(`正在处理表: ${table}`)

        // 1. 检查 Neon 中已有的数据量，实现断点续传
        const existingCount = await db.connection('pg').from(table).count('* as total')
        const offset = parseInt(existingCount[0].total as string)

        // 2. 从本地读取“剩余”数据
        const rows = await db.connection('sqlite')
          .from(table)
          .select('*')
          .orderBy('id', 'asc') // 确保顺序一致
          .offset(offset)

        if (rows.length === 0) {
          this.logger.success(`表 ${table} 已是最新，无需同步。`)
          continue
        }

        this.logger.info(`剩余 ${rows.length} 条数据待搬运 (已跳过前 ${offset} 条)...`)

        // 3. 写入 Neon (调小批量以防连接断开)
        const chunkSize = 10 
        for (let i = 0; i < rows.length; i += chunkSize) {
          const chunk = rows.slice(i, i + chunkSize)
          
          await db.connection('pg').table(table).multiInsert(chunk)
          this.logger.info(`  [${table}] 进度: ${offset + i + chunk.length} / ${offset + rows.length}`)
        }
      }

      this.logger.success('🎉 数据全量同步完成！')
    } catch (error: any) {
      this.logger.error('❌ 同步失败：')
      this.logger.error(error.message)
    }
  }
}