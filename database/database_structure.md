# 数据库表结构信息

## adonis_schema 表

### 字段信息
| 字段名 | 数据类型 | 长度 | 允许空 | 默认值 | 描述 |
|--------|----------|------|--------|--------|------|
| id | INTEGER |  | YES |  |  |
| batch | INTEGER |  | YES |  |  |
| migration_time | TEXT |  | YES |  |  |
| name | TEXT |  | YES |  |  |

### 约束信息
| 约束名 | 约束类型 | 约束列 |
|--------|----------|--------|
| PRIMARY KEY | PRIMARY KEY | id |

### 外键关联
| 外键名 | 外键列 | 参考表 | 参考列 | 匹配方式 | 更新规则 | 删除规则 |
|--------|--------|--------|--------|----------|----------|----------|
| - | - | - | - | - | - | - |

### 索引信息
| 索引名 | 索引列 | 是否唯一 | 索引类型 | 表空间 |
|--------|--------|----------|----------|--------|
| - | - | - | - | - |

---

## adonis_schema_versions 表

### 字段信息
| 字段名 | 数据类型 | 长度 | 允许空 | 默认值 | 描述 |
|--------|----------|------|--------|--------|------|
| version | INTEGER |  | YES |  |  |

### 约束信息
| 约束名 | 约束类型 | 约束列 |
|--------|----------|--------|

### 外键关联
| 外键名 | 外键列 | 参考表 | 参考列 | 匹配方式 | 更新规则 | 删除规则 |
|--------|--------|--------|--------|----------|----------|----------|
| - | - | - | - | - | - | - |

### 索引信息
| 索引名 | 索引列 | 是否唯一 | 索引类型 | 表空间 |
|--------|--------|----------|----------|--------|
| - | - | - | - | - |

---

## case_html_analysis 表

### 字段信息
| 字段名 | 数据类型 | 长度 | 允许空 | 默认值 | 描述 |
|--------|----------|------|--------|--------|------|
| id | INTEGER |  | YES |  |  |
| case_info_id | INTEGER |  | YES |  |  |
| strong_count | INTEGER |  | YES |  |  |
| has_details_heading | INTEGER |  | YES |  |  |
| extracted_at | TEXT |  | YES |  |  |
| case_id | TEXT |  | YES |  |  |

### 约束信息
| 约束名 | 约束类型 | 约束列 |
|--------|----------|--------|
| PRIMARY KEY | PRIMARY KEY | id |

### 外键关联
| 外键名 | 外键列 | 参考表 | 参考列 | 匹配方式 | 更新规则 | 删除规则 |
|--------|--------|--------|--------|----------|----------|----------|
| - | - | - | - | - | - | - |

### 索引信息
| 索引名 | 索引列 | 是否唯一 | 索引类型 | 表空间 |
|--------|--------|----------|----------|--------|
| - | - | - | - | - |

---

## case_summaries 表

### 字段信息
| 字段名 | 数据类型 | 长度 | 允许空 | 默认值 | 描述 |
|--------|----------|------|--------|--------|------|
| id | INTEGER |  | YES |  |  |
| created_at | TEXT |  | YES |  |  |
| updated_at | TEXT |  | YES |  |  |
| ai_model | TEXT |  | YES |  |  |
| summary | TEXT |  | YES |  |  |
| case_id | TEXT |  | YES |  |  |
| lang | TEXT |  | YES |  |  |

### 约束信息
| 约束名 | 约束类型 | 约束列 |
|--------|----------|--------|
| PRIMARY KEY | PRIMARY KEY | id |

### 外键关联
| 外键名 | 外键列 | 参考表 | 参考列 | 匹配方式 | 更新规则 | 删除规则 |
|--------|--------|--------|--------|----------|----------|----------|
| - | - | - | - | - | - | - |

### 索引信息
| 索引名 | 索引列 | 是否唯一 | 索引类型 | 表空间 |
|--------|--------|----------|----------|--------|
| - | - | - | - | - |

---

## cases_info_zh 表

### 字段信息
| 字段名 | 数据类型 | 长度 | 允许空 | 默认值 | 描述 |
|--------|----------|------|--------|--------|------|
| case_info_id | INTEGER |  | YES |  |  |
| created_at | TEXT |  | YES |  |  |
| updated_at | TEXT |  | YES |  |  |
| id | INTEGER |  | YES |  |  |
| classification_zh | TEXT |  | YES |  |  |
| distinguishing_marks_zh | TEXT |  | YES |  |  |
| disappearance_details_zh | TEXT |  | YES |  |  |
| ai_model | TEXT |  | YES |  |  |
| case_id | TEXT |  | YES |  |  |
| full_name_zh | TEXT |  | YES |  |  |
| race_zh | TEXT |  | YES |  |  |

