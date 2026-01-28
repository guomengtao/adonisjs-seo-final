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
    // 从环境变量构建连接字符串
    const host = process.env.PG_HOST;
    const port = process.env.PG_PORT;
    const user = process.env.PG_USER;
    const password = process.env.PG_PASSWORD;
    const database = process.env.PG_DB_NAME;
    
    if (!host || !port || !user || !password || !database) {
        throw new Error('请设置完整的PostgreSQL环境变量 (PG_HOST, PG_PORT, PG_USER, PG_PASSWORD, PG_DB_NAME)');
    }
    
    const connectionString = `postgresql://${user}:${password}@${host}:${port}/${database}?sslmode=no-verify`;
    
    console.log('正在初始化PostgreSQL客户端...');
    console.log('连接URL:', connectionString.replace(password, '***'));
    
    // 添加SSL配置
    const client = new Client({
        connectionString: connectionString,
        ssl: {
            rejectUnauthorized: false
        }
    });
    
    return client;
}

// 测试数据库连接
async function testDatabaseConnection(client) {
    try {
        await client.connect();
        const result = await client.query('SELECT NOW() as current_time');
        console.log('数据库连接测试成功！当前时间:', result.rows[0].current_time);
        return true;
    } catch (error) {
        console.error('数据库连接测试失败:', error.message);
        return false;
    }
}

// 执行SQL文件
async function executeSqlFile(client, filePath) {
    try {
        const sqlContent = readFileSync(filePath, 'utf8');
        console.log('正在执行SQL文件...');
        
        await client.query(sqlContent);
        console.log('SQL文件执行成功！');
        return true;
    } catch (error) {
        console.error('执行SQL文件失败:', error.message);
        return false;
    }
}

// 主函数
async function main() {
    const client = initPostgresClient();
    
    try {
        console.log('开始设置植物详情表...\n');
        
        // 测试数据库连接
        const isConnected = await testDatabaseConnection(client);
        if (!isConnected) {
            console.error('无法连接到数据库，程序退出');
            return;
        }
        
        // 执行SQL文件创建表
        const sqlExecuted = await executeSqlFile(client, './create_plant_details_table.sql');
        if (!sqlExecuted) {
            console.error('表创建失败，程序退出');
            return;
        }
        
        console.log('\n=== 植物详情表设置完成 ===');
        
    } catch (error) {
        console.error('程序执行过程中出现错误:', error);
    } finally {
        await client.end();
        console.log('\n数据库连接已关闭');
    }
}

// 运行主函数
main();