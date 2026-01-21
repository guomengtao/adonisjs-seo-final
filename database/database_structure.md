# 数据库表结构信息

## adonis_schema 表

### 字段信息
| 字段名 | 数据类型 | 长度 | 允许空 | 默认值 | 描述 |
|--------|----------|------|--------|--------|------|
| id | integer |  | NO | nextval('adonis_schema_id_seq'::regclass) |  |
| name | character varying(255) | 255 | NO |  |  |
| batch | integer |  | NO |  |  |
| migration_time | timestamp with time zone |  | YES | CURRENT_TIMESTAMP |  |

### 约束信息
| 约束名 | 约束类型 | 约束列 |
|--------|----------|--------|
| adonis_schema_pkey | PRIMARY KEY | id |

### 外键关联
| 外键名 | 外键列 | 参考表 | 参考列 | 匹配方式 | 更新规则 | 删除规则 |
|--------|--------|--------|--------|----------|----------|----------|
| - | - | - | - | - | - | - |

### 索引信息
| 索引名 | 索引列 | 是否唯一 | 索引类型 | 表空间 |
|--------|--------|----------|----------|--------|
| adonis_schema_pkey | id | 是 | BTREE | - |

---

## adonis_schema_versions 表

### 字段信息
| 字段名 | 数据类型 | 长度 | 允许空 | 默认值 | 描述 |
|--------|----------|------|--------|--------|------|
| version | integer |  | NO |  |  |

### 约束信息
| 约束名 | 约束类型 | 约束列 |
|--------|----------|--------|
| adonis_schema_versions_pkey | PRIMARY KEY | version |

### 外键关联
| 外键名 | 外键列 | 参考表 | 参考列 | 匹配方式 | 更新规则 | 删除规则 |
|--------|--------|--------|--------|----------|----------|----------|
| - | - | - | - | - | - | - |

### 索引信息
| 索引名 | 索引列 | 是否唯一 | 索引类型 | 表空间 |
|--------|--------|----------|----------|--------|
| adonis_schema_versions_pkey | version | 是 | BTREE | - |

---

## case_html_analysis 表

### 字段信息
| 字段名 | 数据类型 | 长度 | 允许空 | 默认值 | 描述 |
|--------|----------|------|--------|--------|------|
| id | integer |  | NO | nextval('case_html_analysis_id_seq'::regclass) |  |
| case_info_id | integer |  | NO |  |  |
| case_id | character varying(255) | 255 | NO |  |  |
| strong_count | integer |  | YES | 0 |  |
| has_details_heading | boolean |  | YES | false |  |
| extracted_at | timestamp with time zone |  | YES | CURRENT_TIMESTAMP |  |

### 约束信息
| 约束名 | 约束类型 | 约束列 |
|--------|----------|--------|
| fk_case_info | FOREIGN KEY | case_info_id |
| case_html_analysis_pkey | PRIMARY KEY | id |
| unique_case_analysis | UNIQUE | case_info_id |

### 外键关联
| 外键名 | 外键列 | 参考表 | 参考列 | 匹配方式 | 更新规则 | 删除规则 |
|--------|--------|--------|--------|----------|----------|----------|
| fk_case_info | case_info_id | missing_persons_info | id | NONE | NO ACTION | CASCADE |

### 索引信息
| 索引名 | 索引列 | 是否唯一 | 索引类型 | 表空间 |
|--------|--------|----------|----------|--------|
| case_html_analysis_pkey | id | 是 | BTREE | - |
| idx_strong_count | strong_count DESC | 否 | BTREE | - |
| unique_case_analysis | case_info_id | 是 | BTREE | - |

---

## case_summaries 表

### 字段信息
| 字段名 | 数据类型 | 长度 | 允许空 | 默认值 | 描述 |
|--------|----------|------|--------|--------|------|
| id | integer |  | NO | nextval('case_summaries_id_seq'::regclass) |  |
| case_id | character varying(255) | 255 | NO |  |  |
| lang | character varying(10) | 10 | NO |  |  |
| summary | text | -5 | NO |  |  |
| ai_model | character varying(50) | 50 | NO | 'models/gemini-2.5-flash'::character varying |  |
| created_at | timestamp with time zone |  | YES | CURRENT_TIMESTAMP |  |
| updated_at | timestamp with time zone |  | YES | CURRENT_TIMESTAMP |  |

