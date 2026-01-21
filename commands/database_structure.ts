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
      const connection = db.connection('pg');
      let structureInfo = '# 数据库表结构信息\n\n';
      
      // 获取所有表名
      const tablesResult = await connection.rawQuery(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name;
      `);
      
      const tables = tablesResult.rows.map((row: { table_name: string }) => row.table_name);
      
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
        
        columnsResult.rows.forEach((column: any) => {
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
        constraintsResult.rows.forEach((constraint: any) => {
          if (!constraintsMap[constraint.constraint_name]) {
            constraintsMap[constraint.constraint_name] = {
              type: constraint.constraint_type,
              columns: []
            };
          }
          constraintsMap[constraint.constraint_name].columns.push(constraint.column_name);
        });
        
        Object.entries(constraintsMap).forEach(([name, constraint]) => {
          structureInfo += `| ${name} | ${constraint.type} | ${constraint.columns.join(', ')} |\n`;
        });
        
        structureInfo += '\n';
        
        // 3. 获取表外键信息
        structureInfo += '### 外键关联\n';
        structureInfo += '| 外键名 | 外键列 | 参考表 | 参考列 | 匹配方式 | 更新规则 | 删除规则 |\n';
        structureInfo += '|--------|--------|--------|--------|----------|----------|----------|\n';
        
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
        
        if (foreignKeysResult.rows.length > 0) {
          foreignKeysResult.rows.forEach((fk: any) => {
            structureInfo += `| ${fk.constraint_name} | ${fk.column_name} | ${fk.referenced_table} | ${fk.referenced_column} | ${fk.match_option} | ${fk.update_rule} | ${fk.delete_rule} |\n`;
          });
        } else {
          structureInfo += '| - | - | - | - | - | - | - |\n';
        }
        
        structureInfo += '\n';
        
        // 4. 获取表索引信息
        structureInfo += '### 索引信息\n';
        structureInfo += '| 索引名 | 索引列 | 是否唯一 | 索引类型 | 表空间 |\n';
        structureInfo += '|--------|--------|----------|----------|--------|\n';
        
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
    
    // 获取所有表名
    const tablesResult = await connection.rawQuery(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    
    const tables = tablesResult.rows.map((row: { table_name: string }) => row.table_name);
    
    for (const table of tables) {
      structure[table] = {
        columns: {},
        constraints: [],
        foreignKeys: [],
        indexes: []
      };
      
      // 获取字段信息
      const columnsResult = await connection.rawQuery(`
        SELECT 
          a.attname AS column_name, 
          format_type(a.atttypid, a.atttypmod) AS data_type, 
          CASE WHEN a.atttypid = ANY (ARRAY [25, 1042, 1043]) THEN a.atttypmod - 4 ELSE NULL END AS character_maximum_length, 
          CASE WHEN a.attnotnull THEN 'NO' ELSE 'YES' END AS is_nullable, 
          pg_get_expr(d.adbin, d.adrelid) AS column_default
        FROM pg_attribute a
        JOIN pg_class c ON a.attrelid = c.oid
        LEFT JOIN pg_attrdef d ON a.attrelid = d.adrelid AND a.attnum = d.adnum
        WHERE c.relname = ? AND a.attnum > 0 AND NOT a.attisdropped
        ORDER BY a.attnum;
      `, [table]);
      
      columnsResult.rows.forEach((column: any) => {
        structure[table].columns[column.column_name] = {
          data_type: column.data_type,
          max_length: column.character_maximum_length,
          is_nullable: column.is_nullable === 'YES',
          default_value: column.column_default
        };
      });
      
      // 获取约束信息
      const constraintsResult = await connection.rawQuery(`
        SELECT 
          c.constraint_name, 
          c.constraint_type, 
          kcu.column_name
        FROM information_schema.table_constraints c
        JOIN information_schema.key_column_usage kcu 
          ON c.constraint_name = kcu.constraint_name
        WHERE c.table_schema = 'public' AND c.table_name = ?;
      `, [table]);
      
      const constraintsMap: { [key: string]: { type: string; columns: string[] } } = {};
      constraintsResult.rows.forEach((constraint: any) => {
        if (!constraintsMap[constraint.constraint_name]) {
          constraintsMap[constraint.constraint_name] = {
            type: constraint.constraint_type,
            columns: []
          };
        }
        constraintsMap[constraint.constraint_name].columns.push(constraint.column_name);
      });
      
      structure[table].constraints = Object.entries(constraintsMap).map(([name, constraint]) => ({
        name,
        type: constraint.type,
        columns: constraint.columns
      }));
      
      // 获取外键信息
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
        WHERE rc.constraint_schema = 'public' AND kcu.table_name = ?;
      `, [table]);
      
      structure[table].foreignKeys = foreignKeysResult.rows.map((fk: any) => ({
        name: fk.constraint_name,
        column: fk.column_name,
        referenced_table: fk.referenced_table,
        referenced_column: fk.referenced_column,
        match_option: fk.match_option,
        update_rule: fk.update_rule,
        delete_rule: fk.delete_rule
      }));
      
      // 获取索引信息
      const indexesResult = await connection.rawQuery(`
        SELECT 
          indexname, 
          indexdef, 
          indisunique
        FROM pg_indexes
        JOIN pg_class ON pg_indexes.indexname = pg_class.relname
        JOIN pg_index ON pg_class.oid = pg_index.indexrelid
        WHERE schemaname = 'public' AND tablename = ?;
      `, [table]);
      
      structure[table].indexes = indexesResult.rows.map((index: any) => {
        const columnsMatch = index.indexdef.match(/\(([^)]+)\)/);
        const columns = columnsMatch ? columnsMatch[1] : '';
        
        let indexType = 'BTREE';
        if (index.indexdef.toLowerCase().includes('gist')) indexType = 'GIST';
        if (index.indexdef.toLowerCase().includes('gin')) indexType = 'GIN';
        if (index.indexdef.toLowerCase().includes('hash')) indexType = 'HASH';
        
        return {
          name: index.indexname,
          columns,
          is_unique: index.indisunique,
          type: indexType
        };
      });
    }
    
    return structure;
  }
}