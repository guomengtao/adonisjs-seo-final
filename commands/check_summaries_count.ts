import { BaseCommand } from '@adonisjs/core/ace';
import db from '@adonisjs/lucid/services/db';

// 定义case_summaries表的行类型
interface CaseSummaryRow {
  id: number;
  case_id: string;
  lang: string;
  summary: string;
  ai_model: string;
  created_at: string;
  updated_at: string;
}

export default class CheckSummariesCount extends BaseCommand {
  static commandName = 'check:summaries-count';
  static description = '查看Neon数据库中case_summaries表的记录数量和完整数据';
  static options = { startApp: true };

  async run() {
    try {
      this.logger.info('🔍 查询Neon数据库中case_summaries表的记录...');

      // 查询记录总数
      const countResult = await db.connection('pg').rawQuery('SELECT COUNT(*) as total FROM case_summaries');
      const totalCount = countResult.rows[0].total;
      this.logger.info(`📊 记录总数: ${totalCount}`);

      // 查询所有记录，按case_id和lang排序
      const allResults = await db.connection('pg').rawQuery('SELECT * FROM case_summaries ORDER BY case_id, lang');

      if (allResults.rows && allResults.rows.length > 0) {
        this.logger.info('\n📋 完整记录列表:');
        
        // 按case_id分组显示
        const groupedResults: { [key: string]: CaseSummaryRow[] } = {};
        allResults.rows.forEach((row: CaseSummaryRow) => {
          if (!groupedResults[row.case_id]) {
            groupedResults[row.case_id] = [];
          }
          groupedResults[row.case_id].push(row);
        });

        // 显示每个案件的记录
        Object.keys(groupedResults).forEach(caseId => {
          this.logger.info(`\n📌 案件 ID: ${caseId}`);
          groupedResults[caseId].forEach((row: CaseSummaryRow) => {
            this.logger.info(`   语言: ${row.lang.toUpperCase()}`);
            this.logger.info(`   AI模型: ${row.ai_model}`);
            this.logger.info(`   创建时间: ${new Date(row.created_at).toUTCString()}`);
            this.logger.info(`   更新时间: ${new Date(row.updated_at).toUTCString()}`);
            this.logger.info(`   摘要: ${row.summary.substring(0, 100)}...`);
          });
        });

      } else {
        this.logger.info('📭 表中没有记录');
      }

      this.logger.success('\n✅ 数据查询完成！');

    } catch (error: any) {
      this.logger.error('❌ 查询失败:', error.message);
    }
  }
}