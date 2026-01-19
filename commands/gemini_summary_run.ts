import { BaseCommand } from '@adonisjs/core/ace';
import db from '@adonisjs/lucid/services/db';
import GeminiService from '#services/gemini_service';

export default class GeminiSummaryRun extends BaseCommand {
  static commandName = 'gemini:summary';
  static description = '使用Gemini AI生成案件的多语言SEO摘要';
  static options = { startApp: true };

  async run() {
    try {
      this.logger.info('🚀 启动Gemini AI多语言摘要生成服务...');

      // 1. 初始化任务进度
      await this.initTaskProgress();

      // 2. 获取当前任务进度
      const taskProgressResult = await db.connection('pg').rawQuery("SELECT * FROM task_progress WHERE task_name = 'ai-summary'");

      const taskProgress = taskProgressResult.rows[0];

      if (!taskProgress) {
        this.logger.error('❌ 任务进度记录不存在');
        return;
      }

      const { last_id } = taskProgress;

      // 3. 获取下一个案件
      const nextCaseResult = await db.connection('pg').rawQuery('SELECT * FROM missing_persons_cases WHERE id > ? ORDER BY id ASC LIMIT 1', [last_id]);
      const nextCase = nextCaseResult.rows[0];

      if (!nextCase) {
        this.logger.success('✅ 所有案件已处理完毕');
        return;
      }

      const { id, case_id, case_html } = nextCase;

      if (!case_html) {
        this.logger.error(`❌ 案件 ${case_id} (ID: ${id}) 无HTML内容，跳过`);
        await this.updateTaskProgress(id);
        return;
      }

      this.logger.info(`📋 处理案件: ${case_id} (ID: ${id})`);

      // 4. 清理HTML内容，提取纯文本
      const cleanText = this.cleanHtml(case_html);

      // 5. 使用Gemini AI生成多语言摘要
      const geminiService = GeminiService.getInstance();
      const { summaries, modelName } = await geminiService.generateMultiLangSummary(cleanText);

      if (!summaries || !modelName) {
        this.logger.error(`❌ 案件 ${case_id} 摘要生成失败，跳过`);
        await this.updateTaskProgress(id);
        return;
      }

      // 6. 将结果写入数据库
      await this.saveSummaries(case_id, summaries, modelName);

      this.logger.success(`✅ 案件 ${case_id} 摘要生成完成`);

      // 7. 更新任务进度
      await this.updateTaskProgress(id);

    } catch (error: any) {
      this.logger.error(`🚨 执行错误: ${error.message}`);
      this.logger.error(error.stack || '');
    }
  }

  private async initTaskProgress() {
    try {
      // 直接使用SQL检查任务进度表是否存在（PostgreSQL兼容）
      const tableExists = await db.connection('pg').rawQuery("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'task_progress'");


      if (!tableExists.rows || tableExists.rows.length === 0) {
        this.logger.info('📋 创建任务进度表...');
        await db.connection('pg').rawQuery(`
          CREATE TABLE task_progress (
            task_name TEXT PRIMARY KEY,
            last_id INTEGER NOT NULL DEFAULT 0,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
        `);
      }

      // 检查任务是否存在
      const taskExists = await db.connection('pg').rawQuery("SELECT * FROM task_progress WHERE task_name = 'ai-summary'");


      if (!taskExists.rows || taskExists.rows.length === 0) {
        this.logger.info('📋 初始化任务进度...');
        await db.connection('pg').rawQuery("INSERT INTO task_progress (task_name, last_id, updated_at) VALUES (?, ?, ?)", [
          'ai-summary',
          0,
          new Date().toISOString()
        ]);

      }
    } catch (error) {
      this.logger.error('❌ 创建任务进度表失败:', error.message);
      throw error;
    }
  }

  private async updateTaskProgress(lastId: number) {
    await db.connection('pg').rawQuery(
      "UPDATE task_progress SET last_id = ?, updated_at = ? WHERE task_name = 'ai-summary'",
      [lastId, new Date().toISOString()]
    );
  }

  private cleanHtml(html: string): string {
    // 移除HTML标签
    let text = html.replace(/<[^>]*>/g, ' ');
    // 移除多余空格
    text = text.replace(/\s+/g, ' ').trim();
    // 截取前2000字符（避免超出API限制）
    return text.substring(0, 2000);
  }

