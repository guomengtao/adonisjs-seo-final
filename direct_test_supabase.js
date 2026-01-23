import { Client } from 'pg';
import fs from 'fs';

// 读取.env文件获取Supabase连接URL
const envContent = fs.readFileSync('.env', 'utf8');
const supabaseUrlMatch = envContent.match(/SUPABASE_URL\s*=\s*(.+)/);

if (!supabaseUrlMatch) {
  console.error('在.env文件中未找到SUPABASE_URL');
  process.exit(1);
}

const supabaseUrl = supabaseUrlMatch[1].trim().replace(/^"|"$/g, '');
console.log('使用的Supabase连接URL:', supabaseUrl);

// 创建PG客户端
const client = new Client(supabaseUrl);

async function testConnection() {
  try {
    console.log('正在连接到Supabase...');
    await client.connect();
    console.log('连接成功！');
    
    // 执行一个简单查询
    const res = await client.query('SELECT NOW() as current_time');
    console.log('查询结果:', res.rows[0]);
    
    // 列出数据库中的表
    const tablesRes = await client.query(
      'SELECT table_name FROM information_schema.tables WHERE table_schema = $1',
      ['public']
    );
    console.log('数据库中的表:', tablesRes.rows.map(row => row.table_name));
    
  } catch (err) {
    console.error('连接失败:', err);
  } finally {
    await client.end();
    console.log('连接已关闭');
  }
}

testConnection();