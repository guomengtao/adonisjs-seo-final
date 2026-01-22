import { BaseCommand } from '@adonisjs/core/ace'
import SeoAiService from '#services/seo_ai_service'

export default class TestAi extends BaseCommand {
  static commandName = 'test:ai'
  static description = '测试AI服务'
  static options = { startApp: true }

  async run() {
    this.logger.info('测试AI服务...')
    
    try {
      // 测试AI服务
      const caseId = 'test-case'
      const content = '这是一个测试案件，包含失踪人员的信息。'
      const originalFilenames = ['test1.jpg', 'test2.jpg']
      
      this.logger.info(`发送测试请求到AI服务...`)
      const result = await SeoAiService.analyze(caseId, content, originalFilenames)
      
      if (result === 'RETRY') {
        this.logger.warning('AI服务返回RETRY，可能需要重试')
      } else if (result) {
        this.logger.success('AI服务返回结果:')
        this.logger.info(JSON.stringify(result, null, 2))
      } else {
        this.logger.error('AI服务返回null')
      }
      
    } catch (error) {
      this.logger.error('测试失败:', error)
    }
  }
}