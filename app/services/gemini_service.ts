import axios from 'axios';
import env from '#start/env';

class GeminiService {
  private static instance: GeminiService;
  private apiKey: string;
  private baseUrl: string = 'https://chatgpt-proxy.gudq.com';
  // private baseUrl: string = 'https://chatgpt-proxy.guomengtao.workers.dev';

  private availableModels: string[] = [
    'models/gemini-2.5-flash',
    'models/gemma-3-1b-it',
    'models/gemma-3-4b-it',
    'models/gemma-3-27b-it',
    'models/gemma-3n-e4b-it',
    'models/gemma-3n-e2b-it',
    'models/gemini-flash-latest',
    'models/gemini-flash-lite-latest',
    'models/gemini-2.5-flash-lite',
    'models/gemini-2.5-flash-preview-09-2025',
    'models/gemini-2.5-flash-lite-preview-09-2025',
    'models/gemini-3-flash-preview',
    'models/gemini-robotics-er-1.5-preview'
  ];

  private constructor() {
    // 获取API密钥
    this.apiKey = env.get('GEMINI_API_KEY') || '';
  }

  public static getInstance(): GeminiService {
    if (!GeminiService.instance) {
      GeminiService.instance = new GeminiService();
    }
    return GeminiService.instance;
  }

  public async generateMultiLangSummary(details: string, modelIndex: number = 0): Promise<{ summaries: Array<{ lang: string; summary: string }> | null; modelName: string | null }> {
    try {
      const modelName = this.availableModels[modelIndex] || this.availableModels[0];
      console.log(`🔤 使用模型: ${modelName} 生成多语言摘要...`);

      const prompt = `你是一位精通中文、英语、西班牙语的国际寻人专家和多语言 SEO 资深编辑。请分析以下失踪详情：
${details}

任务：为该案件生成中、英、西三语的 SEO 摘要（Summary）。

输出格式要求（必须是合法 JSON，严禁任何额外解释）：
JSON
[
  {
    "lang": "zh",
    "summary": "（150-300字的中文摘要。结构：姓名+时间+地点；核心体貌/衣着特征；呼吁行动。）"
  },
  {
    "lang": "en",
    "summary": "（150-300 words English summary. Professional, native tone, no robotic translation.）"
  },
  {
    "lang": "es",
    "summary": "（Resumen en español de 150-300 palabras. Estilo natural y urgente para búsqueda de personas.）"
  }
]

字段约束准则（严格遵守数据库 NOT NULL 约束）：
lang: 必须且只能是 zh, en, es 中的一个。
summary: 严禁为空。如果原文信息极少，请根据已知碎片信息进行合理扩充描述。

内容策略:
英文摘要需符合母语习惯（使用 "Last seen wearing", "Anyone with information" 等）。
西语摘要需地道（使用 "Visto por última vez", "Se solicita colaboración" 等）。
语言风格需庄重、客观，禁止使用感叹号。`;

      // 使用代理发送请求，添加30秒超时
      const response = await axios.post(`${this.baseUrl}/v1beta/models/${modelName.replace('models/', '')}:generateContent`, {
        contents: [
          {
            parts: [
              { text: prompt }
            ]
          }
        ]
      }, {
        params: { key: this.apiKey },
        timeout: 30000, // 30秒超时
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const text = response.data.candidates[0].content.parts[0].text;

      // 清理AI输出，确保是纯JSON
      let cleanText = text.replace(/^```json|```$/g, '').trim();
      
      // 尝试更彻底地清理，移除可能的多余文本
      cleanText = cleanText.replace(/^[^\[]+([\[\{])/, '$1'); // 移除JSON前的所有文本
      cleanText = cleanText.replace(/([\]\}])[^\]]+$/, '$1'); // 移除JSON后的所有文本
      cleanText = cleanText.replace(/\/\*[\s\S]*?\*\//g, ''); // 移除多行注释
      cleanText = cleanText.replace(/\/\/.*$/gm, ''); // 移除单行注释
      
      // 解析JSON，并处理可能的错误
      let summaries;
      try {
        summaries = JSON.parse(cleanText);
      } catch (parseError) {
        // 尝试修复常见的JSON语法错误
        let fixedText = cleanText;
        
        // 修复行尾缺少逗号的问题（如："lang":"es"\n"summary":"..."）
        fixedText = fixedText.replace(/"\s*:\s*[^,\n}]+\s*\n\s*"/g, (match: string) => {
          // 查找值的结束位置
          const valueEndIndex = match.lastIndexOf('\n');
          if (valueEndIndex > 0) {
            // 在换行前添加逗号
            return match.substring(0, valueEndIndex) + ',\n"';
          }
          return match;
        });
        
        // 修复缺少逗号的问题（如："key":"value""key2":"value2"）
        fixedText = fixedText.replace(/"\s*}\s*\s*\{\s*"/g, '"}, {"');
        fixedText = fixedText.replace(/"\s*}\s*\s*\[\s*"/g, '"}, ["');
        
        // 修复缺少逗号的键值对之间的问题（如："key":"value""key2":"value2"）
        fixedText = fixedText.replace(/("\s*:\s*"[^"\\]*")\s*("\s*:\s*"[^"\\]*")/g, '$1, $2');
        fixedText = fixedText.replace(/("\s*:\s*[0-9]+)\s*("\s*:\s*"[^"\\]*")/g, '$1, $2');
        fixedText = fixedText.replace(/("\s*:\s*true)\s*("\s*:\s*"[^"\\]*")/g, '$1, $2');
        fixedText = fixedText.replace(/("\s*:\s*false)\s*("\s*:\s*"[^"\\]*")/g, '$1, $2');
        
        // 尝试重新解析修复后的JSON
        try {
          summaries = JSON.parse(fixedText);
        } catch (fixedParseError) {
          throw new Error(`JSON解析失败: ${parseError.message}`);
        }
      }

      // 验证输出格式
      if (!Array.isArray(summaries) || summaries.length !== 3) {
        throw new Error('AI返回的摘要格式不正确');
      }

      // 验证每个摘要的语言和内容
      for (const summary of summaries) {
        if (!['zh', 'en', 'es'].includes(summary.lang)) {
          throw new Error(`无效的语言代码: ${summary.lang}`);
        }
        if (!summary.summary || summary.summary.trim() === '') {
          throw new Error(`摘要内容为空: ${summary.lang}`);
        }
      }

      return { summaries, modelName };
    } catch (error) {
      console.error('❌ Gemini AI 生成摘要失败:', error.message);
      
      // 如果当前模型失败，尝试下一个模型
      if (modelIndex < this.availableModels.length - 1) {
        console.log(`🔄 尝试下一个模型 (${modelIndex + 1}/${this.availableModels.length})...`);
        return this.generateMultiLangSummary(details, modelIndex + 1);
      }
      
      return { summaries: null, modelName: null };
    }
  }

  public async generateMultiLangTags(details: string, modelIndex: number = 0): Promise<{ tags: Array<{ slug: string; en: string; zh: string; es: string }> | null; modelName: string | null }> {
    try {
      const modelName = this.availableModels[modelIndex] || this.availableModels[0];
      console.log(`🔤 使用模型: ${modelName} 生成多语言标签...`);

      const prompt = ` 
      专注提取的关键词范围规定限定： 疤痕、纹身、身体残疾、瞳色、发色、是否佩戴眼镜、具体的医疗状况
 强制约束规则：
语言：每个标签必须包含中文 (zh)、英文 (en)、西班牙语 (es)。
URL 安全 (Slug)：为英文标签生成一个 slug 。规则：仅限小写字母、数字和中划线 - ，严禁空格和特殊字符。
禁止符号：标签名称中严禁出现 #, ?, !, *, @ 等符号。

仅提取永久性或高度识别性的体貌特征。

 
❌ 严禁提取：

性别、种族、年龄（这些已有专门字段）。

地点（州、市、县）。

日期、人名、别名、拼写说明。

抽象概念（如“失踪”、“未解决”、“南美数据”）。

输出要求： 仅返回具有搜索过滤价值的特征。如果没有具体特征，直接返回 []
⚠️ 严格约束：
- 严禁脑补：只有原文明确提到的特征才能提取。
- 严禁造假：如果没有提到车辆，严禁输出任何车辆相关的标签。
- 宁缺毋滥：如果信息不足以提取10个标签，请仅输出实际存在的标签，不要凑数。
- 排除项：不要包含 州、县、城市、性别、年龄。
输出格式：必须严格返回一个 JSON 数组，格式如下：[{"slug": "", "en": "", "zh": "", "es": ""}]
案件描述内容：
${details}`;

      // 使用代理发送请求，添加30秒超时
      const response = await axios.post(`${this.baseUrl}/v1beta/models/${modelName.replace('models/', '')}:generateContent`, {
        contents: [
          {
            parts: [
              { text: prompt }
            ]
          }
        ]
      }, {
        params: { key: this.apiKey },
        timeout: 30000, // 30秒超时
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const text = response.data.candidates[0].content.parts[0].text;

      // 清理AI输出，确保是纯JSON
      const cleanText = text.replace(/^```json|```$/g, '').trim();
      const tags = JSON.parse(cleanText);

      // 验证输出格式
      if (!Array.isArray(tags)) {
        throw new Error('AI返回的标签格式不正确');
      }

      // 验证每个标签的格式
      for (const tag of tags) {
        if (!tag.slug || !tag.en || !tag.zh || !tag.es) {
          throw new Error(`标签缺少必要字段: ${JSON.stringify(tag)}`);
        }
        // 验证slug格式
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(tag.slug)) {
          throw new Error(`无效的slug格式: ${tag.slug}`);
        }
      }

      return { tags, modelName };
    } catch (error) {
      console.error('❌ Gemini AI 生成标签失败:', error.message);
      
      // 如果当前模型失败，尝试下一个模型
      if (modelIndex < this.availableModels.length - 1) {
        console.log(`🔄 尝试下一个模型 (${modelIndex + 1}/${this.availableModels.length})...`);
        return this.generateMultiLangTags(details, modelIndex + 1);
      }
      
      return { tags: null, modelName: null };
    }
  }
}

export default GeminiService;