### 约束信息
| 约束名 | 约束类型 | 约束列 |
|--------|----------|--------|
| case_summaries_pkey | PRIMARY KEY | id |

### 外键关联
| 外键名 | 外键列 | 参考表 | 参考列 | 匹配方式 | 更新规则 | 删除规则 |
|--------|--------|--------|--------|----------|----------|----------|
| - | - | - | - | - | - | - |

### 索引信息
| 索引名 | 索引列 | 是否唯一 | 索引类型 | 表空间 |
|--------|--------|----------|----------|--------|
| case_summaries_pkey | id | 是 | BTREE | - |
| idx_case_id_lang | case_id, lang | 是 | BTREE | - |

---

## geo_translations 表

### 字段信息
| 字段名 | 数据类型 | 长度 | 允许空 | 默认值 | 描述 |
|--------|----------|------|--------|--------|------|
| geoname_id | integer |  | YES |  |  |
| en_name | character varying(255) | 255 | NO |  |  |
| zh_name | character varying(255) | 255 | YES |  |  |
| es_name | character varying(255) | 255 | YES |  |  |
| geo_type | character varying(50) | 50 | YES |  |  |
| parent_state_code | character varying(10) | 10 | YES |  |  |
| cases_count | integer |  | YES | 0 |  |
| slug | character varying(255) | 255 | YES |  |  |
| fips_code | character varying(10) | 10 | YES |  |  |
| id | bigint |  | NO | nextval('geo_translations_id_seq'::regclass) |  |

### 约束信息
| 约束名 | 约束类型 | 约束列 |
|--------|----------|--------|
| geo_translations_pkey | PRIMARY KEY | id |

### 外键关联
| 外键名 | 外键列 | 参考表 | 参考列 | 匹配方式 | 更新规则 | 删除规则 |
|--------|--------|--------|--------|----------|----------|----------|
| - | - | - | - | - | - | - |

### 索引信息
| 索引名 | 索引列 | 是否唯一 | 索引类型 | 表空间 |
|--------|--------|----------|----------|--------|
| geo_translations_pkey | id | 是 | BTREE | - |
| idx_geo_fips_lookup | fips_code | 否 | BTREE | - |
| idx_geo_slug | slug | 否 | BTREE | - |
| idx_geo_translations_fips_type | fips_code, geo_type | 是 | BTREE | - |
| idx_geo_zh_name | zh_name | 否 | BTREE | - |

---

## missing_persons_assets 表

### 字段信息
| 字段名 | 数据类型 | 长度 | 允许空 | 默认值 | 描述 |
|--------|----------|------|--------|--------|------|
| id | integer |  | NO | nextval('missing_persons_assets_id_seq'::regclass) |  |
| case_id | character varying(255) | 255 | NO |  |  |
| is_primary | integer |  | YES | 0 |  |
| sort_order | integer |  | YES | 99 |  |
| asset_type | character varying(255) | 255 | YES | 'photo'::character varying |  |
| original_filename | character varying(255) | 255 | YES |  |  |
| new_filename | character varying(255) | 255 | NO |  |  |
| storage_path | character varying(255) | 255 | NO |  |  |
| width | integer |  | YES |  |  |
| height | integer |  | YES |  |  |
| file_size | integer |  | YES |  |  |
| alt_en | character varying(500) | 500 | YES |  |  |
| alt_zh | character varying(500) | 500 | YES |  |  |
| alt_es | character varying(500) | 500 | YES |  |  |
| caption_en | text | -5 | YES |  |  |
| caption_zh | text | -5 | YES |  |  |
| caption_es | text | -5 | YES |  |  |
| ai_processed | integer |  | YES | 0 |  |
| created_at | timestamp with time zone |  | YES | CURRENT_TIMESTAMP |  |
| updated_at | timestamp with time zone |  | YES | CURRENT_TIMESTAMP |  |

