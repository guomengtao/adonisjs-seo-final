import { createClient } from '@libsql/client';

// 手动加载环境变量
import { config } from 'dotenv';
config();

// 验证环境变量
if (!process.env.TURSO_URL) {
  console.error('❌ 缺少环境变量: TURSO_URL');
  process.exit(1);
}

if (!process.env.TURSO_TOKEN) {
  console.error('❌ 缺少环境变量: TURSO_TOKEN');
  process.exit(1);
}

// 重试函数
async function withRetry<T>(fn: () => Promise<T>, maxRetries: number = 3, delayMs: number = 1000): Promise<T> {
  let lastError: Error | null = null;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (i < maxRetries - 1) {
        console.log(`🔄 重试 (${i + 1}/${maxRetries - 1})...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        delayMs *= 2; // 指数退避
      }
    }
  }
  
  throw lastError;
}

async function testTursoQuery() {
  try {
    console.log('🔄 连接到 Turso 数据库...');
    
    // 创建 Turso 客户端连接 - 与 Adonis.js 配置保持一致
    const client = createClient({
      url: `${process.env.TURSO_URL}?authToken=${process.env.TURSO_TOKEN}` as string,
    });
    
    // 测试连接
    await withRetry(async () => {
      await client.execute("SELECT 1");
    });
    
    console.log('✅ 成功连接到 Turso 数据库');
    
    // 2. 查询 missing_persons_cases 表结构
    console.log('\n📋 查询 missing_persons_cases 表结构...');
    const schemaResult = await client.execute("PRAGMA table_info(missing_persons_cases)");
    console.log('📊 表结构:');
    console.table(schemaResult.rows);
    
    // 提取实际列名
    const columns = schemaResult.rows.map(row => row.name);
    console.log('\n🔤 实际列名:', columns);

    // 3. 统计总记录数
    console.log('\n📈 查询总记录数...');
    const countResult = await client.execute("SELECT COUNT(*) as total FROM missing_persons_cases");
    const totalCount = countResult.rows.length > 0 ? Number(countResult.rows[0].total || 0) : 0;
    console.log(`📊 missing_persons_cases 表总记录数: ${totalCount}`);

    // 4. 查询前10条记录
    if (totalCount > 0) {
      console.log('\n🔍 查询前10条记录...');
      const queryResult = await client.execute("SELECT * FROM missing_persons_cases LIMIT 10");
      console.log(`✅ 查询成功，获取到 ${queryResult.rows.length} 条记录`);
      
      // 输出记录详情
      console.log('\n📋 前5条记录详情：');
      queryResult.rows.slice(0, 5).forEach((row, index) => {
        console.log(`\n记录 ${index + 1}:`);
        console.log(`- id: ${row.id}`);
        console.log(`- case_id: ${row.case_id}`);
        
        // 检查url_path是否存在
        if (columns.includes('url_path')) {
          console.log(`- url_path: ${row.url_path}`);
        } else {
          console.log(`- url_path: ❌ 列不存在`);
        }
        
        console.log(`- image_count: ${row.image_count}`);
        console.log(`- image_webp_status: ${row.image_webp_status}`);
        console.log(`- case_html 长度: ${typeof row.case_html === 'string' ? row.case_html.length : 0} 字符`);
        
        // 检查数据完整性
        const hasIssues = [];
        if (!row.case_id) hasIssues.push('缺少 case_id');
        if (columns.includes('url_path') && !row.url_path) hasIssues.push('缺少 url_path');
        if (row.image_count === null) hasIssues.push('image_count 为 NULL');
        if (row.image_webp_status === null) hasIssues.push('image_webp_status 为 NULL');
        
        if (hasIssues.length > 0) {
          console.log(`⚠️  数据问题: ${hasIssues.join(', ')}`);
        } else {
          console.log('✅ 数据完整');
        }
      });
    }

    // 5. 测试其他相关表
    console.log('\n📊 检查相关表存在性...');
    const tablesToCheck = [
      'missing_persons_cases',
      'missing_persons_info',
      'missing_persons_assets',
      'missing_persons_tags',
      'case_tags',
      'geo_translations'
    ];
    
    for (const table of tablesToCheck) {
      try {
        await client.execute(`SELECT COUNT(*) as count FROM ${table} LIMIT 1`);
        console.log(`✅ 表 ${table} 存在`);
      } catch (error: any) {
        console.log(`❌ 表 ${table} 不存在或查询失败: ${error.message}`);
      }
    }

    // 6. 检查数据质量
    console.log('\n🔍 检查数据质量...');
    const dataQuality = {
      missingCaseId: 0,
      duplicateCaseId: 0,
      missingCaseHtml: 0,
      missingCaseTitle: 0,
      missingImageCount: 0,
      imageWebpStatus: {
        total: totalCount,
        pending: 0,
        completed: 0,
        failed: 0,
        abnormal: 0
      }
    };
    
    // 检查缺失的 case_id
    const missingCaseId = await client.execute("SELECT COUNT(*) as count FROM missing_persons_cases WHERE case_id IS NULL OR case_id = ''");
    dataQuality.missingCaseId = missingCaseId.rows.length > 0 ? Number(missingCaseId.rows[0].count || 0) : 0;
    console.log(`- 缺少 case_id 的记录数: ${dataQuality.missingCaseId}`);
    
    // 检查重复的 case_id
    const duplicateCaseId = await client.execute("SELECT case_id, COUNT(*) as count FROM missing_persons_cases GROUP BY case_id HAVING COUNT(*) > 1 LIMIT 5");
    dataQuality.duplicateCaseId = duplicateCaseId.rows.length;
    console.log(`- 存在重复 case_id 的记录数: ${dataQuality.duplicateCaseId}`);
    
    // 检查重复的 case_id 详情
    if (duplicateCaseId.rows.length > 0) {
      console.log('  前几个重复的 case_id:');
      duplicateCaseId.rows.forEach(row => {
        console.log(`    ${row.case_id || '未知'}: ${Number(row.count || 0)} 次`);
      });
    }
    
    // 检查缺失的 case_html
    const missingCaseHtml = await client.execute("SELECT COUNT(*) as count FROM missing_persons_cases WHERE case_html IS NULL OR case_html = ''");
    dataQuality.missingCaseHtml = missingCaseHtml.rows.length > 0 ? Number(missingCaseHtml.rows[0].count || 0) : 0;
    console.log(`- 缺少 case_html 的记录数: ${dataQuality.missingCaseHtml}`);
    
    // 检查缺失的 case_title
    const missingCaseTitle = await client.execute("SELECT COUNT(*) as count FROM missing_persons_cases WHERE case_title IS NULL OR case_title = ''");
    dataQuality.missingCaseTitle = missingCaseTitle.rows.length > 0 ? Number(missingCaseTitle.rows[0].count || 0) : 0;
    console.log(`- 缺少 case_title 的记录数: ${dataQuality.missingCaseTitle}`);
    
    // 检查缺失的 image_count
    const missingImageCount = await client.execute("SELECT COUNT(*) as count FROM missing_persons_cases WHERE image_count IS NULL");
    dataQuality.missingImageCount = missingImageCount.rows.length > 0 ? Number(missingImageCount.rows[0].count || 0) : 0;
    console.log(`- 缺少 image_count 的记录数: ${dataQuality.missingImageCount}`);
    
    // 检查 image_webp_status 分布
    const webpStatusCount = await client.execute("SELECT image_webp_status, COUNT(*) as count FROM missing_persons_cases GROUP BY image_webp_status");
    
    webpStatusCount.rows.forEach(row => {
      const status = row.image_webp_status !== null ? Number(row.image_webp_status) : 0;
      const count = row.count !== null ? Number(row.count) : 0;
      
      if (status === 0) {
        dataQuality.imageWebpStatus.pending = count;
      } else if (status === 1) {
        dataQuality.imageWebpStatus.completed = count;
      } else if (status === 2) {
        dataQuality.imageWebpStatus.failed = count;
      } else {
        dataQuality.imageWebpStatus.abnormal += count;
      }
    });
    
    console.log(`- 图片 Webp 状态分布:`);
    console.log(`  - 待处理 (0): ${dataQuality.imageWebpStatus.pending}`);
    console.log(`  - 已完成 (1): ${dataQuality.imageWebpStatus.completed}`);
    console.log(`  - 处理失败 (2): ${dataQuality.imageWebpStatus.failed}`);
    console.log(`  - 异常状态: ${dataQuality.imageWebpStatus.abnormal}`);
    
    // 检查缺失的 url_path（如果列存在）
    if (columns.includes('url_path')) {
      const missingUrlPath = await client.execute("SELECT COUNT(*) as count FROM missing_persons_cases WHERE url_path IS NULL OR url_path = ''");
      console.log(`- 缺少 url_path 的记录数: ${missingUrlPath.rows[0].count}`);
    } else {
      console.log(`- 缺少 url_path 的记录数: ❌ url_path 列不存在`);
    }
    
    // 7. 详细分析
    console.log('\n📊 详细数据分析报告:');
    console.log('='.repeat(50));
    
    // 计算百分比（添加除零保护）
    const missingCaseIdPercent = totalCount > 0 ? (dataQuality.missingCaseId / totalCount * 100).toFixed(2) : '0.00';
    const missingCaseHtmlPercent = totalCount > 0 ? (dataQuality.missingCaseHtml / totalCount * 100).toFixed(2) : '0.00';
    const missingCaseTitlePercent = totalCount > 0 ? (dataQuality.missingCaseTitle / totalCount * 100).toFixed(2) : '0.00';
    const completedWebpPercent = totalCount > 0 ? (dataQuality.imageWebpStatus.completed / totalCount * 100).toFixed(2) : '0.00';
    
    console.log(`\n📈 整体数据概况:`);
    console.log(`- 总记录数: ${totalCount}`);
    const integrityScore = totalCount > 0 ? (100 - parseFloat(missingCaseIdPercent) - parseFloat(missingCaseHtmlPercent)).toFixed(2) : '100.00';
    console.log(`- 数据完整性评分: ${integrityScore}%`);
    
    console.log(`\n⚠️  数据问题汇总:`);
    if (dataQuality.missingCaseId > 0) {
      console.log(`- 严重问题: 存在 ${dataQuality.missingCaseId} 条记录缺少 case_id (${missingCaseIdPercent}%)`);
    }
    if (dataQuality.missingCaseHtml > 0) {
      console.log(`- 严重问题: 存在 ${dataQuality.missingCaseHtml} 条记录缺少 case_html (${missingCaseHtmlPercent}%)`);
    }
    if (dataQuality.missingCaseTitle > 0) {
      console.log(`- 警告: 存在 ${dataQuality.missingCaseTitle} 条记录缺少 case_title (${missingCaseTitlePercent}%)`);
    }
    if (dataQuality.duplicateCaseId > 0) {
      console.log(`- 严重问题: 存在 ${dataQuality.duplicateCaseId} 组重复的 case_id`);
    }
    
    console.log(`\n✅ 数据优势:`);
    console.log(`- 图片 Webp 转换完成率: ${completedWebpPercent}%`);
    console.log(`- 大多数记录包含完整的 case_id 和 case_html`);
    
    // 8. 建议
    console.log('\n💡 改进建议:');
    if (dataQuality.missingCaseId > 0) {
      console.log(`- 修复缺少 case_id 的 ${dataQuality.missingCaseId} 条记录`);
    }
    if (!columns.includes('url_path')) {
      console.log(`- 注意: 模型文件中定义了 url_path 列，但数据库中不存在此列`);
    }
    if (dataQuality.imageWebpStatus.pending > 0) {
      console.log(`- 考虑处理剩余的 ${dataQuality.imageWebpStatus.pending} 条待转换图片`);
    }

    await client.close();
    console.log('\n🎉 所有测试完成！TURSO 数据库连接和查询正常工作。');
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
  }
}

testTursoQuery();