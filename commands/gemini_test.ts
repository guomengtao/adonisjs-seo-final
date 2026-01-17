import { BaseCommand } from '@adonisjs/core/ace'
import env from '#start/env'
import axios from 'axios'
import fs from 'fs'

export default class GeminiTest extends BaseCommand {
  static commandName = 'gemini:test'
  static options = { startApp: true }

  async run() {
    this.logger.info('🚀 启动 Gemini API 检测工具...')

    try {
      // 1. 获取 API 密钥
      const apiKey = env.get('GEMINI_API_KEY')
      if (!apiKey) {
        this.logger.error('❌ 未在环境变量中找到 GEMINI_API_KEY')
        return
      }
      this.logger.info('✅ API 密钥已找到')

      // 2. 使用代理接口
      this.logger.info('\n🔍 使用代理接口: https://chatgpt-proxy.guomengtao.workers.dev/')
      const baseUrl = 'https://chatgpt-proxy.guomengtao.workers.dev'
      const apiPath = '/v1beta/models'
      const version = 'v1beta'
        
      // 3. 获取可用模型列表
      this.logger.info('📋 获取可用模型列表...')
      let allModels: any[] = []
      try {
        const modelsResponse = await axios.get(`${baseUrl}${apiPath}`, {
          params: { key: apiKey }
        })

        allModels = modelsResponse.data.models
        this.logger.success(`✅ 获取模型列表成功! 共找到 ${allModels.length} 个模型`)
        
        const geminiModels = allModels.filter((model: any) => 
          model.name.includes('gemini')
        )

        this.logger.success(`📌 找到 ${geminiModels.length} 个 Gemini 模型`)
        this.logger.info(`📌 找到 ${allModels.length - geminiModels.length} 个非 Gemini 模型`)

      } catch (error: any) {
        this.logger.error(`❌ 获取模型列表失败: ${error.message}`)
        if (error.response?.data) {
          this.logger.error(`   响应数据: ${JSON.stringify(error.response.data, null, 2)}`)
        }
        if (error.response?.status) {
          this.logger.error(`   错误状态: ${error.response.status}`)
        }
        return
      }

      // 4. 逐个测试所有模型的可用性
      this.logger.info('\n🧪 开始测试所有模型的可用性...')
      interface TestResult {
        status: 'success' | 'failed' | 'warning' | 'skipped'
        reason?: string
        error?: string
        response?: string
        model: any
      }
      const testResults: { [key: string]: TestResult } = {}
      const testStats = {
        total: allModels.length,
        success: 0,
        failed: 0,
        skipped: 0
      }

      for (const model of allModels) {
        // 显示简单的测试进度
        this.logger.info(`🔬 测试中: ${model.name}`)
        
        // 检查模型是否支持 generateContent 方法
        if (!model.supportedGenerationMethods || !model.supportedGenerationMethods.includes('generateContent')) {
          testResults[model.name] = {
            status: 'skipped',
            reason: '不支持 generateContent 方法',
            model: model
          }
          testStats.skipped++
          continue
        }

        try {
          // 设置请求超时
          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), 30000) // 30秒超时

          // 发送测试请求
          const cleanModelName = model.name.replace('models/', '')
          const response = await axios.post(`${baseUrl}/v1beta/models/${cleanModelName}:generateContent`, {
            contents: [
              {
                parts: [
                  { text: '你好' }
                ]
              }
            ]
          }, {
            params: { key: apiKey },
            signal: controller.signal
          })

          clearTimeout(timeoutId)

          // 验证响应
          if (response.data && response.data.candidates && response.data.candidates.length > 0) {
            testResults[model.name] = {
              status: 'success',
              model: model
            }
            testStats.success++
          } else {
            testResults[model.name] = {
              status: 'failed',
              reason: '无效响应格式',
              error: '响应中没有包含有效的候选内容',
              model: model
            }
            testStats.failed++
          }
        } catch (error: any) {
          testResults[model.name] = {
            status: 'failed',
            error: error.message || '未知错误',
            model: model
          }
          testStats.failed++
        }
      }

