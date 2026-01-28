import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { config } from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 加载环境变量
config({ path: `${__dirname}/../.env` });

// 从URL中提取拉丁名
function extractLatinNameFromUrl(url) {
    try {
        const urlObj = new URL(url);
        const latinNameParam = urlObj.searchParams.get('LatinName');
        if (latinNameParam) {
            // 将URL编码的+号替换为空格
            return latinNameParam.replace(/\+/g, ' ');
        }
        return null;
    } catch (error) {
        console.error(`解析URL失败: ${url}`, error);
        return null;
    }
}

// 初始化Supabase客户端
function initSupabaseClient() {
    // 检查是否有直接的Supabase URL配置
    let supabaseUrl = process.env.SUPABASE_URL;
    
    if (!supabaseUrl) {
        // 如果没有直接配置，尝试从PostgreSQL配置构建Supabase URL
        // Supabase项目URL通常是 https://[project-id].supabase.co
        const projectId = process.env.PG_USER?.split('.')[1]; // 从用户名中提取项目ID
        if (projectId) {
            supabaseUrl = `https://${projectId}.supabase.co`;
        } else {
            throw new Error('无法确定Supabase项目URL，请设置SUPABASE_URL环境变量');
        }
    }
    
    const supabaseKey = process.env.SUPABASE_KEY || process.env.PG_PASSWORD;
    
    if (!supabaseKey) {
        throw new Error('未找到Supabase API密钥，请设置SUPABASE_KEY环境变量');
    }
    
    console.log('正在初始化Supabase客户端...');
    console.log(`项目URL: ${supabaseUrl}`);
    
    return createClient(supabaseUrl, supabaseKey, {
        auth: {
            persistSession: false
        }
    });
}

// 检查数据库连接
async function testDatabaseConnection(supabase) {
    try {
        console.log('正在测试数据库连接...');
        const { data, error } = await supabase.from('raw_plants').select('count').limit(1);
        
        if (error) {
            console.error('数据库连接测试失败:', error);
            return false;
        }
        
        console.log('数据库连接测试成功！');
        return true;
    } catch (error) {
        console.error('数据库连接测试异常:', error);
        return false;
    }
}

// 批量插入数据到数据库
async function insertPlantLinksToDatabase(supabase, plantLinks) {
    const batchSize = 100; // 每批处理100条记录
    let successCount = 0;
    let errorCount = 0;
    
    console.log(`开始插入 ${plantLinks.length} 条植物链接到数据库...`);
    
    for (let i = 0; i < plantLinks.length; i += batchSize) {
        const batch = plantLinks.slice(i, i + batchSize);
        const batchNumber = Math.floor(i / batchSize) + 1;
        const totalBatches = Math.ceil(plantLinks.length / batchSize);
        
        console.log(`\n处理批次 ${batchNumber}/${totalBatches} (${batch.length} 条记录)...`);
        
        const records = batch.map(url => {
            const latinName = extractLatinNameFromUrl(url);
            
            return {
                latin_name: latinName,
                common_name: null, // 暂时为空，后续抓取时填充
                source_url: url,
                raw_html: '', // 暂时为空，后续抓取时填充
                status: 'pending',
                error_log: null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
        }).filter(record => record.latin_name !== null);
        
        try {
            const { data, error } = await supabase
                .from('raw_plants')
                .insert(records)
                .select();
            
            if (error) {
                console.error(`批次 ${batchNumber} 插入失败:`, error);
                errorCount += batch.length;
            } else {
                console.log(`批次 ${batchNumber} 插入成功，插入了 ${data.length} 条记录`);
                successCount += data.length;
            }
        } catch (error) {
            console.error(`批次 ${batchNumber} 插入异常:`, error);
            errorCount += batch.length;
        }
        
        // 添加延迟以避免过快的请求
        if (i + batchSize < plantLinks.length) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }
    
    return { successCount, errorCount };
}

// 主函数
async function main() {
    try {
        console.log('开始导入植物链接到Supabase数据库...\n');
        
        // 读取plant_links.txt文件
        console.log('正在读取plant_links.txt文件...');
        const fileContent = readFileSync('./plant_links.txt', 'utf8');
        const plantLinks = fileContent.split('\n').filter(line => line.trim() !== '');
        
        console.log(`找到 ${plantLinks.length} 条植物链接`);
        
        // 初始化Supabase客户端
        const supabase = initSupabaseClient();
        
        // 测试数据库连接
        const isConnected = await testDatabaseConnection(supabase);
        if (!isConnected) {
            console.error('无法连接到数据库，程序退出');
            return;
        }
        
        // 插入数据到数据库
        const { successCount, errorCount } = await insertPlantLinksToDatabase(supabase, plantLinks);
        
        console.log('\n=== 导入结果汇总 ===');
        console.log(`总链接数: ${plantLinks.length}`);
        console.log(`成功插入: ${successCount}`);
        console.log(`失败数量: ${errorCount}`);
        console.log(`成功率: ${((successCount / plantLinks.length) * 100).toFixed(2)}%`);
        
        if (successCount > 0) {
            console.log('\n数据已成功导入到Supabase数据库的raw_plants表中！');
            console.log('下一步可以开始抓取植物详情数据。');
        } else {
            console.error('\n数据导入失败，请检查数据库连接和表结构。');
        }
        
    } catch (error) {
        console.error('程序执行过程中出现错误:', error);
    }
}

// 运行主函数
main();