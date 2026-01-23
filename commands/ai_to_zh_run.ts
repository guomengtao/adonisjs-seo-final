import { BaseCommand } from '@adonisjs/core/ace';
import db from '@adonisjs/lucid/services/db';
import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

export default class AiToZhRun extends BaseCommand {
  static commandName = 'ai:to-zh';
  static description = '使用AI将案件信息翻译成中文';
  static options = { startApp: true };

  async run() {
    try {
      this.logger.info('🚀 启动AI案件信息中文翻译服务...');

      // 1. 初始化任务进度
      await this.initTaskProgress();

      // 2. 获取当前任务进度
      const taskProgressResult = await db.connection().rawQuery(
        "SELECT * FROM task_progress WHERE task_name = ?",
        ['ai-to-zh']
      );
      
      // 适配 Postgres 返回结构
      const taskProgressRows = taskProgressResult.rows || (Array.isArray(taskProgressResult) ? taskProgressResult : []);
      const taskProgress = taskProgressRows[0];
      
      if (!taskProgress) {
        this.logger.error('❌ 获取任务进度失败');
        return;
      }
      const { last_id } = taskProgress;

      // 3. 获取下一个案件
      const nextCaseResult = await db.connection().rawQuery(
        'SELECT * FROM missing_persons_info WHERE id > ? ORDER BY id ASC LIMIT 1',
        [last_id]
      );
      
      const nextCaseRows = nextCaseResult.rows || (Array.isArray(nextCaseResult) ? nextCaseResult : []);
      const nextCase = nextCaseRows[0];

      if (!nextCase) {
        this.logger.success('✅ 所有案件已处理完毕');
        return;
      }

      const { id, case_id } = nextCase;

      this.logger.info(`📋 处理案件: ${case_id} (ID: ${id})`);

      // 4. 提取需要翻译的字段
      const fieldsToTranslate = {
        race: nextCase.race || '',
        classification: nextCase.classification || '',
        distinguishing_marks: nextCase.distinguishing_marks || '',
        disappearance_details: nextCase.disappearance_details || ''
      };

      // 5. 调用AI进行翻译
      const fieldsLengthStr = JSON.stringify(
        Object.entries(fieldsToTranslate).reduce((acc, [key, value]) => ({ 
          ...acc, [key]: (value as string)?.length || 0 
        }), {})
      );
      this.logger.info(`📊 原文长度: ${fieldsLengthStr}`);
      
      const translationResult = await this.translateWithAI(fieldsToTranslate, 0);

      if (!translationResult) {
        this.logger.error(`❌ 案件 ${case_id} 翻译失败，跳过`);
        await this.updateTaskProgress(id);
        return;
      }

      const { translatedFields, modelName } = translationResult;
      
      // 打印翻译后长度调试信息
      const translatedLengthStr = JSON.stringify(
        Object.entries(translatedFields).reduce((acc, [key, value]) => ({ 
          ...acc, [key]: (value as string)?.length || 0 
        }), {})
      );
      this.logger.info(`📊 翻译后长度: ${translatedLengthStr}`);

      // 6. 验证翻译结果
      if (!this.validateTranslationResult(translatedFields, fieldsToTranslate)) {
        this.logger.error(`❌ 案件 ${case_id} 翻译结果验证失败，跳过`);
        await this.updateTaskProgress(id);
        return;
      }

      // 7. 保存翻译结果
      await this.saveTranslationResult(case_id, id, translatedFields, modelName);

      this.logger.success(`✅ 案件 ${case_id} 翻译完成`);

      // 8. 更新任务进度
      await this.updateTaskProgress(id);

    } catch (error: any) {
      this.logger.error(`🚨 执行错误: ${error.message}`);
      this.logger.error(error.stack || '');
    }
  }

