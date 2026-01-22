import { createClient } from '@libsql/client';

// 手动加载环境变量
import { config } from 'dotenv';
config();

async function checkTursoTable() {
  try {
    console.log('🔄 连接到 Turso 数据库...');
    
    // 创建 Turso 客户端连接
    const client = createClient({
      url: process.env.TURSO_URL || '',
      authToken: process.env.TURSO_TOKEN || '',
    });

    // 1. 检查表结构
    console.log('\n📋 查询 missing_persons_assets 表结构...');
    const schemaResult = await client.execute("PRAGMA table_info(missing_persons_assets)");
    console.log('📊 表结构:');
    console.table(schemaResult.rows);

    // 2. 检查表索引
    console.log('\n🔍 查询 missing_persons_assets 表索引...');
    const indexResult = await client.execute("PRAGMA index_list(missing_persons_assets)");
    console.log('📊 索引列表:');
    console.table(indexResult.rows);

    // 3. 检查数据量
    console.log('\n📈 查询 missing_persons_assets 表数据量...');
    const countResult = await client.execute("SELECT COUNT(*) as total FROM missing_persons_assets");
    console.log(`📊 总记录数: ${countResult.rows[0].total}`);

    // 4. 检查待处理记录数
    console.log('\n⏳ 查询待处理记录数...');
    const pendingResult = await client.execute("SELECT COUNT(*) as pending FROM missing_persons_assets WHERE ai_processed = 0");
    console.log(`📊 待处理记录数: ${pendingResult.rows[0].pending}`);

    // 5. 检查 DISTINCT case_id 数量
    console.log('\n🔄 查询 DISTINCT case_id 数量...');
    const distinctResult = await client.execute("SELECT COUNT(DISTINCT case_id) as distinct_cases FROM missing_persons_assets WHERE ai_processed = 0");
    console.log(`📊 待处理案件数: ${distinctResult.rows[0].distinct_cases}`);

    // 6. 尝试执行原始查询，模拟卡住的情况
    console.log('\n🚀 执行原始查询 (SELECT DISTINCT case_id FROM missing_persons_assets WHERE ai_processed = 0)...');
    const startTime = Date.now();
    const queryResult = await client.execute("SELECT DISTINCT case_id FROM missing_persons_assets WHERE ai_processed = 0");
    const endTime = Date.now();
    console.log(`✅ 查询完成，耗时 ${endTime - startTime}ms`);
    console.log(`📊 返回 ${queryResult.rows.length} 个案件`);

    // 7. 显示前几个结果
    if (queryResult.rows.length > 0) {
      console.log('\n🔍 前几个案件:');
      console.table(queryResult.rows.slice(0, 5));
    }

    await client.close();
    console.log('\n✅ 数据库检查完成');
  } catch (error) {
    console.error('❌ 数据库检查失败:', error);
  }
}

checkTursoTable();