### 约束信息
| 约束名 | 约束类型 | 约束列 |
|--------|----------|--------|
| PRIMARY KEY | PRIMARY KEY | id |

### 外键关联
| 外键名 | 外键列 | 参考表 | 参考列 | 匹配方式 | 更新规则 | 删除规则 |
|--------|--------|--------|--------|----------|----------|----------|
| - | - | - | - | - | - | - |

### 索引信息
| 索引名 | 索引列 | 是否唯一 | 索引类型 | 表空间 |
|--------|--------|----------|----------|--------|
| - | - | - | - | - |

---

## geo_translations 表

### 字段信息
| 字段名 | 数据类型 | 长度 | 允许空 | 默认值 | 描述 |
|--------|----------|------|--------|--------|------|
| geoname_id | INTEGER |  | YES |  |  |
| cases_count | INTEGER |  | YES |  |  |
| id | INTEGER |  | YES |  |  |
| es_name | TEXT |  | YES |  |  |
| geo_type | TEXT |  | YES |  |  |
| parent_state_code | TEXT |  | YES |  |  |
| fips_code | TEXT |  | YES |  |  |
| slug | TEXT |  | YES |  |  |
| en_name | TEXT |  | YES |  |  |
| zh_name | TEXT |  | YES |  |  |

### 约束信息
| 约束名 | 约束类型 | 约束列 |
|--------|----------|--------|
| PRIMARY KEY | PRIMARY KEY | id |

### 外键关联
| 外键名 | 外键列 | 参考表 | 参考列 | 匹配方式 | 更新规则 | 删除规则 |
|--------|--------|--------|--------|----------|----------|----------|
| - | - | - | - | - | - | - |

### 索引信息
| 索引名 | 索引列 | 是否唯一 | 索引类型 | 表空间 |
|--------|--------|----------|----------|--------|
| - | - | - | - | - |

---

## missing_persons_assets 表

### 字段信息
| 字段名 | 数据类型 | 长度 | 允许空 | 默认值 | 描述 |
|--------|----------|------|--------|--------|------|
| updated_at | TEXT |  | YES |  |  |
| is_primary | INTEGER |  | YES |  |  |
| sort_order | INTEGER |  | YES |  |  |
| width | INTEGER |  | YES |  |  |
| height | INTEGER |  | YES |  |  |
| file_size | INTEGER |  | YES |  |  |
| ai_processed | INTEGER |  | YES |  |  |
| created_at | TEXT |  | YES |  |  |
| id | INTEGER |  | YES |  |  |
| caption_zh | TEXT |  | YES |  |  |
| caption_es | TEXT |  | YES |  |  |
| alt_en | TEXT |  | YES |  |  |
| case_id | TEXT |  | YES |  |  |
| alt_zh | TEXT |  | YES |  |  |
| alt_es | TEXT |  | YES |  |  |
| asset_type | TEXT |  | YES |  |  |
| original_filename | TEXT |  | YES |  |  |
| new_filename | TEXT |  | YES |  |  |
| storage_path | TEXT |  | YES |  |  |
| caption_en | TEXT |  | YES |  |  |
| hf_backup_status | INTEGER |  | YES | 0 |  |
| hf_path | TEXT |  | YES |  |  |

### 约束信息
| 约束名 | 约束类型 | 约束列 |
|--------|----------|--------|
| PRIMARY KEY | PRIMARY KEY | id |

### 外键关联
| 外键名 | 外键列 | 参考表 | 参考列 | 匹配方式 | 更新规则 | 删除规则 |
|--------|--------|--------|--------|----------|----------|----------|
| - | - | - | - | - | - | - |

### 索引信息
| 索引名 | 索引列 | 是否唯一 | 索引类型 | 表空间 |
|--------|--------|----------|----------|--------|
| - | - | - | - | - |

---

## missing_persons_cases 表

### 字段信息
| 字段名 | 数据类型 | 长度 | 允许空 | 默认值 | 描述 |
|--------|----------|------|--------|--------|------|
| created_at | TEXT |  | YES |  |  |
| updated_at | TEXT |  | YES |  |  |
| image_webp_status | INTEGER |  | YES |  |  |
| image_count | INTEGER |  | YES |  |  |
| html_status | INTEGER |  | YES |  |  |
| info_status | INTEGER |  | YES |  |  |
| id | INTEGER |  | YES |  |  |
| process_code | TEXT |  | YES |  |  |
| case_title | TEXT |  | YES |  |  |
| case_id | TEXT |  | YES |  |  |
| analysis_result | TEXT |  | YES |  |  |
| scraped_content | TEXT |  | YES |  |  |
| case_url | TEXT |  | YES |  |  |
| case_html | TEXT |  | YES |  |  |

