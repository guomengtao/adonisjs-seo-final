import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import * as cheerio from 'cheerio';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 安全的文本提取函数
function safeExtractText($, selector) {
    const element = $(selector);
    if (element.length > 0) {
        return element.text().trim();
    }
    return '';
}

// 安全的属性提取函数
function safeExtractAttr($, selector, attr) {
    const element = $(selector);
    if (element.length > 0) {
        return element.attr(attr) || '';
    }
    return '';
}

// 提取相关植物信息
function extractRelatedPlants($) {
    const relatedPlants = [];
    
    $('#ContentPlaceHolder1_gvresults tr.content').each((index, element) => {
        if (index === 0) return; // 跳过表头
        
        const cells = $(element).find('td');
        if (cells.length >= 11) {
            const plant = {
                latinName: $(cells[0]).text().trim(),
                commonName: $(cells[1]).text().trim(),
                habit: $(cells[2]).text().trim(),
                height: $(cells[3]).text().trim(),
                hardiness: $(cells[4]).text().trim(),
                growth: $(cells[5]).text().trim(),
                soil: $(cells[6]).text().trim(),
                shade: $(cells[7]).text().trim(),
                moisture: $(cells[8]).text().trim(),
                edible: $(cells[9]).text().trim(),
                medicinal: $(cells[10]).text().trim(),
                otherUses: cells[11] ? $(cells[11]).text().trim() : ''
            };
            relatedPlants.push(plant);
        }
    });
    
    return relatedPlants;
}

// 提取图片信息
function extractImages($) {
    const images = [];
    
    $('#ContentPlaceHolder1_tblPlantImges img').each((index, element) => {
        const img = $(element);
        images.push({
            src: img.attr('src') || '',
            alt: img.attr('alt') || '',
            title: img.attr('title') || '',
            width: img.attr('width') || ''
        });
    });
    
    return images;
}

// 提取护理图标信息
function extractCareIcons($) {
    const careIcons = [];
    
    $('#ContentPlaceHolder1_tblIcons img').each((index, element) => {
        const img = $(element);
        careIcons.push({
            src: img.attr('src') || '',
            alt: img.attr('alt') || '',
            title: img.attr('title') || ''
        });
    });
    
    return careIcons;
}

// 解析HTML文件并提取植物详情
function extractPlantDetails(htmlContent) {
    const $ = cheerio.load(htmlContent);
    
    // 提取基本信息
    const plantData = {
        // 拉丁名
        latinName: safeExtractText($, '#ContentPlaceHolder1_lbldisplatinname'),
        
        // 俗名
        commonName: safeExtractText($, '#ContentPlaceHolder1_lblCommanName'),
        
        // 科名
        family: safeExtractText($, '#ContentPlaceHolder1_lblFamily'),
        
        // USDA耐寒性
        usdaHardiness: safeExtractText($, '#ContentPlaceHolder1_lblUSDAhardiness'),
        
        // 已知危害
        knownHazards: safeExtractText($, '#ContentPlaceHolder1_lblKnownHazards'),
        
        // 栖息地
        habitats: safeExtractText($, '#ContentPlaceHolder1_txtHabitats'),
        
        // 分布范围
        range: safeExtractText($, '#ContentPlaceHolder1_lblRange'),
        
        // 食用评级
        edibilityRating: safeExtractText($, '#ContentPlaceHolder1_txtEdrating'),
        
        // 其他用途评级
        otherUsesRating: safeExtractText($, '#ContentPlaceHolder1_txtOtherUseRating'),
        
        // 杂草潜力
        weedPotential: safeExtractText($, '#ContentPlaceHolder1_lblWeedPotential'),
        
        // 药用评级
        medicinalRating: safeExtractText($, '#ContentPlaceHolder1_txtMedRating'),
        
        // 物理特性
        physicalCharacteristics: safeExtractText($, '#ContentPlaceHolder1_lblPhystatment'),
        
        // 同义词
        synonyms: safeExtractText($, '#ContentPlaceHolder1_lblSynonyms'),
        
        // 植物栖息地
        plantHabitats: safeExtractText($, '#ContentPlaceHolder1_lblhabitats'),
        
        // 食用用途
        edibleUses: safeExtractText($, '#ContentPlaceHolder1_txtEdibleUses'),
        
        // 药用用途
        medicinalUses: safeExtractText($, '#ContentPlaceHolder1_txtMediUses'),
        
        // 其他用途
        otherUses: safeExtractText($, '#ContentPlaceHolder1_txtOtherUses'),
        
        // 特殊用途
        specialUses: safeExtractText($, '#ContentPlaceHolder1_txtSpecialUses'),
        
        // 栽培详情
        cultivationDetails: safeExtractText($, '#ContentPlaceHolder1_txtCultivationDetails'),
        
        // 植物繁殖
        propagation: safeExtractText($, '#ContentPlaceHolder1_txtPropagation'),
        
        // 其他名称
        otherNames: safeExtractText($, '#ContentPlaceHolder1_lblOtherNameText'),
        
        // 原生范围
        nativeRange: safeExtractText($, '#ContentPlaceHolder1_lblFoundInText'),
        
        // 杂草潜力文本
        weedPotentialText: safeExtractText($, '#ContentPlaceHolder1_lblWeedPotentialText'),
        
        // 保护状态
        conservationStatus: safeExtractText($, '#ContentPlaceHolder1_lblConservationStatus'),
        
        // 相关植物
        relatedPlants: extractRelatedPlants($),
        
        // 图片信息
        images: extractImages($),
        
        // 护理图标
        careIcons: extractCareIcons($),
        
        // 元数据
        metaDescription: safeExtractAttr($, 'meta[name="description"]', 'content'),
        pageTitle: safeExtractText($, 'title')
    };
    
    return plantData;
}

// 主函数
async function main() {
    try {
        // 读取HTML文件
        const htmlContent = readFileSync('./plant-html.html', 'utf8');
        
        // 提取植物详情
        const plantDetails = extractPlantDetails(htmlContent);
        
        // 保存为JSON文件
        writeFileSync('./plant_details.json', JSON.stringify(plantDetails, null, 2), 'utf8');
        
        console.log('植物详情提取完成！');
        console.log(`提取的字段数量: ${Object.keys(plantDetails).length}`);
        console.log(`相关植物数量: ${plantDetails.relatedPlants.length}`);
        console.log(`图片数量: ${plantDetails.images.length}`);
        console.log('数据已保存到 plant_details.json');
        
        // 显示部分数据预览
        console.log('\n=== 数据预览 ===');
        console.log(`拉丁名: ${plantDetails.latinName}`);
        console.log(`俗名: ${plantDetails.commonName}`);
        console.log(`科名: ${plantDetails.family}`);
        console.log(`食用评级: ${plantDetails.edibilityRating}`);
        console.log(`药用评级: ${plantDetails.medicinalRating}`);
        console.log(`物理特性: ${plantDetails.physicalCharacteristics.substring(0, 100)}...`);
        
    } catch (error) {
        console.error('提取过程中出现错误:', error);
    }
}

// 运行主函数
main();