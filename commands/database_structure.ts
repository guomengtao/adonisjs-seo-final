import { BaseCommand } from '@adonisjs/core/ace';
import db from '@adonisjs/lucid/services/db';
import fs from 'fs';
import path from 'path';

export default class DatabaseStructure extends BaseCommand {
  static commandName = 'database:structure';
  static options = { startApp: true };

  async run() {
    this.logger.info('🔍 开始获取数据库表结构信息...');

    try {
      const connection = db.connection(); // 使用默认连接
      let structureInfo = `# 数据库表结构信息

`;
      
      let tables: string[] = [];
      
      // 尝试使用SQLite/Turso方式获取表名
      try {
        this.logger.info('🔍 尝试SQLite/Turso查询...');
        const tablesResult = await connection.rawQuery(`
          SELECT name 
          FROM sqlite_master 
          WHERE type = 'table' AND name NOT LIKE 'sqlite_%' 
          ORDER BY name;
        `);
        this.logger.info('✅ SQLite/Turso查询成功');
        this.logger.info('查询结果类型: ' + typeof tablesResult);
        this.logger.info('查询结果值: ' + JSON.stringify(tablesResult));
        
        // 处理Turso/libSQL的查询结果格式
        if (Array.isArray(tablesResult)) {
          // Turso/libSQL格式：直接返回数组
          tables = tablesResult.map((row: any) => row.name);
        } else if (tablesResult.rows) {
          // 标准SQLite格式：通过rows属性
          tables = tablesResult.rows.map((row: any) => row.name);
        } else {
          // 其他情况
          tables = [];
        }
        
        this.logger.info('解析后的表名: ' + tables.join(', '));
      } catch (error: any) {
        this.logger.error('❌ SQLite/Turso查询失败: ' + error.message);
        
        // 如果SQLite方式失败，尝试PostgreSQL方式
        try {
          this.logger.info('🔍 尝试PostgreSQL查询...');
          const tablesResult = await connection.rawQuery(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY table_name;
          `);
          this.logger.info('✅ PostgreSQL查询成功');
          tables = tablesResult.rows ? tablesResult.rows.map((row: any) => row.table_name) : [];
        } catch (pgError: any) {
          this.logger.error('❌ PostgreSQL查询失败: ' + pgError.message);
          this.logger.error('❌ 无法获取数据库表信息');
          this.logger.error('完整错误堆栈: ' + pgError.stack);
          throw pgError;
        }
      }
      
      this.logger.info(`📋 发现 ${tables.length} 个表: ${tables.join(', ')}`);
      
      // 准备TXT格式的输出
      let txtStructure = '数据库表结构信息\n';
      txtStructure += '='.repeat(60) + '\n\n';
      
      // 逐个表获取详细信息
      for (const table of tables) {
        this.logger.info(`📝 正在处理表: ${table}`);
        
        structureInfo += `## ${table} 表\n\n`;
        txtStructure += `${table}\n`;
        txtStructure += '-'.repeat(table.length) + '\n';
        
        // 1. 获取表字段信息
        structureInfo += '### 字段信息\n';
        structureInfo += '| 字段名 | 数据类型 | 长度 | 允许空 | 默认值 | 描述 |\n';
        structureInfo += '|--------|----------|------|--------|--------|------|\n';
        
        let columns: any[] = [];
        
        // 尝试使用SQLite方式获取字段信息
        try {
          const columnsResult = await connection.rawQuery(`PRAGMA table_info(${table})`);
          
          // 处理Turso/libSQL的查询结果格式
          let columnsData: any[] = [];
          if (Array.isArray(columnsResult)) {
            columnsData = columnsResult;
          } else if (columnsResult.rows) {
            columnsData = columnsResult.rows;
          }
          
          columns = columnsData.map((col: any) => ({
            column_name: col.name,
            data_type: col.type,
            character_maximum_length: null,
            is_nullable: col.notnull === 0 ? 'YES' : 'NO',
            column_default: col.dflt_value || '',
            column_comment: ''
          }));
        } catch (error) {
          // 如果SQLite方式失败，尝试PostgreSQL方式
          try {
            const columnsResult = await connection.rawQuery(`
              SELECT 
                a.attname AS column_name, 
                format_type(a.atttypid, a.atttypmod) AS data_type, 
                CASE WHEN a.atttypid = ANY (ARRAY [25, 1042, 1043]) THEN a.atttypmod - 4 ELSE NULL END AS character_maximum_length, 
                CASE WHEN a.attnotnull THEN 'NO' ELSE 'YES' END AS is_nullable, 
                pg_get_expr(d.adbin, d.adrelid) AS column_default, 
                col_description(a.attrelid, a.attnum) AS column_comment
              FROM pg_attribute a
              JOIN pg_class c ON a.attrelid = c.oid
              LEFT JOIN pg_attrdef d ON a.attrelid = d.adrelid AND a.attnum = d.adnum
              WHERE c.relname = ? AND a.attnum > 0 AND NOT a.attisdropped
              ORDER BY a.attnum;
            `, [table]);
            columns = columnsResult.rows || [];
          } catch (pgError) {
            this.logger.error(`❌ 无法获取表 ${table} 的字段信息`);
            continue;
          }
        }
        
        columns.forEach((column: any) => {
            structureInfo += `| ${column.column_name} | ${column.data_type} | ${column.character_maximum_length || ''} | ${column.is_nullable} | ${column.column_default || ''} | ${column.column_comment || ''} |
`;
            
            // 添加到TXT格式，确保数据类型和长度显示正确
            let typeWithLength = column.data_type;
            if (column.data_type !== 'text' && column.character_maximum_length && !typeWithLength.includes('(')) {
              typeWithLength += `(${column.character_maximum_length})`;
            } else if (column.numeric_precision) {
              typeWithLength += `(${column.numeric_precision},${column.numeric_scale || 0})`;
            }
            txtStructure += `${column.column_name} ${typeWithLength} ${column.is_nullable === 'YES' ? '(NULL)' : '(NOT NULL)'}
`;
          });
        
        txtStructure += '\n';
        
        structureInfo += '\n';
        
        // 2. 获取表约束信息
        structureInfo += '### 约束信息\n';
        structureInfo += '| 约束名 | 约束类型 | 约束列 |\n';
        structureInfo += '|--------|----------|--------|\n';
        
        // 尝试使用SQLite方式获取约束信息
        try {
          // SQLite/Turso - 获取主键约束
          const pragmaInfo = await connection.rawQuery(`PRAGMA table_info(${table})`);
          
          // 处理Turso/libSQL的查询结果格式
          let pragmaData: any[] = [];
          if (Array.isArray(pragmaInfo)) {
            pragmaData = pragmaInfo;
          } else if (pragmaInfo.rows) {
            pragmaData = pragmaInfo.rows;
          }
          
          const primaryKeys = pragmaData.filter((col: any) => col.pk > 0).map((col: any) => col.name);
          
          if (primaryKeys.length > 0) {
            structureInfo += `| PRIMARY KEY | PRIMARY KEY | ${primaryKeys.join(', ')} |\n`;
          }
          
          // 获取外键约束
          const foreignKeysResult = await connection.rawQuery(`PRAGMA foreign_key_list(${table})`);
          
          // 处理Turso/libSQL的查询结果格式
          let foreignKeysData: any[] = [];
          if (Array.isArray(foreignKeysResult)) {
            foreignKeysData = foreignKeysResult;
          } else if (foreignKeysResult.rows) {
            foreignKeysData = foreignKeysResult.rows;
          }
          
          if (foreignKeysData.length > 0) {
            foreignKeysData.forEach((fk: any) => {
              structureInfo += `| FOREIGN KEY | FOREIGN KEY | ${fk.from} REFERENCES ${fk.table}(${fk.to}) |\n`;
            });
          }
        } catch (error) {
          // 如果SQLite方式失败，尝试PostgreSQL方式
          try {
            const constraintsResult = await connection.rawQuery(`
              SELECT 
                c.constraint_name, 
                c.constraint_type, 
                kcu.column_name
              FROM information_schema.table_constraints c
              JOIN information_schema.key_column_usage kcu 
                ON c.constraint_name = kcu.constraint_name
              WHERE c.table_schema = 'public' AND c.table_name = ?
              ORDER BY c.constraint_type, c.constraint_name;
            `, [table]);
            
            const constraintsMap: { [key: string]: { type: string; columns: string[] } } = {};
            if (constraintsResult.rows) {
              constraintsResult.rows.forEach((constraint: any) => {
                if (!constraintsMap[constraint.constraint_name]) {
                  constraintsMap[constraint.constraint_name] = { type: constraint.constraint_type, columns: [] };
                }
                constraintsMap[constraint.constraint_name].columns.push(constraint.column_name);
              });
            }
            
            Object.entries(constraintsMap).forEach(([name, constraint]) => {
              structureInfo += `| ${name} | ${constraint.type} | ${constraint.columns.join(', ')} |\n`;
            });
          } catch (pgError) {
            this.logger.error(`❌ 无法获取表 ${table} 的约束信息`);
          }
        }
        
        structureInfo += '\n';
        
        // 3. 获取表外键信息
        structureInfo += '### 外键关联\n';
        structureInfo += '| 外键名 | 外键列 | 参考表 | 参考列 | 匹配方式 | 更新规则 | 删除规则 |\n';
        structureInfo += '|--------|--------|--------|--------|----------|----------|----------|\n';
        
        // 尝试使用SQLite方式获取外键信息
        try {
          const foreignKeysResult = await connection.rawQuery(`PRAGMA foreign_key_list(${table})`);
          
          // 处理Turso/libSQL的查询结果格式
          let foreignKeysData: any[] = [];
          if (Array.isArray(foreignKeysResult)) {
            foreignKeysData = foreignKeysResult;
          } else if (foreignKeysResult.rows) {
            foreignKeysData = foreignKeysResult.rows;
          }
          
          if (foreignKeysData.length > 0) {
            foreignKeysData.forEach((fk: any) => {
              structureInfo += `| FOREIGN KEY | ${fk.from} | ${fk.table} | ${fk.to} | - | ${fk.on_update || '-'} | ${fk.on_delete || '-'} |\n`;
            });
          } else {
            structureInfo += '| - | - | - | - | - | - | - |\n';
          }
        } catch (error) {
          // 如果SQLite方式失败，尝试PostgreSQL方式
          try {
            const foreignKeysResult = await connection.rawQuery(`
              SELECT 
                rc.constraint_name, 
                kcu.column_name, 
                ccu.table_name AS referenced_table, 
                ccu.column_name AS referenced_column,
                rc.match_option, 
                rc.update_rule, 
                rc.delete_rule
              FROM information_schema.referential_constraints rc
              JOIN information_schema.key_column_usage kcu 
                ON rc.constraint_name = kcu.constraint_name
              JOIN information_schema.constraint_column_usage ccu 
                ON rc.unique_constraint_name = ccu.constraint_name
              WHERE rc.constraint_schema = 'public' AND kcu.table_name = ?
              ORDER BY rc.constraint_name;
            `, [table]);
            
            if (foreignKeysResult.rows && foreignKeysResult.rows.length > 0) {
              foreignKeysResult.rows.forEach((fk: any) => {
                structureInfo += `| ${fk.constraint_name} | ${fk.column_name} | ${fk.referenced_table} | ${fk.referenced_column} | ${fk.match_option} | ${fk.update_rule} | ${fk.delete_rule} |\n`;
              });
            } else {
              structureInfo += '| - | - | - | - | - | - | - |\n';
            }
          } catch (pgError) {
            structureInfo += '| - | - | - | - | - | - | - |\n';
            this.logger.error(`❌ 无法获取表 ${table} 的外键信息`);
          }
        }
        
        structureInfo += '\n';
        
        // 4. 获取表索引信息
        structureInfo += '### 索引信息\n';
        structureInfo += '| 索引名 | 索引列 | 是否唯一 | 索引类型 | 表空间 |\n';
        structureInfo += '|--------|--------|----------|----------|--------|\n';
        
        // 尝试使用SQLite方式获取索引信息
        try {
          const indexesResult = await connection.rawQuery(`PRAGMA index_list(${table})`);
          if (indexesResult.rows && indexesResult.rows.length > 0) {
            for (const index of indexesResult.rows) {
              if (index.name.startsWith('sqlite_')) continue; // 跳过系统索引
              
              // 获取索引列信息
              const indexInfoResult = await connection.rawQuery(`PRAGMA index_info(${index.name})`);
              const columns = indexInfoResult.rows ? indexInfoResult.rows.map((col: any) => col.name).join(', ') : '';
              
              structureInfo += `| ${index.name} | ${columns} | ${index.unique ? '是' : '否'} | - | - |\n`;
            }
          } else {
            structureInfo += '| - | - | - | - | - |\n';
          }
        } catch (error) {
          // 如果SQLite方式失败，尝试PostgreSQL方式
          try {
            const indexesResult = await connection.rawQuery(`
              SELECT 
                indexname, 
                indexdef, 
                indisunique, 
                indrelid::regclass::text AS table_name
              FROM pg_indexes
              JOIN pg_class ON pg_indexes.indexname = pg_class.relname
              JOIN pg_index ON pg_class.oid = pg_index.indexrelid
              WHERE schemaname = 'public' AND tablename = ?
              ORDER BY indexname;
            `, [table]);
            
            if (indexesResult.rows) {
              indexesResult.rows.forEach((index: any) => {
                // 从indexdef中提取索引列
                const columnsMatch = index.indexdef.match(/\(([^)]+)\)/);
                const columns = columnsMatch ? columnsMatch[1] : '';
                
                // 确定索引类型
                let indexType = 'BTREE';
                if (index.indexdef.toLowerCase().includes('gist')) indexType = 'GIST';
                if (index.indexdef.toLowerCase().includes('gin')) indexType = 'GIN';
                if (index.indexdef.toLowerCase().includes('hash')) indexType = 'HASH';
                
                structureInfo += `| ${index.indexname} | ${columns} | ${index.indisunique ? '是' : '否'} | ${indexType} | - |\n`;
              });
            } else {
              structureInfo += '| - | - | - | - | - |\n';
            }
          } catch (pgError) {
            structureInfo += '| - | - | - | - | - |\n';
            this.logger.error(`❌ 无法获取表 ${table} 的索引信息`);
          }
        }
        
        structureInfo += '\n';
        structureInfo += '---\n\n';
      }
      
      // 将结构信息保存到文件
      const outputDir = path.join(process.cwd(), 'database');
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      const outputPath = path.join(outputDir, 'database_structure.md');
      fs.writeFileSync(outputPath, structureInfo, 'utf8');
      
      // 同时保存为JSON格式，方便程序读取
      const jsonStructure = await this.getJsonStructure(connection);
      const jsonOutputPath = path.join(outputDir, 'database_structure.json');
      fs.writeFileSync(jsonOutputPath, JSON.stringify(jsonStructure, null, 2), 'utf8');
      
      // 保存为简洁的TXT格式
      const txtOutputPath = path.join(outputDir, 'database_structure.txt');
      fs.writeFileSync(txtOutputPath, txtStructure, 'utf8');
      
      this.logger.success(`✅ 数据库表结构信息已成功保存！`);
      this.logger.info(`📄 Markdown格式: ${outputPath}`);
      this.logger.info(`📄 JSON格式: ${jsonOutputPath}`);
      this.logger.info(`📄 TXT格式: ${txtOutputPath}`);
      
    } catch (error) {
      this.logger.error(`❌ 获取数据库结构信息失败: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }
  
  /**
   * 获取JSON格式的数据库结构信息，方便程序读取
   */
  async getJsonStructure(connection: any) {
    const structure: any = {};
    
    // 获取所有表名 - 使用Turso兼容的方式
    let tables: string[] = [];
    
    try {
      // 尝试SQLite/Turso方式
      const tablesResult = await connection.rawQuery(`
        SELECT name 
        FROM sqlite_master 
        WHERE type = 'table' AND name NOT LIKE 'sqlite_%' 
        ORDER BY name;
      `);
      
      // 处理Turso/libSQL的查询结果格式
      if (Array.isArray(tablesResult)) {
        tables = tablesResult.map((row: any) => row.name);
      } else if (tablesResult.rows) {
        tables = tablesResult.rows.map((row: any) => row.name);
      }
    } catch (error) {
      this.logger.error('❌ 获取表名失败，跳过JSON格式生成');
      return {};
    }
    
    for (const table of tables) {
      structure[table] = {
        columns: {},
        constraints: [],
        foreignKeys: [],
        indexes: []
      };
      
      try {
        // 获取字段信息 - 使用SQLite/Turso方式
        const columnsResult = await connection.rawQuery(`PRAGMA table_info(${table})`);
        
        // 处理Turso/libSQL的查询结果格式
        let columnsData: any[] = [];
        if (Array.isArray(columnsResult)) {
          columnsData = columnsResult;
        } else if (columnsResult.rows) {
          columnsData = columnsResult.rows;
        }
        
        columnsData.forEach((column: any) => {
          structure[table].columns[column.name] = {
            data_type: column.type,
            max_length: null,
            is_nullable: column.notnull === 0,
            default_value: column.dflt_value || ''
          };
        });
        
        // 获取约束信息 - 使用SQLite/Turso方式
        const pragmaInfo = await connection.rawQuery(`PRAGMA table_info(${table})`);
        
        // 处理Turso/libSQL的查询结果格式
        let pragmaData: any[] = [];
        if (Array.isArray(pragmaInfo)) {
          pragmaData = pragmaInfo;
        } else if (pragmaInfo.rows) {
          pragmaData = pragmaInfo.rows;
        }
        
        // 获取主键约束
        const primaryKeys = pragmaData.filter((col: any) => col.pk > 0).map((col: any) => col.name);
        if (primaryKeys.length > 0) {
          structure[table].constraints.push({
            name: 'PRIMARY KEY',
            type: 'PRIMARY KEY',
            columns: primaryKeys
          });
        }
        
        // 获取外键信息 - 使用SQLite/Turso方式
        const foreignKeysResult = await connection.rawQuery(`PRAGMA foreign_key_list(${table})`);
        
        // 处理Turso/libSQL的查询结果格式
        let foreignKeysData: any[] = [];
        if (Array.isArray(foreignKeysResult)) {
          foreignKeysData = foreignKeysResult;
        } else if (foreignKeysResult.rows) {
          foreignKeysData = foreignKeysResult.rows;
        }
        
        foreignKeysData.forEach((fk: any) => {
          structure[table].foreignKeys.push({
            name: 'FOREIGN KEY',
            column: fk.from,
            referenced_table: fk.table,
            referenced_column: fk.to,
            match_option: '-',
            update_rule: fk.on_update || '-',
            delete_rule: fk.on_delete || '-'
          });
        });
        
        // 获取索引信息 - 使用SQLite/Turso方式
        const indexesResult = await connection.rawQuery(`PRAGMA index_list(${table})`);
        
        // 处理Turso/libSQL的查询结果格式
        let indexesData: any[] = [];
        if (Array.isArray(indexesResult)) {
          indexesData = indexesResult;
        } else if (indexesResult.rows) {
          indexesData = indexesResult.rows;
        }
        
        for (const index of indexesData) {
          if (index.name.startsWith('sqlite_')) continue; // 跳过系统索引
          
          // 获取索引列信息
          const indexInfoResult = await connection.rawQuery(`PRAGMA index_info(${index.name})`);
          
          // 处理Turso/libSQL的查询结果格式
          let indexInfoData: any[] = [];
          if (Array.isArray(indexInfoResult)) {
            indexInfoData = indexInfoResult;
          } else if (indexInfoResult.rows) {
            indexInfoData = indexInfoResult.rows;
          }
          
          const columns = indexInfoData.map((col: any) => col.name).join(', ');
          
          structure[table].indexes.push({
            name: index.name,
            columns,
            is_unique: index.unique,
            type: '-' // SQLite不提供索引类型信息
          });
        }
        
      } catch (error) {
        this.logger.error(`❌ 获取表 ${table} 的结构信息失败，跳过此表`);
        // 保留表结构但清空详细信息
        structure[table] = {
          columns: {},
          constraints: [],
          foreignKeys: [],
          indexes: []
        };
      }
    }
    
    return structure;
  }
}