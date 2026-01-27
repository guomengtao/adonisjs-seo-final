import db from '@adonisjs/lucid/services/db'

async function testCaseHtml() {
  try {
    // 获取一个案件的case_id
    const cases = await db.from('missing_persons_cases').limit(1).select('case_id')
    if (cases.length === 0) {
      console.log('没有找到案件')
      return
    }
    
    const caseId = cases[0].case_id
    console.log(`测试案件ID: ${caseId}`)
    
    // 获取案件的case_html
    const caseData = await db.from('missing_persons_cases').where('case_id', caseId).select('case_html').first()
    console.log(`\ncase_html内容（前500字符）:`)
    console.log(caseData.case_html.substring(0, 500))
    
    // 查找photos div
    const photosMatch = caseData.case_html.match(/<div\s+id=["']photos["'][^>]*>(.*?)<\/div>/gs)
    console.log(`\n找到的photos div:`)
    if (photosMatch) {
      photosMatch.forEach((match, index) => {
        console.log(`\n第${index+1}个photos div:`)
        console.log(match.substring(0, 300) + '...')
      })
    } else {
      console.log('没有找到photos div')
    }
    
    // 获取图片数据
    const images = await db.from('missing_persons_assets').where('case_id', caseId).select('*')
    console.log(`\n图片数据:`)
    console.log(`找到 ${images.length} 张图片`)
    images.forEach((img, index) => {
      console.log(`\n图片 ${index+1}:`)
      console.log(`  ID: ${img.id}`)
      console.log(`  存储路径: ${img.storage_path}`)
      console.log(`  原始文件名: ${img.filename}`)
      console.log(`  AI处理状态: ${img.ai_processed}`)
    })
    
  } catch (error) {
    console.error('错误:', error)
  } finally {
    process.exit()
  }
}

testCaseHtml()