import { BaseCommand } from '@adonisjs/core/ace';
import db from '@adonisjs/lucid/services/db';

// 定义标签类型
interface Tag {
  id: number;
  name: string;
  slug: string;
  name_zh: string;
  name_es: string;
  created_at: string;
  ai_model: string;
}

// 定义标签关系类型
interface TagRelation {
  case_id: string;
  tag_id: number;
  slug: string;
}

export default class CheckTagsRun extends BaseCommand {
  static commandName = 'check:tags';
  static description = '检查数据库中的标签存储情况';
  static options = { startApp: true };

  async run() {
    try {
      this.logger.info('🔍 查询数据库中的标签存储情况...');

      // 查询最近添加的标签
      const tagsResult = await db.connection().rawQuery( // 使用默认连接
        'SELECT * FROM public.missing_persons_tags ORDER BY created_at DESC LIMIT 10'
      );

      const tags: Tag[] = tagsResult.rows;

      if (!tags || tags.length === 0) {
        this.logger.warning('⚠️ 数据库中没有标签记录');
        return;
      }

      this.logger.info('📋 最近添加的标签:');
      this.logger.info('='.repeat(80));

      tags.forEach((tag: Tag, index: number) => {
        this.logger.info(`${index + 1}. ID: ${tag.id}`);
        this.logger.info(`   Slug: ${tag.slug}`);
        this.logger.info(`   英文: ${tag.name}`);
        this.logger.info(`   中文: ${tag.name_zh}`);
        this.logger.info(`   西班牙文: ${tag.name_es}`);
        this.logger.info(`   AI模型: ${tag.ai_model}`);
        this.logger.info(`   创建时间: ${new Date(tag.created_at).toLocaleString()}`);
        this.logger.info('-'.repeat(80));
      });

      // 查询标签关系
      const relationsResult = await db.connection().rawQuery( // 使用默认连接
        `SELECT mtr.case_id, mtr.tag_id, mpt.slug
         FROM public.missing_persons_tag_relations mtr
         JOIN public.missing_persons_tags mpt ON mtr.tag_id = mpt.id
         ORDER BY mtr.created_at DESC
         LIMIT 10`
      );

      const relations: TagRelation[] = relationsResult.rows;

      if (!relations || relations.length === 0) {
        this.logger.warning('⚠️ 数据库中没有标签关系记录');
        return;
      }

      this.logger.info('📋 最近的标签关系:');
      this.logger.info('='.repeat(80));

      relations.forEach((relation: TagRelation, index: number) => {
        this.logger.info(`${index + 1}. 案件ID: ${relation.case_id}`);
        this.logger.info(`   标签ID: ${relation.tag_id}`);
        this.logger.info(`   标签Slug: ${relation.slug}`);
        this.logger.info('-'.repeat(80));
      });

      this.logger.success('✅ 查询完成');
    } catch (error) {
      this.logger.error(`❌ 查询失败: ${(error as Error).message}`);
    }
  }
}