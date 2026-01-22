import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// 案件基础表
export const missingPersonsCases = sqliteTable('missing_persons_cases', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  caseTitle: text('case_title').notNull(),
  caseId: text('case_id').notNull(),
  imageWebpStatus: integer('image_webp_status').default(0),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
}, (table) => {
  return {
    caseIdIndex: uniqueIndex('idx_cases_case_id').on(table.caseId),
  };
});

// 案件信息表
export const missingPersonsInfo = sqliteTable('missing_persons_info', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  caseId: text('case_id').notNull(),
  title: text('title'),
  seoTitle: text('seo_title'),
  caseSummary: text('case_summary'),
  urlPath: text('url_path'),
  aiStatus: integer('ai_status').default(0),
  fullName: text('full_name'),
  race: text('race'),
  classification: text('classification'),
  distinguishingMarks: text('distinguishing_marks'),
  disappearanceDetails: text('disappearance_details'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
}, (table) => {
  return {
    caseIdIndex: uniqueIndex('idx_info_case_id').on(table.caseId),
  };
});

// 案件资产表
export const missingPersonsAssets = sqliteTable('missing_persons_assets', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  caseId: text('case_id').notNull(),
  isPrimary: integer('is_primary').default(0),
  sortOrder: integer('sort_order').default(99),
  assetType: text('asset_type').default('photo'),
  originalFilename: text('original_filename'),
  newFilename: text('new_filename').notNull(),
  storagePath: text('storage_path').notNull(),
  width: integer('width'),
  height: integer('height'),
  fileSize: integer('file_size'),
  altEn: text('alt_en', { length: 500 }),
  altZh: text('alt_zh', { length: 500 }),
  altEs: text('alt_es', { length: 500 }),
  captionEn: text('caption_en'),
  captionZh: text('caption_zh'),
  captionEs: text('caption_es'),
  aiProcessed: integer('ai_processed').default(0),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
}, (table) => {
  return {
    caseIdIndex: uniqueIndex('idx_assets_case_id').on(table.caseId),
  };
});

// 标签表
export const missingPersonsTags = sqliteTable('missing_persons_tags', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
}, (table) => {
  return {
    slugIndex: uniqueIndex('idx_tags_slug').on(table.slug),
  };
});

// 标签关联表
export const missingPersonsTagRelations = sqliteTable('missing_persons_tag_relations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  caseId: text('case_id').notNull(),
  tagId: integer('tag_id').notNull(),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});

// 地理翻译表
export const geoTranslations = sqliteTable('geo_translations', {
  geonameId: integer('geoname_id').primaryKey(),
  enName: text('en_name', { length: 255 }).notNull(),
  zhName: text('zh_name', { length: 255 }).notNull(),
  esName: text('es_name', { length: 255 }).notNull(),
  geoType: text('geo_type', { length: 50 }).notNull(),
  parentStateCode: text('parent_state_code', { length: 10 }),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`)
}, (table) => {
  return {
    enNameIndex: uniqueIndex('idx_geo_en_name').on(table.enName),
  };
});

// AI翻译结果表
export const casesInfoZh = sqliteTable('cases_info_zh', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  caseId: text('case_id').notNull(),
  caseInfoId: integer('case_info_id').notNull(),
  fullNameZh: text('full_name_zh', { length: 255 }),
  raceZh: text('race_zh', { length: 100 }),
  classificationZh: text('classification_zh', { length: 100 }),
  distinguishingMarksZh: text('distinguishing_marks_zh'),
  disappearanceDetailsZh: text('disappearance_details_zh'),
  aiModel: text('ai_model', { length: 100 }),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
}, (table) => {
  return {
    caseIdIndex: uniqueIndex('idx_cases_info_zh_case_id').on(table.caseId),
    caseInfoIdIndex: uniqueIndex('idx_cases_info_zh_case_info_id').on(table.caseInfoId),
  };
});

// 任务进度表
export const taskProgress = sqliteTable('task_progress', {
  taskName: text('task_name').primaryKey(),
  lastId: integer('last_id').notNull().default(0),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});