      // 5. 生成测试报告
      this.logger.info('\n📊 测试统计:')
      this.logger.info(`   总模型数: ${testStats.total}`)
      this.logger.info(`   成功: ${testStats.success}`)
      this.logger.info(`   失败: ${testStats.failed}`)
      this.logger.info(`   跳过: ${testStats.skipped}`)

      // 6. 显示详细测试结果
      const availableModels = Object.values(testResults).filter((r: TestResult) => r.status === 'success')
      const unavailableModels = Object.values(testResults).filter((r: TestResult) => r.status === 'failed')
      const skippedModels = Object.values(testResults).filter((r: TestResult) => r.status === 'skipped')

      // 生成完整报告内容
      const reportContent = `📋 Gemini API 模型可用性测试报告
${'='.repeat(50)}

📊 测试统计:
   总模型数: ${testStats.total}
   成功: ${testStats.success}
   失败: ${testStats.failed}
   跳过: ${testStats.skipped}

✅ 可用模型列表:
${availableModels.map((model, index) => `${index + 1}. ${model.model.name} - 测试成功`).join('\n')}

❌ 不可用模型列表:
${unavailableModels.map((model, index) => `${index + 1}. ${model.model.name} - 测试失败\n   错误: ${model.error}`).join('\n')}

⏭️ 跳过的模型列表:
${skippedModels.map((model, index) => `${index + 1}. ${model.model.name} - ${model.reason}`).join('\n')}

📊 API 配置信息:
   API 密钥: ${apiKey.substring(0, 8)}...
   代理 URL: ${baseUrl}
   API 路径: ${apiPath}
   API 版本: ${version}`

      // 将报告保存到文件
      const reportPath = './gemini-test-report.txt'
      fs.writeFileSync(reportPath, reportContent)
      this.logger.info(`\n📄 完整测试报告已保存到: ${reportPath}`)

      // 在命令行中显示部分结果
      if (availableModels.length > 0) {
        this.logger.info('\n✅ 可用模型列表:')
        availableModels.slice(0, 5).forEach((model, index) => {
          this.logger.info(`   ${index + 1}. ${model.model.name} - 测试成功`)
        })
        if (availableModels.length > 5) {
          this.logger.info(`   ... 以及 ${availableModels.length - 5} 个更多可用模型 (详见报告文件)`)
        }
      }

      if (unavailableModels.length > 0) {
        this.logger.info('\n❌ 不可用模型列表:')
        unavailableModels.slice(0, 5).forEach((model, index) => {
          this.logger.info(`   ${index + 1}. ${model.model.name} - 测试失败`)
          if (model.error) {
            this.logger.info(`      错误: ${model.error}`)
          }
        })
        if (unavailableModels.length > 5) {
          this.logger.info(`   ... 以及 ${unavailableModels.length - 5} 个更多不可用模型 (详见报告文件)`)
        }
      }

      if (skippedModels.length > 0) {
        this.logger.info('\n⏭️ 跳过的模型列表:')
        skippedModels.slice(0, 5).forEach((model, index) => {
          this.logger.info(`   ${index + 1}. ${model.model.name} - ${model.reason}`)
        })
        if (skippedModels.length > 5) {
          this.logger.info(`   ... 以及 ${skippedModels.length - 5} 个更多跳过模型 (详见报告文件)`)
        }
      }

      this.logger.success('🎉 Gemini API 检测完成!')

      // 6. 显示 API 配置信息
      this.logger.info('\n📊 API 配置信息:');
      this.logger.info('   - API 密钥: ' + (apiKey ? apiKey.substring(0, 10) + '...' : '未配置'));
      this.logger.info('   - 代理 URL: ' + baseUrl);
      this.logger.info('   - API 路径: ' + apiPath);
      this.logger.info('   - API 版本: ' + version);

      this.logger.success('\n🎉 Gemini API 检测完成!')

    } catch (error: any) {
      this.logger.error(`❌ 检测过程中发生错误: ${error.message}`)
      if (error.response?.data) {
        this.logger.error(`   错误详情: ${JSON.stringify(error.response.data, null, 2)}`)
      }
      this.logger.error(error.stack)
    }
  }
}