### 约束信息
| 约束名 | 约束类型 | 约束列 |
|--------|----------|--------|
| missing_persons_assets_pkey | PRIMARY KEY | id |
| uniq_case_filename | UNIQUE | original_filename, case_id |

### 外键关联
| 外键名 | 外键列 | 参考表 | 参考列 | 匹配方式 | 更新规则 | 删除规则 |
|--------|--------|--------|--------|----------|----------|----------|
| - | - | - | - | - | - | - |

### 索引信息
| 索引名 | 索引列 | 是否唯一 | 索引类型 | 表空间 |
|--------|--------|----------|----------|--------|
| idx_single_primary_per_case | case_id | 是 | BTREE | - |
| missing_persons_assets_pkey | id | 是 | BTREE | - |
| uniq_case_filename | case_id, original_filename | 是 | GIN | - |

---

## missing_persons_cases 表

### 字段信息
| 字段名 | 数据类型 | 长度 | 允许空 | 默认值 | 描述 |
|--------|----------|------|--------|--------|------|
| id | integer |  | NO | nextval('missing_persons_cases_id_seq'::regclass) |  |
| case_title | character varying(255) | 255 | NO |  |  |
| case_id | character varying(255) | 255 | NO |  |  |
| image_webp_status | integer |  | YES | 0 |  |
| created_at | timestamp with time zone |  | YES | CURRENT_TIMESTAMP |  |
| updated_at | timestamp with time zone |  | YES | CURRENT_TIMESTAMP |  |
| analysis_result | text | -5 | YES |  |  |
| scraped_content | text | -5 | YES |  |  |
| case_url | character varying(255) | 255 | YES |  |  |
| case_html | text | -5 | YES |  |  |
| image_count | integer |  | YES | 0 |  |
| html_status | integer |  | YES | 0 |  |
| info_status | integer |  | YES | 0 |  |
| process_code | character varying(255) | 255 | YES |  |  |

### 约束信息
| 约束名 | 约束类型 | 约束列 |
|--------|----------|--------|
| missing_persons_cases_pkey | PRIMARY KEY | id |
| missing_persons_cases_case_id_unique | UNIQUE | case_id |

### 外键关联
| 外键名 | 外键列 | 参考表 | 参考列 | 匹配方式 | 更新规则 | 删除规则 |
|--------|--------|--------|--------|----------|----------|----------|
| - | - | - | - | - | - | - |

### 索引信息
| 索引名 | 索引列 | 是否唯一 | 索引类型 | 表空间 |
|--------|--------|----------|----------|--------|
| missing_persons_cases_case_id_unique | case_id | 是 | BTREE | - |
| missing_persons_cases_pkey | id | 是 | BTREE | - |

---

## missing_persons_info 表

