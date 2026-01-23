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
        
        
        
        // 根据实际结果结构调整检查逻辑
        let taskProgress;
        if (Array.isArray(taskProgressResult)) {
          taskProgress = taskProgressResult[0];
        } else if (taskProgressResult && taskProgressResult.rows) {
          taskProgress = taskProgressResult.rows[0];
        } else {
          taskProgress = null;
        }
        
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
        
        
        
        // 根据实际结果结构调整检查逻辑
        let nextCase;
        if (Array.isArray(nextCaseResult)) {
          nextCase = nextCaseResult[0];
        } else if (nextCaseResult && nextCaseResult.rows) {
          nextCase = nextCaseResult.rows[0];
        } else {
          nextCase = null;
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
      this.logger.info(`📊 原文长度: ${JSON.stringify(Object.entries(fieldsToTranslate).reduce((acc, [key, value]) => ({ ...acc, [key]: value?.length || 0 }), {}))}`);
      const translationResult = await this.translateWithAI(fieldsToTranslate, 0);

      if (!translationResult) {
        this.logger.error(`❌ 案件 ${case_id} 翻译失败，跳过`);
        await this.updateTaskProgress(id);
        return;
      }

      const { translatedFields, modelName } = translationResult;
      this.logger.info(`📊 翻译后长度: ${JSON.stringify(Object.entries(translatedFields).reduce((acc, [key, value]) => ({ ...acc, [key]: value?.length || 0 }), {}))}`);

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
        // 1. 创建任务进度表（如果不存在）
        await db.connection().rawQuery(`
          CREATE TABLE IF NOT EXISTS task_progress (
            task_name TEXT PRIMARY KEY,
            last_id INTEGER NOT NULL DEFAULT 0,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
        `);

        // 2. 初始化任务进度记录（如果不存在）
        try {
          await db.connection().rawQuery(
            "INSERT INTO task_progress (task_name, last_id, updated_at) VALUES (?, ?, ?)",
            ['ai-to-zh', 0, new Date().toISOString()]
          );
        } catch (insertError) {
          // 如果记录已存在，忽略错误
          // no-op
        }

        // 3. 创建翻译结果表（如果不存在）
        await db.connection().rawQuery(`
          CREATE TABLE IF NOT EXISTS cases_info_zh (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
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
        
        // 创建索引（如果不存在）
        await db.connection().rawQuery(`
          CREATE INDEX IF NOT EXISTS idx_cases_info_zh_case_id ON cases_info_zh (case_id);
        `);
        
        // 检查是否存在ai_model字段，如果不存在则添加
        try {
          await db.connection().rawQuery(
            "ALTER TABLE cases_info_zh ADD COLUMN ai_model VARCHAR(100) NULL"
          );
        } catch (alterError) {
          // 如果字段已存在，忽略错误
          // no-op
        }
      } catch (error: any) {
        this.logger.error(`❌ 初始化任务进度失败: ${error.message}`);
        throw error;
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
      // 构建翻译prompt
      const prompt = `你是一个专业的数据翻译助手，必须严格按照要求将失踪人口数据翻译成中文。

### 核心翻译要求：
1. **强制完整性**：必须翻译所有内容，不得遗漏任何细节，特别是disappearance_details和distinguishing_marks字段的每一个描述
2. **准确映射**：race字段必须映射为标准中文标签（如White→白人，Black→黑人，Hispanic→西班牙裔等）
3. **禁止原文返回**：绝对不能返回原文内容，必须全部翻译成中文
4. **字段名要求**：必须使用与原文完全相同的英文字段名，绝对不能使用中文字段名
5. **信息完整**：确保翻译后的内容包含原文的所有关键信息
6. **格式严格**：必须返回纯JSON格式，字段间必须用逗号分隔，不要添加任何额外说明或标记

要翻译的英文内容：
${JSON.stringify(fields, null, 2)}`;

      // 定义可用模型
      const availableModels = [
        'models/gemini-2.5-flash',
        'models/gemma-3-1b-it',
        'models/gemma-3-4b-it',
        'models/gemma-3-27b-it',
        'models/gemma-3n-e4b-it',
        'models/gemma-3n-e2b-it',
        'models/gemini-flash-latest',
        'models/gemini-flash-lite-latest',
        'models/gemini-2.5-flash-lite',
        'models/gemini-2.5-flash-preview-09-2025',
        'models/gemini-2.5-flash-lite-preview-09-2025',
        'models/gemini-3-flash-preview',
        'models/gemini-robotics-er-1.5-preview'
      ];
      
      const apiKey = process.env.GEMINI_API_KEY || '';
      const baseUrl = 'https://chatgpt-proxy.gudq.com';
      const modelName = availableModels[modelIndex] || availableModels[0];
      
      this.logger.info(`🔤 使用模型: ${modelName} 进行翻译...`);

      // 使用代理发送请求
      const response = await axios.post(`${baseUrl}/v1beta/models/${modelName.replace('models/', '')}:generateContent`, {
        contents: [
          {
            parts: [
              { text: prompt }
            ]
          }
        ]
      }, {
        params: { key: apiKey }
      });

      const text = response.data.candidates[0].content.parts[0].text;
      
      // 输出调试信息查看原始返回
      this.logger.info(`📝 AI原始输出: ${text.substring(0, 200)}...`);

      // 清理AI输出，确保是纯JSON
        let cleanText = text.replace(/^```json|```$/g, '').trim();
        
        try {
          // 修复JSON格式问题：添加缺少的逗号
          cleanText = cleanText.replace(/"\s*\n\s*"/g, '",\n"');
          
          // 移除JSON结束后的多余字符
          cleanText = cleanText.replace(/\}\s*[^\}]*$/, '}');
          
          const translatedFields = JSON.parse(cleanText);
          
          // 检查是否返回了原文
          const isSameAsOriginal = Object.keys(translatedFields).every(key => 
            translatedFields[key] === fields[key]
          );
          
          if (isSameAsOriginal) {
            throw new Error('AI返回了原文而非翻译结果');
          }
          
          // 检查是否使用了正确的字段名
          const requiredFields = ['race', 'classification', 'distinguishing_marks', 'disappearance_details'];
          for (const field of requiredFields) {
            if (!(field in translatedFields)) {
              throw new Error(`缺少必要字段: ${field}`);
            }
          }
          
          return { translatedFields, modelName };
        } catch (parseError) {
          this.logger.error(`❌ JSON解析失败: ${parseError.message}`);
          this.logger.error(`❌ 原始JSON: ${cleanText}`);
          throw parseError;
        }
    } catch (error) {
      this.logger.error(`❌ AI翻译失败: ${(error as Error).message}`);
      
      // 如果当前模型失败，尝试下一个模型
      const availableModels = [
        'models/gemini-2.5-flash',
        'models/gemma-3-1b-it',
        'models/gemma-3-4b-it',
        'models/gemma-3-27b-it',
        'models/gemma-3n-e4b-it',
        'models/gemma-3n-e2b-it',
        'models/gemini-flash-latest',
        'models/gemini-flash-lite-latest',
        'models/gemini-2.5-flash-lite',
        'models/gemini-2.5-flash-preview-09-2025',
        'models/gemini-2.5-flash-lite-preview-09-2025',
        'models/gemini-3-flash-preview',
        'models/gemini-robotics-er-1.5-preview'
      ];
      
      if (modelIndex < availableModels.length - 1) {
        this.logger.info(`🔄 尝试下一个模型 (${modelIndex + 1}/${availableModels.length})...`);
        return this.translateWithAI(fields, modelIndex + 1);
      }
      
      return null;
    }
  }

  private validateTranslationResult(result: any, originalFields: any): boolean {
    if (!result) {
      return false;
    }
    
    // 检查是否包含所有必要的翻译字段
    const requiredFields = ['race', 'classification', 'distinguishing_marks', 'disappearance_details'];
    
    for (const field of requiredFields) {
      if (result[field] === undefined) {
        this.logger.error(`❌ 翻译结果缺少字段: ${field}`);
        return false;
      }
      
      // 检查是否返回了原文
      if (result[field] === originalFields[field]) {
        this.logger.error(`❌ 字段 ${field} 返回了原文而非翻译结果`);
        return false;
      }
      
      // 检查翻译内容长度是否合适
      // 考虑中文通常比英文更简洁，适当放宽要求
      const originalLength = originalFields[field]?.length || 0;
      const translatedLength = result[field]?.length || 0;
      
      let minLengthRequired = 0;
      
      if (originalLength > 0) {
        switch (field) {
          case 'race':
          case 'classification':
            // 对于种族和分类等专业术语，允许更简洁的翻译
            minLengthRequired = 1; // 只要有内容就接受
            break;
          default:
            // 对于其他字段，考虑中文简洁性，要求至少为原文的1/3
            minLengthRequired = Math.ceil(originalLength / 3);
        }
        
        if (translatedLength < minLengthRequired) {
          this.logger.error(`❌ 翻译内容过短: ${field} (原文长度: ${originalLength}, 翻译后长度: ${translatedLength}, 要求至少: ${minLengthRequired})`);
          return false;
        }
      }
    }
    
    return true;
  }

  private async saveTranslationResult(caseId: string, caseInfoId: number, translatedFields: any, modelName: string) {
    try {
      // 检查记录是否已存在
      const existingRecordResult = await db.connection().rawQuery(
        'SELECT * FROM cases_info_zh WHERE case_info_id = ?',
        [caseInfoId]
      );
      
      if (existingRecordResult.rows && existingRecordResult.rows.length > 0) {
        // 更新现有记录
        await db.connection().rawQuery(
          `UPDATE cases_info_zh 
           SET race_zh = ?, classification_zh = ?, 
               distinguishing_marks_zh = ?, disappearance_details_zh = ?, 
               ai_model = ?, updated_at = ? 
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
        this.logger.info(`   🔄 更新翻译记录成功 (使用模型: ${modelName})`);
      } else {
        // 插入新记录
        await db.connection().rawQuery(
          `INSERT INTO cases_info_zh 
           (case_id, case_info_id, race_zh, classification_zh, 
            distinguishing_marks_zh, disappearance_details_zh, ai_model, created_at, updated_at) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            caseId,
            caseInfoId,
            translatedFields.race,
            translatedFields.classification,
            translatedFields.distinguishing_marks,
            translatedFields.disappearance_details,
            modelName,
            new Date().toISOString(),
            new Date().toISOString()
          ]
        );
        this.logger.info(`   📝 插入翻译记录成功 (使用模型: ${modelName})`);
      }
    } catch (error) {
      this.logger.error(`❌ 保存翻译结果失败: ${(error as Error).message}`);
      throw error;
    }
  }
}