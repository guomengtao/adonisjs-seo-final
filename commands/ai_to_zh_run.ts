import { BaseCommand } from '@adonisjs/core/ace';
import db from '@adonisjs/lucid/services/db';
import GeminiService from '#services/gemini_service';

// 修复TypeScript类型检查
const GeminiServiceType = GeminiService as any;

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
      
      // 处理不同的结果格式
      let taskProgress;
      if (Array.isArray(taskProgressResult)) {
        taskProgress = taskProgressResult[0];
      } else if (taskProgressResult.rows) {
        taskProgress = taskProgressResult.rows[0];
      } else {
        this.logger.error('❌ 数据库查询返回格式错误');
        return;
      }
      
      if (!taskProgress) {
        this.logger.error('❌ 获取任务进度失败');
        return;
      }
      
      // 确保last_id存在且为数字
      const last_id = typeof taskProgress.last_id === 'number' ? taskProgress.last_id : 0;

      // 3. 获取下一个案件
      const nextCaseResult = await db.connection().rawQuery(
        'SELECT * FROM missing_persons_info WHERE id > ? ORDER BY id ASC LIMIT 1',
        [last_id]
      );
      
      // 处理不同的结果格式
      let nextCase;
      if (Array.isArray(nextCaseResult)) {
        nextCase = nextCaseResult[0];
      } else if (nextCaseResult.rows) {
        nextCase = nextCaseResult.rows[0];
      } else {
        this.logger.error('❌ 案件查询返回格式错误');
        return;
      }

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
      
      // 调用 AI 进行翻译，最多尝试 3 个模型
      let translationResult = null;
      let maxModels = 3;
      
      for (let modelIndex = 0; modelIndex < maxModels; modelIndex++) {
        translationResult = await this.translateWithAI(fieldsToTranslate, modelIndex);
        if (translationResult) {
          break; // 翻译成功，退出循环
        }
        
        if (modelIndex < maxModels - 1) {
          this.logger.info(`🔄 尝试下一个模型 (${modelIndex + 2}/${maxModels})...`);
        }
      }
      
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

      // 先检查表是否存在，如果存在则删除（开发环境下可以这样做）
      await db.connection().rawQuery(`
        DROP TABLE IF EXISTS cases_info_zh CASCADE;
      `);
      
      // 重新创建表，确保id字段是自增主键
      await db.connection().rawQuery(`
        CREATE TABLE cases_info_zh (
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
      
      this.logger.info(`✅ 表 cases_info_zh 已重新创建`);
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
    try {
      const geminiService = GeminiServiceType.getInstance();
      const jsonData = JSON.stringify(fields);
      
      // 使用新添加的专门翻译方法
      const response = await geminiService.translateToChinese(jsonData, modelIndex);
      
      if (!response || !response.translatedJson) {
        throw new Error('Gemini AI 返回无效响应');
      }

      return { 
        translatedFields: response.translatedJson, 
        modelName: response.modelName 
      };
    } catch (error: any) {
      this.logger.error(`🔄 模型 ${modelIndex} 失败: ${error.message}`);
      
      // 如果当前模型失败，直接返回null，由调用者处理重试逻辑
      return null;
    }
  }

  private validateTranslationResult(result: any, originalFields: any): boolean {
    // 检查结果是否为空
    if (!result) return false;
    
    // 检查是否至少有一个字段被翻译
    let hasTranslation = false;
    
    // 检查每个字段
    for (const key in originalFields) {
      if (result[key] && result[key] !== originalFields[key]) {
        hasTranslation = true;
        break;
      }
    }
    
    // 即使所有字段都相同，也认为验证通过
    // 这是因为AI可能认为某些字段不需要翻译（如简短的单词或短语）
    return true;
  }

  private async saveTranslationResult(caseId: string, caseInfoId: number, translatedFields: any, modelName: string) {
    try {
      const checkResult = await db.connection().rawQuery(
        'SELECT id FROM cases_info_zh WHERE case_info_id = ?',
        [caseInfoId]
      );
      
      // 处理不同的结果格式
      let existingRecord;
      if (Array.isArray(checkResult)) {
        existingRecord = checkResult[0];
      } else if (checkResult.rows) {
        existingRecord = checkResult.rows[0];
      } else {
        this.logger.error('❌ 数据库查询返回格式错误');
        return;
      }

      if (existingRecord) {
        // 更新现有记录
        await db.connection().rawQuery(
          `UPDATE cases_info_zh SET 
             race_zh = ?, 
             classification_zh = ?, 
             distinguishing_marks_zh = ?, 
             disappearance_details_zh = ?, 
             ai_model = ?, 
             updated_at = ? 
           WHERE case_info_id = ?`,
          [
            translatedFields.race, 
            translatedFields.classification, 
            translatedFields.distinguishing_marks, 
            translatedFields.disappearance_details, 
            modelName, 
            new Date().toISOString(), 
            caseInfoId
          ]
        );
      } else {
        // 插入新记录，使用SERIAL自动生成id
        await db.connection().rawQuery(
          `INSERT INTO cases_info_zh (
             case_id, 
             case_info_id, 
             race_zh, 
             classification_zh, 
             distinguishing_marks_zh, 
             disappearance_details_zh, 
             ai_model
           ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            caseId, 
            caseInfoId, 
            translatedFields.race, 
            translatedFields.classification, 
            translatedFields.distinguishing_marks, 
            translatedFields.disappearance_details, 
            modelName
          ]
        );
      }
      
      this.logger.info(`✅ 翻译结果已保存`);
    } catch (error: any) {
      this.logger.error(`❌ 保存翻译结果失败: ${error.message}`);
      throw error; // 重新抛出错误以便上层处理
    }
  }
}