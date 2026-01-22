import { BaseCommand } from '@adonisjs/core/ace';
import db from '@adonisjs/lucid/services/db';
import GeminiService from '#services/gemini_service'

// 修复TypeScript类型检查
const GeminiServiceType = GeminiService as any;
import { validateTagLanguages } from '../app/utils/language_validator.js';

export default class GeminiTagsRun extends BaseCommand {
  static commandName = 'gemini:tags';
  static description = '使用Gemini AI生成案件的多语言标签';
  static options = { startApp: true };

  async run() {
    try {
      this.logger.info('🚀 启动Gemini AI多语言标签生成服务...');

      // 1. 初始化任务进度
      await this.initTaskProgress();

      // 2. 获取当前任务进度
      const taskProgressResult = await db.connection().rawQuery("SELECT * FROM task_progress WHERE task_name = 'ai-tags'");

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
      const nextCaseResult = await db.connection().rawQuery('SELECT * FROM missing_persons_cases WHERE id > ? ORDER BY id ASC LIMIT 1', [last_id]);

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

      // 5. 使用Gemini AI生成多语言标签
      const geminiService = GeminiServiceType.getInstance();
      const tagsResult = await geminiService.generateMultiLangTags(cleanText);
      const { tags, modelName } = tagsResult || { tags: null, modelName: null };

      if (!tags || !modelName) {
        this.logger.error(`❌ 案件 ${case_id} 标签生成失败，跳过`);
        await this.updateTaskProgress(id);
        return;
      }

      // 6. 将结果写入数据库
      await this.saveTags(case_id, tags, modelName);

      this.logger.success(`✅ 案件 ${case_id} 标签生成完成`);

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
      const taskExists = await db.connection().rawQuery("SELECT * FROM task_progress WHERE task_name = 'ai-tags'");

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
          'ai-tags',
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
    await db.connection().rawQuery( // 使用默认连接
      "UPDATE task_progress SET last_id = ?, updated_at = ? WHERE task_name = 'ai-tags'",
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

  private async saveTags(caseId: string, tags: Array<{ slug: string; en: string; zh: string; es: string }>, modelName: string) {
    try {
      // 1. 验证输入参数
      if (!caseId || !tags || tags.length === 0) {
        this.logger.error('❌ 输入参数错误: caseId或tags为空');
        return;
      }
      
      // 2. 检查标签表是否存在
      const tagsTableExists = await db.connection().rawQuery("PRAGMA table_info(missing_persons_tags)");

      if (!tagsTableExists.rows || tagsTableExists.rows.length === 0) {
        this.logger.info('📋 创建标签表...');
        await db.connection().rawQuery(`
          CREATE TABLE IF NOT EXISTS missing_persons_tags (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name VARCHAR(255) NOT NULL,
            slug VARCHAR(255) UNIQUE NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            name_zh VARCHAR(255) NOT NULL,
            name_es VARCHAR(255) NOT NULL,
            ai_model VARCHAR(255) NOT NULL
          );
        `);
        await db.connection().rawQuery("CREATE UNIQUE INDEX IF NOT EXISTS missing_persons_tags_slug_unique ON missing_persons_tags (slug);");
        this.logger.info('✅ 标签表创建成功');
      } else {
        // SQLite不支持通过SQL检查列是否存在，这里简化处理
        try {
          // 尝试查询ai_model字段
          await db.connection().rawQuery("SELECT ai_model FROM missing_persons_tags LIMIT 1");
        } catch {
          this.logger.info('🔧 添加ai_model字段到标签表...');
          await db.connection().rawQuery("ALTER TABLE missing_persons_tags ADD COLUMN ai_model VARCHAR(255) NOT NULL DEFAULT 'models/gemini-2.5-flash';");
          this.logger.info('✅ ai_model字段添加成功');
        }
      }

      // 3. 检查标签关系表是否存在
      const relationsTableExists = await db.connection().rawQuery("PRAGMA table_info(missing_persons_tag_relations)");

      if (!relationsTableExists.rows || relationsTableExists.rows.length === 0) {
        this.logger.info('📋 创建标签关系表...');
        await db.connection().rawQuery(`
          CREATE TABLE IF NOT EXISTS missing_persons_tag_relations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            case_id VARCHAR(255) NOT NULL,
            tag_id INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
        `);
        await db.connection().rawQuery("CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_case_tag ON missing_persons_tag_relations (case_id, tag_id);");
        this.logger.info('✅ 标签关系表创建成功');
      }

      // 4. 保存标签
      const savedTags: string[] = [];
      
      for (const tag of tags) {
        const { slug, en, zh, es } = tag;
        
        try {
          // 验证单个标签内容
          if (!slug || !en || !zh || !es) {
            this.logger.error(`   ❌ 标签内容错误: slug=${slug}, en=${en}, zh=${zh}, es=${es}`);
            continue;
          }
          
          // 验证标签的语言正确性
          const languageValidation = validateTagLanguages({ slug, en, zh, es });
          if (!languageValidation.isValid) {
            this.logger.error(`   ❌ 标签语言验证失败: ${slug}`);
            languageValidation.errors.forEach((error: string) => {
              this.logger.error(`      ${error}`);
            });
            continue;
          }
          
          // 先检查标签是否已存在
          const existingTag = await db.connection().rawQuery(`SELECT * FROM missing_persons_tags WHERE slug = ?`, [slug]);
          
          // 处理不同的结果格式
          let existingTagData;
          if (Array.isArray(existingTag)) {
            existingTagData = existingTag[0];
          } else if (existingTag.rows) {
            existingTagData = existingTag.rows[0];
          } else if (existingTag && typeof existingTag === 'object') {
            existingTagData = existingTag;
          }
          
          let tagId: number;
          
          if (existingTagData) {
            // 标签已存在，获取ID
            tagId = existingTagData.id;
            this.logger.info(`   🔄 标签 ${slug} 已存在`);
          } else {
            // 标签不存在，插入新记录
            const insertResult = await db.connection().rawQuery(
              `INSERT INTO missing_persons_tags (name, slug, name_zh, name_es, ai_model) VALUES (?, ?, ?, ?, ?) RETURNING id`,
              [en, slug, zh, es, modelName]
            );
            
            // 处理不同的结果格式
            let insertResultData;
            if (Array.isArray(insertResult)) {
              insertResultData = insertResult[0];
            } else if (insertResult.rows) {
              insertResultData = insertResult.rows[0];
            } else if (insertResult && typeof insertResult === 'object') {
              insertResultData = insertResult;
            }
            
            if (insertResultData && insertResultData.id) {
              tagId = insertResultData.id;
              this.logger.info(`   📝 插入标签 ${slug} 成功`);
            } else {
              this.logger.error(`   ❌ 插入标签 ${slug} 失败`);
              continue;
            }
          }
          
          // 保存案件与标签的关系
            try {
              await db.connection().rawQuery(
                `INSERT INTO missing_persons_tag_relations (case_id, tag_id) VALUES (?, ?) ON CONFLICT (case_id, tag_id) DO NOTHING`,
                [caseId, tagId]
              );
              this.logger.info(`   📝 关联标签 ${slug} 到案件 ${caseId} 成功`);
            } catch (error) {
            this.logger.error(`   ❌ 关联标签 ${slug} 到案件 ${caseId} 失败: ${(error as Error).message}`);
            continue;
          }
          
          savedTags.push(slug);
          this.logger.info(`   ✅ 标签 ${slug} 保存并关联成功`);
        } catch (error) {
          this.logger.error(`   ❌ 处理标签 ${slug} 失败: ${(error as Error).message}`);
        }
      }

      if (savedTags.length > 0) {
        this.logger.success(`✅ 成功处理 ${savedTags.length} 个标签: ${savedTags.join(', ')}`);
      } else {
        this.logger.warning(`⚠️ 未成功处理任何标签`);
      }
    } catch (error) {
      this.logger.error('❌ 保存标签过程失败: ' + (error as Error).message);
    }
  }
}