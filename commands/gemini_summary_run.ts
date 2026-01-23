import { BaseCommand } from '@adonisjs/core/ace';
import db from '@adonisjs/lucid/services/db';
import GeminiService from '#services/gemini_service';

// 修复TypeScript类型检查
const GeminiServiceType = GeminiService as any;

// 语言验证配置
const VALID_LANGUAGES = ['zh', 'en', 'es'];

export default class GeminiSummaryRun extends BaseCommand {
  static commandName = 'gemini:summary';
  static description = '使用Gemini AI生成案件的多语言SEO摘要';
  static options = { startApp: true };

  async run() {
    try {
      console.log('🚀 启动Gemini AI多语言摘要生成服务...');

      // 获取当前任务进度
      const taskProgressResult = await db.connection().rawQuery("SELECT * FROM task_progress WHERE task_name = 'ai-summary'");
      
      // 处理不同的结果格式
      let taskProgress;
      if (Array.isArray(taskProgressResult)) {
        taskProgress = taskProgressResult[0];
      } else if (taskProgressResult.rows) {
        taskProgress = taskProgressResult.rows[0];
      } else {
        console.error('❌ 数据库查询返回格式错误');
        return;
      }

      if (!taskProgress) {
        console.error('❌ 任务进度记录不存在');
        return;
      }

      // 确保last_id存在且为数字
      const last_id = typeof taskProgress.last_id === 'number' ? taskProgress.last_id : 0;

      // 获取下一个案件
      const nextCaseResult = await db.connection().rawQuery('SELECT * FROM missing_persons_cases WHERE id > ? ORDER BY id ASC LIMIT 1', [last_id]);
      
      // 处理不同的结果格式
      let nextCase;
      if (Array.isArray(nextCaseResult)) {
        nextCase = nextCaseResult[0];
      } else if (nextCaseResult.rows) {
        nextCase = nextCaseResult.rows[0];
      } else {
        console.error('❌ 案件查询返回格式错误');
        return;
      }

      if (!nextCase) {
        console.log('✅ 所有案件已处理完毕');
        return;
      }

      const { id, case_id, case_html } = nextCase;

      if (!case_html) {
        console.log(`❌ 案件 ${case_id} (ID: ${id}) 无HTML内容，跳过`);
        await this.updateTaskProgress(id);
        return;
      }

      console.log(`📋 处理案件: ${case_id} (ID: ${id})`);

      // 清理HTML内容，提取纯文本
      const cleanText = this.cleanHtml(case_html);

      // 使用Gemini AI生成多语言摘要
      const geminiService = GeminiServiceType.getInstance();
      const summaryResult = await geminiService.generateMultiLangSummary(cleanText);
      const { summaries, modelName } = summaryResult || { summaries: null, modelName: null };

      if (!summaries || !modelName) {
        console.log(`❌ 案件 ${case_id} 摘要生成失败，跳过`);
        await this.updateTaskProgress(id);
        return;
      }

      // 将结果写入数据库
      await this.saveSummaries(case_id, summaries, modelName);

      console.log(`✅ 案件 ${case_id} 摘要生成完成`);

      // 更新任务进度
      await this.updateTaskProgress(id);

    } catch (error: any) {
      console.error(`🚨 执行错误: ${error.message}`);
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
      if (!caseId || !summaries || summaries.length === 0) {
        console.error('❌ 输入参数错误: caseId或summaries为空');
        return;
      }
      
      for (const summary of summaries) {
        const { lang, summary: content } = summary;
        
        try {
          if (!lang || !content) continue;
          
          if (!VALID_LANGUAGES.includes(lang)) continue;
          
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
          
        } catch (error: any) {
          // 简化错误处理，只记录关键错误
          console.log(`   ❌ ${lang.toUpperCase()} 摘要保存失败`);
        }
      }
      
    } catch (error: any) {
      console.error('❌ 保存摘要过程失败:', error.message);
    }
  }
}