  private async saveSummaries(caseId: string, summaries: Array<{ lang: string; summary: string }>, modelName: string) {
    try {
      // 1. 验证输入参数
      if (!caseId || !summaries || summaries.length === 0) {
        this.logger.error('❌ 输入参数错误: caseId或summaries为空');
        return;
      }
      
      // 2. 检查结果表是否存在（PostgreSQL兼容）
      const tableExists = await db.connection('pg').rawQuery("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'case_summaries'");

      if (!tableExists.rows || tableExists.rows.length === 0) {
        this.logger.info('📋 创建案件摘要表...');
        await db.connection('pg').rawQuery(`
          CREATE TABLE case_summaries (
            id SERIAL PRIMARY KEY,
            case_id VARCHAR(255) NOT NULL,
            lang VARCHAR(10) NOT NULL,
            summary TEXT NOT NULL,
            ai_model VARCHAR(50) NOT NULL DEFAULT 'models/gemini-2.5-flash',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );
        `);
        // 创建唯一索引
        await db.connection('pg').rawQuery("CREATE UNIQUE INDEX idx_case_id_lang ON case_summaries (case_id, lang);");
        this.logger.info('✅ 案件摘要表创建成功');
      }

      // 3. 保存摘要并进行详细验证
      const savedLanguages: string[] = [];
      
      for (const summary of summaries) {
        const { lang, summary: content } = summary;
        
        try {
          // 验证单个摘要内容
          if (!lang || !content) {
            this.logger.error(`   ❌ 摘要内容错误: ${lang || '未知语言'}的摘要为空`);
            continue;
          }
          
          // 先检查是否已存在记录
          const existing = await db.connection('pg').rawQuery(`SELECT * FROM case_summaries WHERE case_id = ? AND lang = ?`, [caseId, lang]);
          
          if (existing.rows && existing.rows.length > 0) {
            // 更新记录
            const updateResult = await db.connection('pg').rawQuery(
              `UPDATE case_summaries SET summary = ?, ai_model = ?, updated_at = ? WHERE case_id = ? AND lang = ?`,
              [content, modelName, new Date().toISOString(), caseId, lang]
            );
            
            // 检查更新是否成功
            if (updateResult.rowCount && updateResult.rowCount > 0) {
              this.logger.info(`   🔄 更新 ${lang.toUpperCase()} 摘要成功`);
            } else {
              this.logger.error(`   ❌ 更新 ${lang.toUpperCase()} 摘要失败: 无行受影响`);
              continue;
            }
          } else {
            // 插入新记录
            const insertResult = await db.connection('pg').rawQuery(
              `INSERT INTO case_summaries (case_id, lang, summary, ai_model, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
              [caseId, lang, content, modelName, new Date().toISOString(), new Date().toISOString()]
            );
            
            // 检查插入是否成功
            if (insertResult.rowCount && insertResult.rowCount > 0) {
              this.logger.info(`   📝 插入 ${lang.toUpperCase()} 摘要成功`);
            } else {
              this.logger.error(`   ❌ 插入 ${lang.toUpperCase()} 摘要失败: 无行受影响`);
              continue;
            }
          }
          
          // 4. 详细验证数据是否成功写入
          const verifyResult = await db.connection('pg').rawQuery(
            `SELECT * FROM case_summaries WHERE case_id = ? AND lang = ?`, 
            [caseId, lang]
          );
          
          if (verifyResult.rows && verifyResult.rows.length > 0) {
            const savedRow = verifyResult.rows[0];
            
            // 验证所有必填字段
            if (!savedRow.case_id || !savedRow.lang || !savedRow.summary || !savedRow.ai_model) {
              this.logger.error(`   ❌ 验证失败: ${lang.toUpperCase()} 摘要字段不完整`);
              continue;
            }
            
            // 验证关键数据一致性
            if (savedRow.case_id !== caseId || savedRow.lang !== lang) {
              this.logger.error(`   ❌ 验证失败: ${lang.toUpperCase()} 摘要数据不一致`);
              continue;
            }
            
            // 验证摘要内容不为空
            if (savedRow.summary.trim().length === 0) {
              this.logger.error(`   ❌ 验证失败: ${lang.toUpperCase()} 摘要内容为空`);
              continue;
            }
            
            // 记录成功保存的语言
            savedLanguages.push(lang);
            this.logger.info(`   ✅ ${lang.toUpperCase()} 摘要保存并验证成功`);
          } else {
            this.logger.error(`   ❌ 验证失败: ${lang.toUpperCase()} 摘要未找到`);
          }
          
        } catch (error: any) {
          this.logger.error(`   ❌ 保存 ${lang.toUpperCase()} 摘要失败: ${error.message}`);
        }
      }
      
      // 5. 总体验证
      if (savedLanguages.length === summaries.length) {
        this.logger.success(`✅ 所有摘要（${savedLanguages.join(', ')}）保存并验证成功`);
      } else {
        this.logger.warning(`⚠️ 部分摘要保存失败，成功的语言：${savedLanguages.join(', ')}`);
      }
      
    } catch (error) {
      this.logger.error('❌ 保存摘要过程失败:', error.message);
    }
  }
}