  private async initTaskProgress() {
    try {
      // Postgres 不需要 AUTOINCREMENT，使用 SERIAL 或 IDENTITY
      await db.connection().rawQuery(`
        CREATE TABLE IF NOT EXISTS task_progress (
          task_name TEXT PRIMARY KEY,
          last_id INTEGER NOT NULL DEFAULT 0,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      try {
        await db.connection().rawQuery(
          "INSERT INTO task_progress (task_name, last_id, updated_at) VALUES (?, ?, ?) ON CONFLICT DO NOTHING",
          ['ai-to-zh', 0, new Date().toISOString()]
        );
      } catch (e) {}

      await db.connection().rawQuery(`
        CREATE TABLE IF NOT EXISTS cases_info_zh (
          id SERIAL PRIMARY KEY,
          case_id VARCHAR(255) NOT NULL,
          case_info_id INTEGER NOT NULL,
          full_name_zh VARCHAR(255) NULL,
          race_zh VARCHAR(100) NULL,
          classification_zh VARCHAR(100) NULL,
          distinguishing_marks_zh TEXT NULL,
          disappearance_details_zh TEXT NULL,
          ai_model VARCHAR(100) NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      
      await db.connection().rawQuery(`
        CREATE INDEX IF NOT EXISTS idx_cases_info_zh_case_id ON cases_info_zh (case_id);
      `);
    } catch (error: any) {
      this.logger.error(`❌ 初始化失败: ${error.message}`);
    }
  }

  private async updateTaskProgress(lastId: number) {
    await db.connection().rawQuery(
      "UPDATE task_progress SET last_id = ?, updated_at = ? WHERE task_name = ?",
      [lastId, new Date().toISOString(), 'ai-to-zh']
    );
  }

  private async translateWithAI(fields: any, modelIndex: number = 0): Promise<{ translatedFields: any, modelName: string } | null> {
    const availableModels = [
      'gemini-2.0-flash-exp',
      'gemini-1.5-flash',
      'gemini-1.5-pro'
    ];
    
    if (modelIndex >= availableModels.length) return null;

    try {
      const prompt = `你是一个专业翻译。请将以下失踪人口信息翻译为中文。
      保持JSON格式不变，只翻译字段值。
      原文：${JSON.stringify(fields)}`;

      const modelName = availableModels[modelIndex];
      const apiKey = process.env.GEMINI_API_KEY;
      const baseUrl = 'https://chatgpt-proxy.gudq.com'; // 你的代理

      const response = await axios.post(`${baseUrl}/v1beta/models/${modelName}:generateContent?key=${apiKey}`, {
        contents: [{ parts: [{ text: prompt }] }]
      });

      const text = response.data.candidates[0].content.parts[0].text;
      let cleanText = text.replace(/^```json|```$/g, '').trim();
      const translatedFields = JSON.parse(cleanText);
      
      return { translatedFields, modelName };
    } catch (error: any) {
      this.logger.error(`🔄 模型 ${modelIndex} 失败: ${error.message}`);
      return this.translateWithAI(fields, modelIndex + 1);
    }
  }

  private validateTranslationResult(result: any, originalFields: any): boolean {
    if (!result || !result.disappearance_details) return false;
    // 简单验证：只要不是原文即可
    return result.disappearance_details !== originalFields.disappearance_details;
  }

  private async saveTranslationResult(caseId: string, caseInfoId: number, translatedFields: any, modelName: string) {
    const checkResult = await db.connection().rawQuery(
      'SELECT id FROM cases_info_zh WHERE case_info_id = ?',
      [caseInfoId]
    );
    
    const rows = checkResult.rows || (Array.isArray(checkResult) ? checkResult : []);

    if (rows.length > 0) {
      await db.connection().rawQuery(
        `UPDATE cases_info_zh SET race_zh = ?, classification_zh = ?, 
         distinguishing_marks_zh = ?, disappearance_details_zh = ?, 
         ai_model = ?, updated_at = ? WHERE case_info_id = ?`,
        [translatedFields.race, translatedFields.classification, translatedFields.distinguishing_marks, translatedFields.disappearance_details, modelName, new Date().toISOString(), caseInfoId]
      );
    } else {
      await db.connection().rawQuery(
        `INSERT INTO cases_info_zh (case_id, case_info_id, race_zh, classification_zh, distinguishing_marks_zh, disappearance_details_zh, ai_model) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [caseId, caseInfoId, translatedFields.race, translatedFields.classification, translatedFields.distinguishing_marks, translatedFields.disappearance_details, modelName]
      );
    }
  }
}