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
      const taskProgressResult = await db.connection().rawQuery( // 使用默认连接
        "SELECT * FROM public.task_progress WHERE task_name = 'ai-to-zh'"
      );

      const taskProgress = taskProgressResult.rows[0];

      if (!taskProgress) {
        this.logger.error('❌ 任务进度记录不存在');
        return;
      }

      const { last_id } = taskProgress;

      // 3. 获取下一个案件
      const nextCaseResult = await db.connection().rawQuery( // 使用默认连接
        'SELECT * FROM public.missing_persons_info WHERE id > ? ORDER BY id ASC LIMIT 1',
        [last_id]
      );
      const nextCase = nextCaseResult.rows[0];

      if (!nextCase) {
        this.logger.success('✅ 所有案件已处理完毕');
        return;
      }

      const { id, case_id } = nextCase;

      this.logger.info(`📋 处理案件: ${case_id} (ID: ${id})`);

      // 4. 提取需要翻译的字段
      const fieldsToTranslate = {
        full_name: nextCase.full_name || '',
        race: nextCase.race || '',
        classification: nextCase.classification || '',
        distinguishing_marks: nextCase.distinguishing_marks || '',
        disappearance_details: nextCase.disappearance_details || ''
      };

      // 5. 调用AI进行翻译
      const translationResult = await this.translateWithAI(fieldsToTranslate, 0);

      if (!translationResult) {
        this.logger.error(`❌ 案件 ${case_id} 翻译失败，跳过`);
        await this.updateTaskProgress(id);
        return;
      }

      const { translatedFields, modelName } = translationResult;

      // 6. 验证翻译结果
      if (!this.validateTranslationResult(translatedFields)) {
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
      // 1. 检查任务进度表是否存在
      this.logger.debug('🔍 检查任务进度表是否存在...');
      const tableExistsResult = await db.connection().rawQuery( // 使用默认连接
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'task_progress'"
      );

      const tableExists = tableExistsResult.rows && tableExistsResult.rows.length > 0;

      if (!tableExists) {
        this.logger.info('📋 创建任务进度表...');
        // 创建任务进度表
        await db.connection().rawQuery(` // 使用默认连接
          CREATE TABLE public.task_progress (
            task_name TEXT PRIMARY KEY,
            last_id INTEGER NOT NULL DEFAULT 0,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );
        `);
        this.logger.debug('✅ 任务进度表创建成功');
      }

      // 2. 检查任务是否存在
      this.logger.debug('🔍 检查任务进度记录是否存在...');
      const taskExistsResult = await db.connection().rawQuery( // 使用默认连接
        "SELECT * FROM public.task_progress WHERE task_name = 'ai-to-zh'"
      );

      const taskExists = taskExistsResult.rows && taskExistsResult.rows.length > 0;

      if (!taskExists) {
        this.logger.info('📋 初始化任务进度...');
        await db.connection().rawQuery( // 使用默认连接
          "INSERT INTO public.task_progress (task_name, last_id, updated_at) VALUES (?, ?, ?)",
          ['ai-to-zh', 0, new Date().toISOString()]
        );
        this.logger.debug('✅ 任务进度记录初始化成功');
      }

      // 3. 检查翻译结果表是否存在
      this.logger.debug('🔍 检查翻译结果表是否存在...');
      const resultTableExistsResult = await db.connection().rawQuery( // 使用默认连接
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'cases_info_zh'"
      );

      const resultTableExists = resultTableExistsResult.rows && resultTableExistsResult.rows.length > 0;

      if (!resultTableExists) {
        this.logger.info('📋 创建翻译结果表 cases_info_zh...');
        await db.connection().rawQuery(` // 使用默认连接
          CREATE TABLE public.cases_info_zh (
            id SERIAL PRIMARY KEY,
            case_id VARCHAR(255) NOT NULL,
            case_info_id INTEGER NOT NULL,
            full_name_zh VARCHAR(255) NULL,
            race_zh VARCHAR(100) NULL,
            classification_zh VARCHAR(100) NULL,
            distinguishing_marks_zh TEXT NULL,
            disappearance_details_zh TEXT NULL,
            ai_model VARCHAR(100) NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );
        `);
        await db.connection().rawQuery("CREATE INDEX idx_cases_info_zh_case_id ON public.cases_info_zh (case_id);"); // 使用默认连接
        this.logger.debug('✅ 翻译结果表创建成功');
      } else {
        // 检查是否存在ai_model字段，如果不存在则添加
        const columnExistsResult = await db.connection().rawQuery( // 使用默认连接
          "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'cases_info_zh' AND column_name = 'ai_model'"
        );
        
        if (!columnExistsResult.rows || columnExistsResult.rows.length === 0) {
          this.logger.info('📋 为翻译结果表添加ai_model字段...');
          await db.connection().rawQuery( // 使用默认连接
            "ALTER TABLE public.cases_info_zh ADD COLUMN ai_model VARCHAR(100) NULL"
          );
          this.logger.debug('✅ ai_model字段添加成功');
        }
      }
    } catch (error: any) {
      this.logger.error(`❌ 初始化任务进度失败: ${error.message}`);
      throw error;
    }
  }

  private async updateTaskProgress(lastId: number) {
    await db.connection().rawQuery( // 使用默认连接
      "UPDATE public.task_progress SET last_id = ?, updated_at = ? WHERE task_name = ?",
      [lastId, new Date().toISOString(), 'ai-to-zh']
    );
  }

  private async translateWithAI(fields: any, modelIndex: number = 0): Promise<{ translatedFields: any, modelName: string } | null> {
    try {
      // 构建翻译prompt
      const prompt = `你是一个专业的数据翻译助手。请将上述失踪人口数据翻译成中文。
race 请映射为标准中文标签。
distinguishing_marks 和 disappearance_details 请进行流利且严肃的文学翻译。

输出格式必须保持 JSON 结构。

要翻译的内容：
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

      // 清理AI输出，确保是纯JSON
      const cleanText = text.replace(/^```json|```$/g, '').trim();
      const translatedFields = JSON.parse(cleanText);

      return { translatedFields, modelName };
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

  private validateTranslationResult(result: any): boolean {
    if (!result) {
      return false;
    }
    
    // 检查是否包含所有必要的翻译字段
    const requiredFields = ['full_name', 'race', 'classification', 'distinguishing_marks', 'disappearance_details'];
    
    for (const field of requiredFields) {
      if (result[field] === undefined) {
        this.logger.error(`❌ 翻译结果缺少字段: ${field}`);
        return false;
      }
    }
    
    return true;
  }

  private async saveTranslationResult(caseId: string, caseInfoId: number, translatedFields: any, modelName: string) {
    try {
      // 检查记录是否已存在
      const existingRecordResult = await db.connection().rawQuery( // 使用默认连接
        'SELECT * FROM public.cases_info_zh WHERE case_info_id = ?',
        [caseInfoId]
      );
      
      if (existingRecordResult.rows && existingRecordResult.rows.length > 0) {
        // 更新现有记录
        await db.connection().rawQuery( // 使用默认连接
          `UPDATE public.cases_info_zh 
           SET full_name_zh = ?, race_zh = ?, classification_zh = ?, 
               distinguishing_marks_zh = ?, disappearance_details_zh = ?, 
               ai_model = ?, updated_at = ? 
           WHERE case_info_id = ?`,
          [
            translatedFields.full_name,
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
        await db.connection().rawQuery( // 使用默认连接
          `INSERT INTO public.cases_info_zh 
           (case_id, case_info_id, full_name_zh, race_zh, classification_zh, 
            distinguishing_marks_zh, disappearance_details_zh, ai_model, created_at, updated_at) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            caseId,
            caseInfoId,
            translatedFields.full_name,
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