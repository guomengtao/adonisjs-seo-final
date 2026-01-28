import { Client } from 'pg';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { config } from 'dotenv';
import fetch from 'node-fetch';
import { JSDOM } from 'jsdom';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 加载环境变量
config({ path: `${__dirname}/.env` });

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

// 获取一条待抓取的记录
async function getPendingRecord(client) {
    try {
        const query = `
            SELECT id, latin_name, source_url 
            FROM raw_plants 
            WHERE status = 'pending' 
            ORDER BY id ASC 
            LIMIT 1
            FOR UPDATE SKIP LOCKED
        `;
        
        const result = await client.query(query);
        
        if (result.rows.length === 0) {
            console.log('没有找到待抓取的记录');
            return null;
        }
        
        return result.rows[0];
    } catch (error) {
        console.error('获取待抓取记录失败:', error);
        return null;
    }
}

// 更新记录状态为抓取中
async function updateStatusToCrawling(client, recordId) {
    try {
        const query = `
            UPDATE raw_plants 
            SET status = 'crawling', 
                updated_at = NOW() 
            WHERE id = $1
        `;
        
        await client.query(query, [recordId]);
        console.log(`记录 ${recordId} 状态已更新为 crawling`);
        return true;
    } catch (error) {
        console.error(`更新记录 ${recordId} 状态失败:`, error);
        return false;
    }
}

// 从HTML中提取植物俗名（简化版，直接返回拉丁名）
function extractCommonName(html, latinName) {
    // 直接返回拉丁名作为俗名
    return latinName;
}

// 抓取URL的HTML内容
async function fetchHtmlContent(url, latinName) {
    try {
        console.log(`正在抓取URL: ${url}`);
        
        // 设置请求头，模拟浏览器访问
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1'
        };
        
        const response = await fetch(url, {
            headers: headers,
            timeout: 30000, // 30秒超时
            follow: 5, // 最多5次重定向
            compress: true
        });
        
        if (!response.ok) {
            throw new Error(`HTTP错误: ${response.status} ${response.statusText}`);
        }
        
        const html = await response.text();
        
        if (!html || html.length === 0) {
            throw new Error('获取的HTML内容为空');
        }
        
        console.log(`抓取成功，HTML长度: ${html.length} 字符`);
        
        // 提取俗名
        const commonName = extractCommonName(html, latinName);
        if (commonName) {
            console.log(`提取到俗名: ${commonName}`);
        } else {
            console.log('未提取到俗名');
        }
        
        return {
            html: html,
            commonName: commonName
        };
        
    } catch (error) {
        console.error(`抓取URL失败: ${url}`, error);
        throw error;
    }
}

// 更新记录为抓取成功
async function updateRecordSuccess(client, recordId, htmlContent, commonName) {
    try {
        const query = `
            UPDATE raw_plants 
            SET raw_html = $1, 
                common_name = $2,
                status = 'completed', 
                error_log = NULL, 
                updated_at = NOW() 
            WHERE id = $3
        `;
        
        await client.query(query, [htmlContent, commonName, recordId]);
        console.log(`记录 ${recordId} 抓取成功，HTML和俗名已保存`);
        return true;
    } catch (error) {
        console.error(`更新记录 ${recordId} 成功状态失败:`, error);
        return false;
    }
}

// 更新记录为抓取失败
async function updateRecordFailure(client, recordId, errorMessage) {
    try {
        const query = `
            UPDATE raw_plants 
            SET status = 'failed', 
                error_log = $1, 
                updated_at = NOW() 
            WHERE id = $2
        `;
        
        await client.query(query, [errorMessage, recordId]);
        console.log(`记录 ${recordId} 抓取失败，错误信息已记录`);
        return true;
    } catch (error) {
        console.error(`更新记录 ${recordId} 失败状态失败:`, error);
        return false;
    }
}

// 获取统计信息
async function getStatistics(client) {
    try {
        const query = `
            SELECT 
                status,
                COUNT(*) as count
            FROM raw_plants 
            GROUP BY status
        `;
        
        const result = await client.query(query);
        
        console.log('\n=== 当前统计信息 ===');
        result.rows.forEach(row => {
            console.log(`${row.status}: ${row.count} 条记录`);
        });
        
        return result.rows;
    } catch (error) {
        console.error('获取统计信息失败:', error);
        return [];
    }
}

// 单次抓取函数
async function crawlSinglePlantDetail() {
    const client = initPostgresClient();
    
    try {
        console.log('开始单次抓取植物详情HTML内容...\n');
        
        // 测试数据库连接
        const isConnected = await testDatabaseConnection(client);
        if (!isConnected) {
            console.error('无法连接到数据库，程序退出');
            return;
        }
        
        // 显示初始统计信息
        await getStatistics(client);
        
        console.log('\n--- 开始处理一条记录 ---');
        
        // 获取一条待处理的记录
        const record = await getPendingRecord(client);
        
        if (!record) {
            console.log('没有待处理的记录，任务结束');
            return;
        }
        
        console.log(`处理记录: ID=${record.id}, 拉丁名=${record.latin_name}`);
        
        // 更新状态为抓取中
        const statusUpdated = await updateStatusToCrawling(client, record.id);
        if (!statusUpdated) {
            console.log('状态更新失败，任务结束');
            return;
        }
        
        try {
            // 抓取HTML内容
            const fetchResult = await fetchHtmlContent(record.source_url, record.latin_name);
            
            // 更新为成功状态
            const successUpdated = await updateRecordSuccess(client, record.id, fetchResult.html, fetchResult.commonName);
            if (successUpdated) {
                console.log(`✅ 记录 ${record.id} 处理成功`);
            }
            
        } catch (error) {
            // 更新为失败状态
            const errorMessage = error.message || '未知错误';
            const failureUpdated = await updateRecordFailure(client, record.id, errorMessage);
            if (failureUpdated) {
                console.log(`❌ 记录 ${record.id} 处理失败: ${errorMessage}`);
            }
        }
        
        // 显示最终统计信息
        console.log('\n=== 单次抓取任务完成 ===');
        await getStatistics(client);
        
    } catch (error) {
        console.error('程序执行过程中出现错误:', error);
    } finally {
        await client.end();
        console.log('\n数据库连接已关闭');
    }
}

// 运行主函数
crawlSinglePlantDetail();