### 约束信息
| 约束名 | 约束类型 | 约束列 |
|--------|----------|--------|
| PRIMARY KEY | PRIMARY KEY | id |

### 外键关联
| 外键名 | 外键列 | 参考表 | 参考列 | 匹配方式 | 更新规则 | 删除规则 |
|--------|--------|--------|--------|----------|----------|----------|
| - | - | - | - | - | - | - |

### 索引信息
| 索引名 | 索引列 | 是否唯一 | 索引类型 | 表空间 |
|--------|--------|----------|----------|--------|
| - | - | - | - | - |

---

## missing_persons_info 表

### 字段信息
| 字段名 | 数据类型 | 长度 | 允许空 | 默认值 | 描述 |
|--------|----------|------|--------|--------|------|
| updated_at | TEXT |  | YES |  |  |
| disappearance_details_word_count | INTEGER |  | YES |  |  |
| created_at | TEXT |  | YES |  |  |
| official_update_count | INTEGER |  | YES |  |  |
| city_geo_id | INTEGER |  | YES |  |  |
| official_last_updated | TEXT |  | YES |  |  |
| id | INTEGER |  | YES |  |  |
| height | TEXT |  | YES |  |  |
| investigating_agency | TEXT |  | YES |  |  |
| disappearance_details | TEXT |  | YES |  |  |
| missing_since | TEXT |  | YES |  |  |
| race | TEXT |  | YES |  |  |
| sex | TEXT |  | YES |  |  |
| source_info | TEXT |  | YES |  |  |
| weight | TEXT |  | YES |  |  |
| official_update_history | TEXT |  | YES |  |  |
| status | TEXT |  | YES |  |  |
| state_ref | TEXT |  | YES |  |  |
| county_fips_ref | TEXT |  | YES |  |  |
| classification | TEXT |  | YES |  |  |
| state_zh | TEXT |  | YES |  |  |
| county_zh | TEXT |  | YES |  |  |
| city_zh | TEXT |  | YES |  |  |
| state_slug | TEXT |  | YES |  |  |
| county_slug | TEXT |  | YES |  |  |
| city_slug | TEXT |  | YES |  |  |
| path | TEXT |  | YES |  |  |
| case_id | TEXT |  | YES |  |  |
| url_path | TEXT |  | YES |  |  |
| age_at_missing | TEXT |  | YES |  |  |
| date_of_birth | TEXT |  | YES |  |  |
| distinguishing_marks | TEXT |  | YES |  |  |
| full_name | TEXT |  | YES |  |  |

### 约束信息
| 约束名 | 约束类型 | 约束列 |
|--------|----------|--------|
| PRIMARY KEY | PRIMARY KEY | id |

### 外键关联
| 外键名 | 外键列 | 参考表 | 参考列 | 匹配方式 | 更新规则 | 删除规则 |
|--------|--------|--------|--------|----------|----------|----------|
| - | - | - | - | - | - | - |

### 索引信息
| 索引名 | 索引列 | 是否唯一 | 索引类型 | 表空间 |
|--------|--------|----------|----------|--------|
| - | - | - | - | - |

---

## missing_persons_tag_relations 表

### 字段信息
| 字段名 | 数据类型 | 长度 | 允许空 | 默认值 | 描述 |
|--------|----------|------|--------|--------|------|
| id | INTEGER |  | YES |  |  |
| tag_id | INTEGER |  | YES |  |  |
| created_at | TEXT |  | YES |  |  |
| case_id | TEXT |  | YES |  |  |

### 约束信息
| 约束名 | 约束类型 | 约束列 |
|--------|----------|--------|
| PRIMARY KEY | PRIMARY KEY | id |

### 外键关联
| 外键名 | 外键列 | 参考表 | 参考列 | 匹配方式 | 更新规则 | 删除规则 |
|--------|--------|--------|--------|----------|----------|----------|
| - | - | - | - | - | - | - |

### 索引信息
| 索引名 | 索引列 | 是否唯一 | 索引类型 | 表空间 |
|--------|--------|----------|----------|--------|
| - | - | - | - | - |

---

## missing_persons_tags 表

### 字段信息
| 字段名 | 数据类型 | 长度 | 允许空 | 默认值 | 描述 |
|--------|----------|------|--------|--------|------|
| cases_count | INTEGER |  | YES |  |  |
| created_at | TEXT |  | YES |  |  |
| updated_at | TEXT |  | YES |  |  |
| id | INTEGER |  | YES |  |  |
| ai_model | TEXT |  | YES |  |  |
| name_zh | TEXT |  | YES |  |  |
| name | TEXT |  | YES |  |  |
| slug | TEXT |  | YES |  |  |
| name_es | TEXT |  | YES |  |  |

