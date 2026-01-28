import { Client } from 'pg';

// 使用之前在日志中看到的Supabase数据库连接参数
const config = {
    user: 'postgres.hunyhbmchzbpnlxsmfqa',
    host: 'aws-1-us-west-1.pooler.supabase.com',
    database: 'postgres',
    password: 'pxpNUtasAnj2FL34',
    port: 6543,
    ssl: {
        rejectUnauthorized: false
    }
};

// 创建数据库客户端
const client = new Client(config);

async function addExtractedKeywordsColumn() {
    try {
        // 连接到数据库
        await client.connect();
        console.log('数据库连接成功');

        // 检查字段是否已存在
        const checkQuery = `
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'plant_details' 
            AND column_name = 'extracted_keywords';
        `;
        
        const checkResult = await client.query(checkQuery);
        
        if (checkResult.rows.length > 0) {
            console.log('extracted_keywords字段已经存在');
        } else {
            // 添加extracted_keywords字段
            const addColumnQuery = `
                ALTER TABLE plant_details 
                ADD COLUMN extracted_keywords TEXT;
            `;
            
            await client.query(addColumnQuery);
            console.log('extracted_keywords字段添加成功');
        }

        // 显示表结构验证
        const tableStructureQuery = `
            SELECT column_name, data_type, is_nullable 
            FROM information_schema.columns 
            WHERE table_name = 'plant_details' 
            ORDER BY ordinal_position;
        `;
        
        const structureResult = await client.query(tableStructureQuery);
        console.log('\nplant_details表结构:');
        structureResult.rows.forEach(row => {
            console.log(`${row.column_name} (${row.data_type}) - NULL: ${row.is_nullable}`);
        });

    } catch (error) {
        console.error('操作失败:', error);
    } finally {
        // 关闭数据库连接
        await client.end();
        console.log('\n数据库连接已关闭');
    }
}

// 执行函数
addExtractedKeywordsColumn();