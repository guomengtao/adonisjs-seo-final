import { BaseCommand, args } from '@adonisjs/core/ace';
import db from '@adonisjs/lucid/services/db';
import GeminiService from '#services/gemini_service';

export default class GeminiSummaryTest extends BaseCommand {
  static commandName = 'gemini:summary-test';
  static description = '测试Gemini AI生成多语言案件摘要';
  static options = { startApp: true };

  // 定义案件ID参数
  @args.string({
    required: true,
    description: '案件ID'
  })
  declare caseId: string;

  async run() {
    try {
      this.logger.info(`🔍 测试Gemini AI多语言摘要生成服务...`);
      
      // 获取指定案件信息
      const caseRecord = await db.from('missing_persons_cases')
        .where('case_id', this.caseId)
        .first();

      if (!caseRecord) {
        this.logger.error(`❌ 未找到案件: ${this.caseId}`);
        return;
      }

      if (!caseRecord.case_html) {
        this.logger.error(`❌ 案件 ${this.caseId} 无HTML内容`);
        return;
      }

      this.logger.info(`📋 测试案件: ${this.caseId} (ID: ${caseRecord.id})`);

      // 清理HTML内容，提取纯文本
      const cleanText = this.cleanHtml(caseRecord.case_html);
      this.logger.info(`📝 清理后的文本长度: ${cleanText.length} 字符`);

      // 使用Gemini AI生成多语言摘要
      const geminiService = GeminiService.getInstance();
      this.logger.info('🔤 正在生成多语言摘要...');
      
      const { summaries, modelName } = await geminiService.generateMultiLangSummary(cleanText);

      if (!summaries || !modelName) {
        this.logger.error(`❌ 摘要生成失败`);
        return;
      }

      // 显示结果
      this.logger.success('✅ 摘要生成成功！');
      this.logger.info(`💡 使用的模型: ${modelName}`);
      this.logger.info('\n📋 生成的多语言摘要：');
      
      for (const summary of summaries) {
        const { lang, summary: content } = summary;
        this.logger.info(`\n🌐 ${lang.toUpperCase()}`);
        this.logger.info('-' . repeat(50));
        this.logger.info(content);
      }

    } catch (error: any) {
      this.logger.error(`🚨 测试错误: ${error.message}`);
      this.logger.error(error.stack || '');
    }
  }

  private cleanHtml(html: string): string {
    // 移除HTML标签
    let text = html.replace(/<[^>]*>/g, ' ');
    // 移除多余空格
    text = text.replace(/\s+/g, ' ').trim();
    // 截取前2000字符（避免超出API限制）
    return text.substring(0, 2000);
  }
}