### 字段信息
| 字段名 | 数据类型 | 长度 | 允许空 | 默认值 | 描述 |
|--------|----------|------|--------|--------|------|
| id | integer |  | NO | nextval('missing_persons_info_id_seq'::regclass) |  |
| case_id | character varying(255) | 255 | NO |  | 唯一案件编号 (NamUs ID 或自定义 ID) |
| url_path | text | -5 | YES |  | SEO 优化后的访问路径，格式：州/县/市/姓名 |
| created_at | timestamp with time zone |  | YES | CURRENT_TIMESTAMP |  |
| updated_at | timestamp with time zone |  | YES | CURRENT_TIMESTAMP |  |
| age_at_missing | character varying(50) | 50 | YES |  | 失踪时的年龄 |
| date_of_birth | character varying(100) | 100 | YES |  | 出生日期 |
| disappearance_details_word_count | integer |  | YES | 0 |  |
| distinguishing_marks | text | -5 | YES |  |  |
| full_name | character varying(255) | 255 | YES |  | 失踪人员全名 |
| height | text | -5 | YES |  |  |
| investigating_agency | text | -5 | YES |  | 负责调查的警局/机构名称 |
| disappearance_details | text | -5 | YES |  |  |
| missing_since | character varying(100) | 100 | YES |  | 最后一次被见到的日期 |
| race | character varying(100) | 100 | YES |  | 种族/族裔 |
| sex | text | -5 | YES |  | 性别 |
| source_info | text | -5 | YES |  | 数据来源信息 (如 NamUs, NCMEC) |
| weight | text | -5 | YES |  |  |
| official_update_count | integer |  | YES |  |  |
| official_last_updated | date |  | YES |  | 官方源最后一次更新的日期 |
| official_update_history | text | -5 | YES |  |  |
| status | text | -5 | YES | 'active'::text | 案件状态：active (活跃), cold (陈年旧案), archived (归档) |
| state_ref | character(2) | 2 | YES |  | 所属州简写 (如：NY, CA)，关联 geo_translations.fips_code |
| county_fips_ref | character varying(5) | 5 | YES |  | 所属县 5 位 FIPS 码，关联 geo_translations.fips_code |
| city_geo_id | bigint |  | YES |  | 所属城市 ID，关联 geo_translations.geoname_id |
| classification | character varying(100) | 100 | YES |  | 案件分类 (如：Endangered Missing, Runaway 等) |
| state_zh | character varying(255) | 255 | YES |  |  |
| county_zh | character varying(255) | 255 | YES |  |  |
| city_zh | character varying(255) | 255 | YES |  |  |
| state_slug | character varying(255) | 255 | YES |  |  |
| county_slug | character varying(255) | 255 | YES |  |  |
| city_slug | character varying(255) | 255 | YES |  |  |
| path | text | -5 | YES |  |  |

### 约束信息
| 约束名 | 约束类型 | 约束列 |
|--------|----------|--------|
| missing_persons_info_pkey | PRIMARY KEY | id |
| missing_persons_info_case_id_unique | UNIQUE | case_id |

### 外键关联
| 外键名 | 外键列 | 参考表 | 参考列 | 匹配方式 | 更新规则 | 删除规则 |
|--------|--------|--------|--------|----------|----------|----------|
| - | - | - | - | - | - | - |

### 索引信息
| 索引名 | 索引列 | 是否唯一 | 索引类型 | 表空间 |
|--------|--------|----------|----------|--------|
| idx_official_update | official_last_updated DESC | 否 | BTREE | - |
| missing_persons_info_case_id_unique | case_id | 是 | BTREE | - |
| missing_persons_info_pkey | id | 是 | BTREE | - |

---

## missing_persons_tag_relations 表

### 字段信息
| 字段名 | 数据类型 | 长度 | 允许空 | 默认值 | 描述 |
|--------|----------|------|--------|--------|------|
| id | integer |  | NO | nextval('missing_persons_tag_relations_id_seq'::regclass) |  |
| case_id | character varying(255) | 255 | NO |  |  |
| tag_id | integer |  | NO |  |  |
| created_at | timestamp with time zone |  | YES | CURRENT_TIMESTAMP |  |

### 约束信息
| 约束名 | 约束类型 | 约束列 |
|--------|----------|--------|
| missing_persons_tag_relations_tag_id_foreign | FOREIGN KEY | tag_id |
| missing_persons_tag_relations_pkey | PRIMARY KEY | id |

### 外键关联
| 外键名 | 外键列 | 参考表 | 参考列 | 匹配方式 | 更新规则 | 删除规则 |
|--------|--------|--------|--------|----------|----------|----------|
| missing_persons_tag_relations_tag_id_foreign | tag_id | missing_persons_tags | id | NONE | NO ACTION | CASCADE |

### 索引信息
| 索引名 | 索引列 | 是否唯一 | 索引类型 | 表空间 |
|--------|--------|----------|----------|--------|
| idx_unique_case_tag | case_id, tag_id | 是 | BTREE | - |
| missing_persons_tag_relations_pkey | id | 是 | BTREE | - |

---

## missing_persons_tags 表

