import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// 获取当前文件的路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 读取plant.md文件
const plantMdPath = path.join(__dirname, 'plant.md');
const plantJsonPath = path.join(__dirname, 'plant.json');

// 读取文件内容
const content = fs.readFileSync(plantMdPath, 'utf8');
const lines = content.split('\n');

// 解析表格数据
const plants = [];
const latinNameSet = new Set(); // 用于确保Latin Name唯一

let id = 1;

for (let i = 2; i < lines.length; i++) { // 跳过表头
    const line = lines[i].trim();
    if (!line || !line.startsWith('|')) continue;
    
    // 解析表格行
    const cells = line.split('|').map(cell => cell.trim()).filter(cell => cell);
    
    if (cells.length >= 4) {
        // 提取Latin Name和URL
        const latinNameCell = cells[0];
        const commonName = cells[1];
        const edibilityRating = parseInt(cells[2]) || 0;
        const medicinalRating = parseInt(cells[3]) || 0;
        
        // 从Markdown链接中提取Latin Name和URL
        const latinNameMatch = latinNameCell.match(/\[(.*?)\]\((.*?)\)/);
        
        if (latinNameMatch) {
            const latinName = latinNameMatch[1];
            const url = latinNameMatch[2];
            
            // 检查Latin Name是否唯一
            if (!latinNameSet.has(latinName)) {
                latinNameSet.add(latinName);
                
                plants.push({
                    id: id++,
                    latinName: latinName,
                    url: url,
                    commonName: commonName,
                    edibilityRating: edibilityRating,
                    medicinalRating: medicinalRating
                });
            }
        } else {
            // 如果没有链接，直接使用文本作为Latin Name
            const latinName = latinNameCell;
            
            if (!latinNameSet.has(latinName)) {
                latinNameSet.add(latinName);
                
                plants.push({
                    id: id++,
                    latinName: latinName,
                    url: null,
                    commonName: commonName,
                    edibilityRating: edibilityRating,
                    medicinalRating: medicinalRating
                });
            }
        }
    }
}

// 转换为JSON格式
const jsonData = {
    totalPlants: plants.length,
    plants: plants
};

// 写入JSON文件
fs.writeFileSync(plantJsonPath, JSON.stringify(jsonData, null, 2), 'utf8');

console.log(`成功转换 ${plants.length} 种植物数据`);
console.log(`JSON文件已保存到: ${plantJsonPath}`);