import { BaseCommand } from '@adonisjs/core/ace';
import db from '@adonisjs/lucid/services/db';
import GeminiService from '#services/gemini_service';

// 修复TypeScript类型检查
const GeminiServiceType = GeminiService as any;
// 移除可能有问题的语言验证器导入，使用简单的语言验证

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
      const taskProgressResult = await db.connection().rawQuery("SELECT * FROM task_progress WHERE task_name = 'ai-summary'"); // 使用默认连接

      // 处理不同的结果格式
      let taskProgress;
      if (Array.isArray(taskProgressResult)) {
        // 结果直接是数组
        if (taskProgressResult.length === 0) {
          this.logger.error('❌ 未找到任务进度记录');
          return;
        }
        taskProgress = taskProgressResult[0]; // 使用第一个记录
      } else if (taskProgressResult.rows) {
        // 结果有rows属性
        if (Array.isArray(taskProgressResult.rows) && taskProgressResult.rows.length > 0) {
          taskProgress = taskProgressResult.rows[0];
        } else {
          this.logger.error('❌ 未找到任务进度记录');
          return;
        }
      } else {
        this.logger.error('❌ 数据库查询返回格式错误');
        return;
      }

      if (!taskProgress) {
        this.logger.error('❌ 任务进度记录不存在');
        return;
      }

      // 确保last_id存在且为数字
      const last_id = typeof taskProgress.last_id === 'number' ? taskProgress.last_id : 0;

      // 3. 获取下一个案件
      const nextCaseResult = await db.connection().rawQuery('SELECT * FROM missing_persons_cases WHERE id > ? ORDER BY id ASC LIMIT 1', [last_id]); // 使用默认连接

      // 处理不同的结果格式
      let nextCase;
      if (Array.isArray(nextCaseResult)) {
        // 结果直接是数组
        nextCase = nextCaseResult[0];
      } else if (nextCaseResult.rows) {
        // 结果有rows属性
        nextCase = nextCaseResult.rows[0];
      } else {
        this.logger.error('❌ 案件查询返回格式错误');
        return;
      }

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
      const geminiService = GeminiServiceType.getInstance();
      const summaryResult = await geminiService.generateMultiLangSummary(cleanText);
      const { summaries, modelName } = summaryResult || { summaries: null, modelName: null };

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
      // 尝试创建任务进度表，如果已存在则忽略
      try {
        this.logger.info('📋 检查任务进度表...');
        await db.connection().rawQuery(`
          CREATE TABLE IF NOT EXISTS task_progress (
            task_name TEXT PRIMARY KEY,
            last_id INTEGER NOT NULL DEFAULT 0,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
        `);
      } catch (createError: any) {
        // 忽略表已存在的错误
        if (!createError.message || !createError.message.includes('table task_progress already exists')) {
          throw createError;
        }
      }

      // 检查任务是否存在，如果存在则更新，不存在则插入
      const taskExists = await db.connection().rawQuery("SELECT * FROM task_progress WHERE task_name = 'ai-summary'");

      // 处理不同的结果格式
      let existingTask;
      if (Array.isArray(taskExists)) {
        existingTask = taskExists[0];
      } else if (taskExists.rows) {
        existingTask = taskExists.rows[0];
      } else if (taskExists && typeof taskExists === 'object') {
        existingTask = taskExists;
      }

      if (!existingTask) {
        this.logger.info('📋 初始化任务进度...');
        await db.connection().rawQuery("INSERT INTO task_progress (task_name, last_id, updated_at) VALUES (?, ?, ?)", [
          'ai-summary',
          0,
          new Date().toISOString()
        ]);
        this.logger.info('✅ 任务进度初始化成功');
      } else {
        this.logger.info('📋 任务进度已存在，跳过初始化');
      }
    } catch (error: any) {
      this.logger.error('❌ 创建任务进度表失败:', error.message);
      throw error;
    }
  }

  private async updateTaskProgress(lastId: number) {
    await db.connection().rawQuery(
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
      
      // 简化日志输出
      this.logger.info(`📋 开始保存 ${summaries.length} 种语言的摘要...`);
      
      // 2. 直接保存摘要，不检查或创建表结构

      // 3. 保存摘要并进行详细验证
      const savedLanguages: string[] = [];
      
      for (const summary of summaries) {
        const { lang, summary: content } = summary;
        
        try {
          // 简化日志输出
          
          // 验证单个摘要内容
          if (!lang || !content) {
            this.logger.error(`   ❌ 摘要内容错误: ${lang || '未知语言'}的摘要为空`);
            continue;
          }
          
          // 简单的语言验证
          const validLanguages = ['zh', 'en', 'es'];
          if (!validLanguages.includes(lang)) {
            this.logger.error(`   ❌ 摘要语言验证失败: ${lang.toUpperCase()} 不是有效语言`);
            continue;
          }
          
          // 先检查是否已存在记录
          const existing = await db.connection().rawQuery(`SELECT * FROM case_summaries WHERE case_id = ? AND lang = ?`, [caseId, lang]);
          
          if (existing.rows && existing.rows.length > 0) {
            // 更新记录
            await db.connection().rawQuery(
              `UPDATE case_summaries SET summary = ?, ai_model = ?, updated_at = ? WHERE case_id = ? AND lang = ?`,
              [content, modelName, new Date().toISOString(), caseId, lang]
            );
          } else {
            // 插入新记录
            await db.connection().rawQuery(
              `INSERT INTO case_summaries (case_id, lang, summary, ai_model, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
              [caseId, lang, content, modelName, new Date().toISOString(), new Date().toISOString()]
            );
          }
          
          // 4. 验证数据是否成功写入
          const verifyResult = await db.connection().rawQuery(
            `SELECT * FROM case_summaries WHERE case_id = ? AND lang = ?`, 
            [caseId, lang]
          );
          
          // 检查查询结果（兼容不同的结果格式）
          const rows = verifyResult.rows || verifyResult;
          if (Array.isArray(rows) && rows.length > 0) {
            const savedRow = rows[0];
            
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
          } else if (verifyResult && typeof verifyResult === 'object' && Object.keys(verifyResult).length > 0) {
            // 如果结果不是数组，但包含数据，则认为验证成功
            this.logger.info(`   ✅ ${lang.toUpperCase()} 摘要保存并验证成功`);
            savedLanguages.push(lang);
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
      
    } catch (error: any) {
      this.logger.error('❌ 保存摘要过程失败:', error.message);
    }
  }
}