### 字段信息
| 字段名 | 数据类型 | 长度 | 允许空 | 默认值 | 描述 |
|--------|----------|------|--------|--------|------|
| id | integer |  | NO | nextval('missing_persons_tags_id_seq'::regclass) |  |
| name | character varying(255) | 255 | NO |  |  |
| slug | character varying(255) | 255 | NO |  |  |
| created_at | timestamp with time zone |  | YES | CURRENT_TIMESTAMP |  |
| updated_at | timestamp with time zone |  | YES | CURRENT_TIMESTAMP |  |
| name_zh | character varying(255) | 255 | NO |  |  |
| name_es | character varying(255) | 255 | NO |  |  |
| ai_model | character varying(50) | 50 | NO |  |  |
| cases_count | integer |  | NO | 0 |  |

### 约束信息
| 约束名 | 约束类型 | 约束列 |
|--------|----------|--------|
| missing_persons_tags_pkey | PRIMARY KEY | id |
| missing_persons_tags_slug_unique | UNIQUE | slug |

### 外键关联
| 外键名 | 外键列 | 参考表 | 参考列 | 匹配方式 | 更新规则 | 删除规则 |
|--------|--------|--------|--------|----------|----------|----------|
| - | - | - | - | - | - | - |

### 索引信息
| 索引名 | 索引列 | 是否唯一 | 索引类型 | 表空间 |
|--------|--------|----------|----------|--------|
| missing_persons_tags_pkey | id | 是 | BTREE | - |
| missing_persons_tags_slug_unique | slug | 是 | BTREE | - |

---

## task_progress 表

### 字段信息
| 字段名 | 数据类型 | 长度 | 允许空 | 默认值 | 描述 |
|--------|----------|------|--------|--------|------|
| task_name | text | -5 | NO |  |  |
| last_id | integer |  | NO | 0 |  |
| updated_at | timestamp without time zone |  | YES | CURRENT_TIMESTAMP |  |

### 约束信息
| 约束名 | 约束类型 | 约束列 |
|--------|----------|--------|
| task_progress_pkey | PRIMARY KEY | task_name |

### 外键关联
| 外键名 | 外键列 | 参考表 | 参考列 | 匹配方式 | 更新规则 | 删除规则 |
|--------|--------|--------|--------|----------|----------|----------|
| - | - | - | - | - | - | - |

### 索引信息
| 索引名 | 索引列 | 是否唯一 | 索引类型 | 表空间 |
|--------|--------|----------|----------|--------|
| task_progress_pkey | task_name | 是 | BTREE | - |

---

## us_geo_mapping 表

### 字段信息
| 字段名 | 数据类型 | 长度 | 允许空 | 默认值 | 描述 |
|--------|----------|------|--------|--------|------|
| city | character varying(255) | 255 | YES |  |  |
| city_ascii | character varying(255) | 255 | YES |  |  |
| state_id | character(2) | 2 | YES |  |  |
| state_name | character varying(100) | 100 | YES |  |  |
| county_fips | character varying(10) | 10 | YES |  |  |
| county_name | character varying(255) | 255 | YES |  |  |
| lat | numeric(10,7) |  | YES |  |  |
| lng | numeric(10,7) |  | YES |  |  |
| population | integer |  | YES |  |  |
| density | numeric(10,2) |  | YES |  |  |
| source | character varying(50) | 50 | YES |  |  |
| military | boolean |  | YES |  |  |
| incorporated | boolean |  | YES |  |  |
| timezone | character varying(100) | 100 | YES |  |  |
| ranking | integer |  | YES |  |  |
| zips | text | -5 | YES |  |  |
| id | bigint |  | NO |  |  |

### 约束信息
| 约束名 | 约束类型 | 约束列 |
|--------|----------|--------|
| us_geo_mapping_pkey | PRIMARY KEY | id |

### 外键关联
| 外键名 | 外键列 | 参考表 | 参考列 | 匹配方式 | 更新规则 | 删除规则 |
|--------|--------|--------|--------|----------|----------|----------|
| - | - | - | - | - | - | - |

### 索引信息
| 索引名 | 索引列 | 是否唯一 | 索引类型 | 表空间 |
|--------|--------|----------|----------|--------|
| us_geo_mapping_pkey | id | 是 | BTREE | - |

---

