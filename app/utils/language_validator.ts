/**
 * 语言验证工具
 * 用于验证不同语言的内容是否符合语言规范
 */

/**
 * 检测文本是否包含中文字符
 * @param text 要检测的文本
 * @returns 是否包含中文字符
 */
export function containsChinese(text: string): boolean {
  const chineseRegex = /[\u4e00-\u9fa5]/g;
  return chineseRegex.test(text);
}

/**
 * 检测文本是否包含西班牙语特有的字符
 * @param text 要检测的文本
 * @returns 是否包含西班牙语字符
 */
export function containsSpanish(text: string): boolean {
  // 西班牙语特有的字符：ñ, á, é, í, ó, ú, ü, ¿, ¡ 及其大小写
  const spanishRegex = /[ñáéíóúü¿¡ÑÁÉÍÓÚÜ]/g;
  return spanishRegex.test(text);
}

/**
 * 检测文本是否只包含英语字符
 * @param text 要检测的文本
 * @returns 是否只包含英语字符
 */
export function isEnglishOnly(text: string): boolean {
  // 允许基本的英文字符、数字、标点符号和空格
  const englishRegex = /^[a-zA-Z0-9\s.,!?"'()-;:_]+$/;
  // 检查是否只包含英文字符，并且不包含西班牙语特有的字符
  return englishRegex.test(text) && !containsSpanish(text) && !containsChinese(text);
}

/**
 * 检测文本是否只包含西班牙语字符
 * @param text 要检测的文本
 * @returns 是否只包含西班牙语字符
 */
export function isSpanishOnly(text: string): boolean {
  // 允许基本的西语字符（包括西语特有字符）、数字、标点符号和空格
  const spanishRegex = /^[a-zA-Z0-9ñáéíóúü¿¡\s.,!?"'()-;:_]+$/i;
  // 检查是否只包含西班牙语字符，并且不包含中文字符
  return spanishRegex.test(text) && !containsChinese(text);
}

/**
 * 检测文本是否只包含中文字符
 * @param text 要检测的文本
 * @returns 是否只包含中文字符
 */
export function isChineseOnly(text: string): boolean {
  // 允许中文字符、数字、中文标点符号和空格
  const chineseRegex = /^[\u4e00-\u9fa50-9\s，。！？“”‘’（）；：—]+$/;
  return chineseRegex.test(text);
}

/**
 * 验证标签的语言正确性
 * @param tag 标签对象 { slug: string; en: string; zh: string; es: string }
 * @returns 验证结果对象，包含每个语言的验证状态和错误信息
 */
export function validateTagLanguages(tag: { slug: string; en: string; zh: string; es: string }): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  // 验证英语标签
  if (containsChinese(tag.en)) {
    errors.push(`英语标签 [${tag.en}] 包含中文字符`);
  }
  if (containsSpanish(tag.en)) {
    errors.push(`英语标签 [${tag.en}] 包含西班牙语字符`);
  }
  
  // 验证西班牙语标签
  if (containsChinese(tag.es)) {
    errors.push(`西班牙语标签 [${tag.es}] 包含中文字符`);
  }
  
  // 验证中文标签
  // 中文标签可以包含中英混合，但这里我们只检查是否为空
  if (!tag.zh.trim()) {
    errors.push('中文标签不能为空');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * 验证摘要的语言正确性
 * @param summary 摘要对象 { lang: string; summary: string }
 * @returns 验证结果对象，包含验证状态和错误信息
 */
export function validateSummaryLanguage(summary: { lang: string; summary: string }): {
  isValid: boolean;
  errors: string[];
} {
  const { lang, summary: content } = summary;
  const errors: string[] = [];
  
  if (!content.trim()) {
    errors.push(`${lang.toUpperCase()} 摘要不能为空`);
    return { isValid: false, errors };
  }
  
  switch (lang.toLowerCase()) {
    case 'en':
      if (containsChinese(content)) {
        errors.push(`英语摘要包含中文字符: ${content.slice(0, 50)}...`);
      }
      if (containsSpanish(content)) {
        errors.push(`英语摘要包含西班牙语字符: ${content.slice(0, 50)}...`);
      }
      break;
      
    case 'es':
      if (containsChinese(content)) {
        errors.push(`西班牙语摘要包含中文字符: ${content.slice(0, 50)}...`);
      }
      break;
      
    case 'zh':
      // 中文摘要可以包含中英混合，这里不做严格限制
      break;
      
    default:
      errors.push(`未知语言: ${lang}`);
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}