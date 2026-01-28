import { Client } from 'pg';

async function checkDbStructure() {
    let client;
    try {
        // 直接使用.env中的Supabase配置
        client = new Client({
            host: 'aws-1-us-west-1.pooler.supabase.com',
            port: 6543,
            user: 'postgres.hunyhbmchzbpnlxsmfqa',
            password: 'pxpNUtasAnj2FL34',
            database: 'postgres',
            ssl: {
                rejectUnauthorized: false
            }
        });

        await client.connect();
        console.log('✅ 成功连接到Supabase数据库');

        // 检查表结构
        const columnsResult = await client.query(
            'SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position',
            ['raw_plants']
        );

        console.log('\n📋 raw_plants表结构:');
        columnsResult.rows.forEach(column => {
            console.log(`${column.column_name}: ${column.data_type}`);
        });

        // 检查记录状态
        const statusResult = await client.query(
            'SELECT status, COUNT(*) as count FROM raw_plants GROUP BY status'
        );

        console.log('\n📊 记录状态分布:');
        statusResult.rows.forEach(row => {
            console.log(`${row.status}: ${row.count}条`);
        });

        // 检查是否有analysis_status字段
        const hasAnalysisStatus = columnsResult.rows.some(col => col.column_name === 'analysis_status');
        console.log(`\n🔍 是否存在analysis_status字段: ${hasAnalysisStatus ? '是' : '否'}`);

        // 如果没有analysis_status字段，添加它
        if (!hasAnalysisStatus) {
            console.log('\n📌 正在添加analysis_status字段...');
            await client.query(
                'ALTER TABLE raw_plants ADD COLUMN analysis_status VARCHAR(20) DEFAULT \'pending\''
            );
            console.log('✅ analysis_status字段添加成功!');
        }

        // 检查ID=1的记录
        const recordResult = await client.query(
            'SELECT id, latin_name, status, analysis_status FROM raw_plants WHERE id = $1',
            [1]
        );

        console.log('\n📄 ID=1的记录信息:');
        console.log(recordResult.rows[0]);

        // 更新ID=1的记录状态为analyzed
        await client.query(
            'UPDATE raw_plants SET analysis_status = $1 WHERE id = $2',
            ['analyzed', 1]
        );
        console.log('\n✅ ID=1的记录状态已更新为analyzed');

    } catch (error) {
        console.error('❌ 数据库操作失败:', error.message);
    } finally {
        await client.end();
    }
}

checkDbStructure();