### 约束信息
| 约束名 | 约束类型 | 约束列 |
|--------|----------|--------|
| PRIMARY KEY | PRIMARY KEY | id |

### 外键关联
| 外键名 | 外键列 | 参考表 | 参考列 | 匹配方式 | 更新规则 | 删除规则 |
|--------|--------|--------|--------|----------|----------|----------|
| - | - | - | - | - | - | - |

### 索引信息
| 索引名 | 索引列 | 是否唯一 | 索引类型 | 表空间 |
|--------|--------|----------|----------|--------|
| - | - | - | - | - |

---

## task_instances 表

### 字段信息
| 字段名 | 数据类型 | 长度 | 允许空 | 默认值 | 描述 |
|--------|----------|------|--------|--------|------|
| id | INTEGER |  | YES |  |  |
| case_id | INTEGER |  | NO |  |  |
| task_type | TEXT |  | NO |  |  |
| status | INTEGER |  | YES | 0 |  |
| retry_count | INTEGER |  | YES | 0 |  |
| error_log | TEXT |  | YES |  |  |
| payload | JSON |  | YES |  |  |
| scheduled_at | DATETIME |  | YES | CURRENT_TIMESTAMP |  |
| last_run | DATETIME |  | YES |  |  |
| created_at | DATETIME |  | YES | CURRENT_TIMESTAMP |  |
| updated_at | DATETIME |  | YES | CURRENT_TIMESTAMP |  |

### 约束信息
| 约束名 | 约束类型 | 约束列 |
|--------|----------|--------|
| PRIMARY KEY | PRIMARY KEY | id |
| FOREIGN KEY | FOREIGN KEY | case_id REFERENCES missing_persons_cases(case_id) |

### 外键关联
| 外键名 | 外键列 | 参考表 | 参考列 | 匹配方式 | 更新规则 | 删除规则 |
|--------|--------|--------|--------|----------|----------|----------|
| FOREIGN KEY | case_id | missing_persons_cases | case_id | - | NO ACTION | CASCADE |

### 索引信息
| 索引名 | 索引列 | 是否唯一 | 索引类型 | 表空间 |
|--------|--------|----------|----------|--------|
| - | - | - | - | - |

---

## task_progress 表

### 字段信息
| 字段名 | 数据类型 | 长度 | 允许空 | 默认值 | 描述 |
|--------|----------|------|--------|--------|------|
| last_id | INTEGER |  | YES |  |  |
| updated_at | TEXT |  | YES |  |  |
| task_name | TEXT |  | NO |  |  |

### 约束信息
| 约束名 | 约束类型 | 约束列 |
|--------|----------|--------|
| PRIMARY KEY | PRIMARY KEY | task_name |

### 外键关联
| 外键名 | 外键列 | 参考表 | 参考列 | 匹配方式 | 更新规则 | 删除规则 |
|--------|--------|--------|--------|----------|----------|----------|
| - | - | - | - | - | - | - |

### 索引信息
| 索引名 | 索引列 | 是否唯一 | 索引类型 | 表空间 |
|--------|--------|----------|----------|--------|
| - | - | - | - | - |

---

## us_geo_mapping 表

### 字段信息
| 字段名 | 数据类型 | 长度 | 允许空 | 默认值 | 描述 |
|--------|----------|------|--------|--------|------|
| id | INTEGER |  | YES |  |  |
| lat | TEXT |  | YES |  |  |
| lng | TEXT |  | YES |  |  |
| population | INTEGER |  | YES |  |  |
| density | TEXT |  | YES |  |  |
| military | INTEGER |  | YES |  |  |
| incorporated | INTEGER |  | YES |  |  |
| ranking | INTEGER |  | YES |  |  |
| zips | TEXT |  | YES |  |  |
| timezone | TEXT |  | YES |  |  |
| city_ascii | TEXT |  | YES |  |  |
| state_id | TEXT |  | YES |  |  |
| state_name | TEXT |  | YES |  |  |
| county_fips | TEXT |  | YES |  |  |
| county_name | TEXT |  | YES |  |  |
| source | TEXT |  | YES |  |  |
| city | TEXT |  | YES |  |  |

### 约束信息
| 约束名 | 约束类型 | 约束列 |
|--------|----------|--------|
| PRIMARY KEY | PRIMARY KEY | id |

### 外键关联
| 外键名 | 外键列 | 参考表 | 参考列 | 匹配方式 | 更新规则 | 删除规则 |
|--------|--------|--------|--------|----------|----------|----------|
| - | - | - | - | - | - | - |

### 索引信息
| 索引名 | 索引列 | 是否唯一 | 索引类型 | 表空间 |
|--------|--------|----------|----------|--------|
| - | - | - | - | - |

---

