import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// 获取当前文件的路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 读取plant-xml.xml文件
const xmlFilePath = path.join(__dirname, 'plant-xml.xml');
const outputFilePath = path.join(__dirname, 'plant_links.txt');

// 读取文件内容
const content = fs.readFileSync(xmlFilePath, 'utf8');

// 正则表达式匹配目标链接
const targetPattern = /<loc>https:\/\/pfaf\.org\/User\/Plant\.aspx\?LatinName=[^<]+<\/loc>/g;

// 提取所有匹配的链接
const matches = content.match(targetPattern);

if (!matches) {
    console.log('未找到符合条件的链接');
    process.exit(0);
}

// 清理链接，只保留URL部分
const links = matches.map(match => {
    // 移除<loc>和</loc>标签
    return match.replace('<loc>', '').replace('</loc>', '');
});

// 去重（虽然XML中应该不会有重复）
const uniqueLinks = [...new Set(links)];

// 保存到文件
const outputContent = uniqueLinks.join('\n');
fs.writeFileSync(outputFilePath, outputContent, 'utf8');

// 统计信息
console.log(`找到 ${uniqueLinks.length} 个符合条件的链接`);
console.log(`链接已保存到: ${outputFilePath}`);

// 显示前5个链接作为示例
console.log('\n前5个链接示例:');
uniqueLinks.slice(0, 5).forEach((link, index) => {
    console.log(`${index + 1}. ${link}`);
});