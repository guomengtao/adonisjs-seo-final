import { Client } from 'pg';
import { readFileSync } from 'fs';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 加载环境变量
config({ path: `${__dirname}/../.env` });

// 初始化PostgreSQL客户端
function initPostgresClient() {
    const connectionString = `postgresql://${process.env.PG_USER}:${process.env.PG_PASSWORD}@${process.env.PG_HOST}:${process.env.PG_PORT}/${process.env.PG_DB_NAME}?sslmode=no-verify`;
    
    console.log('正在初始化PostgreSQL客户端...');
    console.log(`连接URL: postgresql://${process.env.PG_USER}:***@${process.env.PG_HOST}:${process.env.PG_PORT}/${process.env.PG_DB_NAME}?sslmode=no-verify`);
    
    return new Client({
        connectionString: connectionString,
        ssl: {
            rejectUnauthorized: false // 完全忽略SSL证书验证
        }
    });
}

// 检查数据库连接
async function testDatabaseConnection(client) {
    try {
        console.log('正在测试数据库连接...');
        await client.connect();
        const result = await client.query('SELECT NOW() as current_time');
        console.log('数据库连接测试成功！当前时间:', result.rows[0].current_time);
        return true;
    } catch (error) {
        console.error('数据库连接测试失败:', error);
        return false;
    }
}

// 执行SQL文件
async function executeSqlFile(client) {
    try {
        console.log('开始执行SQL文件...');
        const sqlContent = readFileSync(`${__dirname}/add_analysis_fields.sql`, 'utf8');
        
        // 分割SQL语句并执行
        const sqlStatements = sqlContent.split(';').filter(statement => 
            statement.trim() && !statement.trim().startsWith('--')
        );
        
        for (let i = 0; i < sqlStatements.length; i++) {
            const statement = sqlStatements[i].trim();
            if (statement) {
                try {
                    // 跳过最后一个SELECT语句（用于显示表结构）
                    if (i === sqlStatements.length - 1 && statement.toUpperCase().startsWith('SELECT')) {
                        console.log('跳过最后的SELECT语句，将在后续步骤中执行');
                        continue;
                    }
                    
                    await client.query(statement);
                    console.log(`执行语句: ${statement.substring(0, 50)}...`);
                } catch (error) {
                    console.error(`执行语句失败: ${statement.substring(0, 50)}...`, error.message);
                    throw error;
                }
            }
        }
        
        console.log('SQL文件执行成功！');
        return true;
    } catch (error) {
        console.error('执行SQL文件失败:', error);
        return false;
    }
}

// 显示表结构
async function showTableStructure(client) {
    try {
        console.log('\n=== raw_plants表结构 ===');
        const result = await client.query(`
            SELECT 
                column_name, 
                data_type, 
                is_nullable,
                column_default
            FROM information_schema.columns 
            WHERE table_name = 'raw_plants' 
            ORDER BY ordinal_position
        `);
        
        result.rows.forEach(row => {
            console.log(`${row.column_name} (${row.data_type}, ${row.is_nullable})`);
        });
        
        return true;
    } catch (error) {
        console.error('显示表结构失败:', error);
        return false;
    }
}

// 主函数
async function main() {
    const client = initPostgresClient();
    
    try {
        console.log('开始设置分析字段...\n');
        
        // 测试数据库连接
        const isConnected = await testDatabaseConnection(client);
        if (!isConnected) {
            console.error('无法连接到数据库，程序退出');
            return;
        }
        
        // 执行SQL文件
        const executed = await executeSqlFile(client);
        if (!executed) {
            console.error('SQL文件执行失败，程序退出');
            return;
        }
        
        // 显示表结构
        await showTableStructure(client);
        
        console.log('\n=== 分析字段设置完成 ===');
        
    } catch (error) {
        console.error('程序执行过程中出现错误:', error);
    } finally {
        await client.end();
        console.log('\n数据库连接已关闭');
    }
}

// 运行主函数
main();