import { Ignitor, prettyPrintError } from '@adonisjs/core'
import Case from './app/models/case.js'

// 创建应用实例
const ignitor = new Ignitor(__dirname)

async function testTursoConnection() {
  let app: any
  try {
    // 引导应用
    app = await ignitor.httpServer().boot()
    
    console.log('✅ 应用引导成功')
    console.log('🔍 开始测试 TURSO 数据库连接...')
    
    // 测试查询 - 获取前10条记录
    console.log('📊 查询前10条失踪人员案件记录...')
    const cases = await Case.query().limit(10)
    
    console.log(`✅ 查询成功，获取到 ${cases.length} 条记录`)    
    
    // 输出记录详情
    if (cases.length > 0) {
      console.log('\n📋 前5条记录详情：')
      cases.slice(0, 5).forEach((caseItem, index) => {
        console.log(`\n记录 ${index + 1}:`)
        console.log(`- ID: ${caseItem.id}`)
        console.log(`- Case ID: ${caseItem.caseId}`)
        console.log(`- URL Path: ${caseItem.urlPath}`)
        console.log(`- 图片数量: ${caseItem.imageCount}`)
        console.log(`- Webp状态: ${caseItem.imageWebpStatus}`)
        console.log(`- HTML内容长度: ${caseItem.caseHtml?.length || 0} 字符`)
      })
    }
    
    // 测试获取单条记录
    if (cases.length > 0) {
      const firstCase = cases[0]
      console.log(`\n🔍 测试获取单条记录 (ID: ${firstCase.id})...`)
      const singleCase = await Case.find(firstCase.id)
      if (singleCase) {
        console.log(`✅ 单条记录查询成功: ${singleCase.caseId}`)
      } else {
        console.log(`❌ 单条记录查询失败`)
      }
    }
    
    // 测试统计功能
    console.log('\n📈 统计总记录数...')
    const totalCount = await Case.query().count('* as total')
    console.log(`✅ 总记录数: ${totalCount[0].$extras.total}`)
    
    // 测试条件查询
    console.log('\n🔍 测试条件查询（图片数量大于0）...')
    const casesWithImages = await Case.query().where('image_count', '>', 0).limit(5)
    console.log(`✅ 图片数量大于0的记录数: ${casesWithImages.length}`)
    
    console.log('\n🎉 所有测试通过！TURSO 数据库连接和查询正常工作。')
    
  } catch (error: any) {
    console.error('❌ 测试失败:', error)
    prettyPrintError(error)
  } finally {
    // 关闭应用
    await app?.close()
  }
}

// 运行测试
testTursoConnection()