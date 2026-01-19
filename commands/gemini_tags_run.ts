import { BaseCommand } from '@adonisjs/core/ace';
import db from '@adonisjs/lucid/services/db';
import GeminiService from '#services/gemini_service';

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
      const taskProgressResult = await db.connection('pg').rawQuery(
        "SELECT * FROM public.task_progress WHERE task_name = 'ai-tags'"
      );

      const taskProgress = taskProgressResult.rows[0];

      if (!taskProgress) {
        this.logger.error('❌ 任务进度记录不存在');
        return;
      }

      const { last_id } = taskProgress;

      // 3. 获取下一个案件
      const nextCaseResult = await db.connection('pg').rawQuery(
        'SELECT * FROM public.missing_persons_cases WHERE id > ? ORDER BY id ASC LIMIT 1',
        [last_id]
      );
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

      // 5. 使用Gemini AI生成多语言标签
      const geminiService = GeminiService.getInstance();
      const { tags, modelName } = await geminiService.generateMultiLangTags(cleanText);

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
      // 1. 检查任务进度表是否存在
      this.logger.debug('🔍 检查任务进度表是否存在...');
      const tableExistsResult = await db.connection('pg').rawQuery(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'task_progress'"
      );

      const tableExists = tableExistsResult.rows && tableExistsResult.rows.length > 0;

      if (!tableExists) {
        this.logger.info('📋 创建任务进度表...');
        // 创建任务进度表
        await db.connection('pg').rawQuery(`
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
      const taskExistsResult = await db.connection('pg').rawQuery(
        "SELECT * FROM public.task_progress WHERE task_name = 'ai-tags'"
      );

      const taskExists = taskExistsResult.rows && taskExistsResult.rows.length > 0;

      if (!taskExists) {
        this.logger.info('📋 初始化任务进度...');
        await db.connection('pg').rawQuery(
          "INSERT INTO public.task_progress (task_name, last_id, updated_at) VALUES ($1, $2, $3)",
          ['ai-tags', 0, new Date().toISOString()]
        );
        this.logger.debug('✅ 任务进度记录初始化成功');
      }
    } catch (error: any) {
      this.logger.error(`❌ 创建任务进度表失败: ${error.message}`);
      throw error;
    }
  }

  private async updateTaskProgress(lastId: number) {
    await db.connection('pg').rawQuery(
      "UPDATE public.task_progress SET last_id = ?, updated_at = ? WHERE task_name = 'ai-tags'",
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
      const tagsTableExists = await db.connection('pg').rawQuery("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'missing_persons_tags'");

      if (!tagsTableExists.rows || tagsTableExists.rows.length === 0) {
        this.logger.info('📋 创建标签表...');
        await db.connection('pg').rawQuery(`
          CREATE TABLE public.missing_persons_tags (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            slug VARCHAR(255) UNIQUE NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            name_zh VARCHAR(255) NOT NULL,
            name_es VARCHAR(255) NOT NULL,
            ai_model VARCHAR(255) NOT NULL
          );
        `);
        await db.connection('pg').rawQuery("ALTER TABLE public.missing_persons_tags ADD CONSTRAINT missing_persons_tags_slug_format_check CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$');");
        await db.connection('pg').rawQuery("CREATE UNIQUE INDEX missing_persons_tags_slug_unique ON public.missing_persons_tags (slug);");
        this.logger.info('✅ 标签表创建成功');
      } else {
        // 检查ai_model字段是否存在，如果不存在则添加
        const columnExists = await db.connection('pg').rawQuery(
          "SELECT column_name FROM information_schema.columns WHERE table_name = 'missing_persons_tags' AND column_name = 'ai_model'"
        );
        
        if (!columnExists.rows || columnExists.rows.length === 0) {
          this.logger.info('🔧 添加ai_model字段到标签表...');
          await db.connection('pg').rawQuery("ALTER TABLE public.missing_persons_tags ADD COLUMN ai_model VARCHAR(255) NOT NULL DEFAULT 'models/gemini-2.5-flash'");
          this.logger.info('✅ ai_model字段添加成功');
        }
      }

      // 3. 检查标签关系表是否存在
      const relationsTableExists = await db.connection('pg').rawQuery("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'missing_persons_tag_relations'");

      if (!relationsTableExists.rows || relationsTableExists.rows.length === 0) {
        this.logger.info('📋 创建标签关系表...');
        await db.connection('pg').rawQuery(`
          CREATE TABLE public.missing_persons_tag_relations (
            id SERIAL PRIMARY KEY,
            case_id VARCHAR(255) NOT NULL,
            tag_id INTEGER NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );
        `);
        await db.connection('pg').rawQuery("ALTER TABLE public.missing_persons_tag_relations ADD CONSTRAINT missing_persons_tag_relations_tag_id_foreign FOREIGN KEY (tag_id) REFERENCES public.missing_persons_tags(id) ON DELETE CASCADE;");
        await db.connection('pg').rawQuery("CREATE UNIQUE INDEX idx_unique_case_tag ON public.missing_persons_tag_relations (case_id, tag_id);");
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
          
          // 先检查标签是否已存在
          const existingTag = await db.connection('pg').rawQuery(`SELECT * FROM public.missing_persons_tags WHERE slug = ?`, [slug]);
          
          let tagId: number;
          
          if (existingTag.rows && existingTag.rows.length > 0) {
            // 标签已存在，获取ID
            tagId = existingTag.rows[0].id;
            this.logger.info(`   🔄 标签 ${slug} 已存在`);
          } else {
            // 标签不存在，插入新记录
            const insertResult = await db.connection('pg').rawQuery(
              `INSERT INTO public.missing_persons_tags (name, slug, name_zh, name_es, ai_model) VALUES (?, ?, ?, ?, ?) RETURNING id`,
              [en, slug, zh, es, modelName]
            );
            
            if (insertResult.rows && insertResult.rows.length > 0) {
              tagId = insertResult.rows[0].id;
              this.logger.info(`   📝 插入标签 ${slug} 成功`);
            } else {
              this.logger.error(`   ❌ 插入标签 ${slug} 失败`);
              continue;
            }
          }
          
          // 保存案件与标签的关系
            try {
              await db.connection('pg').rawQuery(
                `INSERT INTO public.missing_persons_tag_relations (case_id, tag_id) VALUES (?, ?) ON CONFLICT (case_id, tag_id) DO NOTHING`,
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