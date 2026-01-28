import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

async function checkDatabaseStructure() {
    try {
        const client = new Client({
            connectionString: process.env.DATABASE_URL
        });

        await client.connect();
        console.log('成功连接到数据库');

        // 检查表结构
        const result = await client.query(
            'SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position',
            ['raw_plants']
        );

        console.log('\nraw_plants表结构:');
        result.rows.forEach(column => {
            console.log(`${column.column_name}: ${column.data_type}`);
        });

        // 检查记录总数和状态分布
        const countResult = await client.query(
            'SELECT status, COUNT(*) as count FROM raw_plants GROUP BY status'
        );

        console.log('\n记录状态分布:');
        countResult.rows.forEach(row => {
            console.log(`${row.status}: ${row.count}条`);
        });

        // 检查ID=1的记录
        const recordResult = await client.query(
            'SELECT id, latin_name, status FROM raw_plants WHERE id = $1',
            [1]
        );

        console.log('\nID=1的记录信息:');
        console.log(recordResult.rows[0]);

    } catch (error) {
        console.error('数据库操作失败:', error);
    } finally {
        await client.end();
    }
}

checkDatabaseStructure();