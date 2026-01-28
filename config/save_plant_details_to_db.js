import { Client } from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import * as cheerio from 'cheerio';
import { config } from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 加载环境变量
config({ path: `${__dirname}/../.env` });

// 初始化PostgreSQL客户端
function initPostgresClient() {
    // 从环境变量构建连接字符串
    const host = process.env.PG_HOST;
    const port = process.env.PG_PORT;
    const user = process.env.PG_USER;
    const password = process.env.PG_PASSWORD;
    const database = process.env.PG_DB_NAME;
    
    if (!host || !port || !user || !password || !database) {
        throw new Error('请设置完整的PostgreSQL环境变量 (PG_HOST, PG_PORT, PG_USER, PG_PASSWORD, PG_DB_NAME)');
    }
    
    const connectionString = `postgresql://${user}:${password}@${host}:${port}/${database}?sslmode=no-verify`;
    
    console.log('正在初始化PostgreSQL客户端...');
    console.log('连接URL:', connectionString.replace(password, '***'));
    
    // 添加SSL配置
    const client = new Client({
        connectionString: connectionString,
        ssl: {
            rejectUnauthorized: false
        }
    });
    
    return client;
}

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
                latin_name: $(cells[0]).text().trim(),
                common_name: $(cells[1]).text().trim(),
                habit: $(cells[2]).text().trim(),
                height: $(cells[3]).text().trim(),
                hardiness: $(cells[4]).text().trim(),
                growth: $(cells[5]).text().trim(),
                soil: $(cells[6]).text().trim(),
                shade: $(cells[7]).text().trim(),
                moisture: $(cells[8]).text().trim(),
                edible: $(cells[9]).text().trim(),
                medicinal: $(cells[10]).text().trim(),
                other_uses: cells[11] ? $(cells[11]).text().trim() : ''
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
        latin_name: safeExtractText($, '#ContentPlaceHolder1_lbldisplatinname'),
        
        // 俗名
        common_name: safeExtractText($, '#ContentPlaceHolder1_lblCommanName'),
        
        // 科名
        family: safeExtractText($, '#ContentPlaceHolder1_lblFamily'),
        
        // USDA耐寒性
        usda_hardiness: safeExtractText($, '#ContentPlaceHolder1_lblUSDAhardiness'),
        
        // 已知危害
        known_hazards: safeExtractText($, '#ContentPlaceHolder1_lblKnownHazards'),
        
        // 栖息地
        habitats: safeExtractText($, '#ContentPlaceHolder1_txtHabitats'),
        
        // 分布范围
        range: safeExtractText($, '#ContentPlaceHolder1_lblRange'),
        
        // 食用评级
        edibility_rating: safeExtractText($, '#ContentPlaceHolder1_txtEdrating'),
        
        // 其他用途评级
        other_uses_rating: safeExtractText($, '#ContentPlaceHolder1_txtOtherUseRating'),
        
        // 杂草潜力
        weed_potential: safeExtractText($, '#ContentPlaceHolder1_lblWeedPotential'),
        
        // 药用评级
        medicinal_rating: safeExtractText($, '#ContentPlaceHolder1_txtMedRating'),
        
        // 物理特性
        physical_characteristics: safeExtractText($, '#ContentPlaceHolder1_lblPhystatment'),
        
        // 同义词
        synonyms: safeExtractText($, '#ContentPlaceHolder1_lblSynonyms'),
        
        // 植物栖息地
        plant_habitats: safeExtractText($, '#ContentPlaceHolder1_lblhabitats'),
        
        // 食用用途
        edible_uses: safeExtractText($, '#ContentPlaceHolder1_txtEdibleUses'),
        
        // 药用用途
        medicinal_uses: safeExtractText($, '#ContentPlaceHolder1_txtMediUses'),
        
        // 其他用途
        other_uses: safeExtractText($, '#ContentPlaceHolder1_txtOtherUses'),
        
        // 特殊用途
        special_uses: safeExtractText($, '#ContentPlaceHolder1_txtSpecialUses'),
        
        // 栽培详情
        cultivation_details: safeExtractText($, '#ContentPlaceHolder1_txtCultivationDetails'),
        
        // 植物繁殖
        propagation: safeExtractText($, '#ContentPlaceHolder1_txtPropagation'),
        
        // 其他名称
        other_names: safeExtractText($, '#ContentPlaceHolder1_lblOtherNameText'),
        
        // 原生范围
        native_range: safeExtractText($, '#ContentPlaceHolder1_lblFoundInText'),
        
        // 杂草潜力文本
        weed_potential_text: safeExtractText($, '#ContentPlaceHolder1_lblWeedPotentialText'),
        
        // 保护状态
        conservation_status: safeExtractText($, '#ContentPlaceHolder1_lblConservationStatus'),
        
        // 相关植物
        related_plants: extractRelatedPlants($),
        
        // 图片信息
        images: extractImages($),
        
        // 护理图标
        care_icons: extractCareIcons($),
        
        // 元数据
        meta_description: safeExtractAttr($, 'meta[name="description"]', 'content'),
        page_title: safeExtractText($, 'title')
    };
    
    return plantData;
}

// 保存植物详情到数据库
async function savePlantDetailsToDB(client, plantDetails) {
    try {
        const query = `
            INSERT INTO plant_details (
                latin_name, common_name, family, usda_hardiness, known_hazards, habitats, 
                range, edibility_rating, other_uses_rating, weed_potential, medicinal_rating,
                physical_characteristics, synonyms, plant_habitats, edible_uses, medicinal_uses,
                other_uses, special_uses, cultivation_details, propagation, other_names,
                native_range, weed_potential_text, conservation_status, meta_description,
                page_title, related_plants, images, care_icons
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
                $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29
            )
            ON CONFLICT (latin_name) DO UPDATE SET
                common_name = EXCLUDED.common_name,
                family = EXCLUDED.family,
                usda_hardiness = EXCLUDED.usda_hardiness,
                known_hazards = EXCLUDED.known_hazards,
                habitats = EXCLUDED.habitats,
                range = EXCLUDED.range,
                edibility_rating = EXCLUDED.edibility_rating,
                other_uses_rating = EXCLUDED.other_uses_rating,
                weed_potential = EXCLUDED.weed_potential,
                medicinal_rating = EXCLUDED.medicinal_rating,
                physical_characteristics = EXCLUDED.physical_characteristics,
                synonyms = EXCLUDED.synonyms,
                plant_habitats = EXCLUDED.plant_habitats,
                edible_uses = EXCLUDED.edible_uses,
                medicinal_uses = EXCLUDED.medicinal_uses,
                other_uses = EXCLUDED.other_uses,
                special_uses = EXCLUDED.special_uses,
                cultivation_details = EXCLUDED.cultivation_details,
                propagation = EXCLUDED.propagation,
                other_names = EXCLUDED.other_names,
                native_range = EXCLUDED.native_range,
                weed_potential_text = EXCLUDED.weed_potential_text,
                conservation_status = EXCLUDED.conservation_status,
                meta_description = EXCLUDED.meta_description,
                page_title = EXCLUDED.page_title,
                related_plants = EXCLUDED.related_plants,
                images = EXCLUDED.images,
                care_icons = EXCLUDED.care_icons,
                updated_at = NOW()
        `;
        
        const values = [
            plantDetails.latin_name,
            plantDetails.common_name,
            plantDetails.family,
            plantDetails.usda_hardiness,
            plantDetails.known_hazards,
            plantDetails.habitats,
            plantDetails.range,
            plantDetails.edibility_rating,
            plantDetails.other_uses_rating,
            plantDetails.weed_potential,
            plantDetails.medicinal_rating,
            plantDetails.physical_characteristics,
            plantDetails.synonyms,
            plantDetails.plant_habitats,
            plantDetails.edible_uses,
            plantDetails.medicinal_uses,
            plantDetails.other_uses,
            plantDetails.special_uses,
            plantDetails.cultivation_details,
            plantDetails.propagation,
            plantDetails.other_names,
            plantDetails.native_range,
            plantDetails.weed_potential_text,
            plantDetails.conservation_status,
            plantDetails.meta_description,
            plantDetails.page_title,
            JSON.stringify(plantDetails.related_plants),
            JSON.stringify(plantDetails.images),
            JSON.stringify(plantDetails.care_icons)
        ];
        
        await client.query(query, values);
        console.log(`✅ 植物详情已保存到数据库: ${plantDetails.latin_name}`);
        return true;
    } catch (error) {
        console.error(`❌ 保存植物详情失败: ${error.message}`);
        return false;
    }
}

// 主函数
async function main() {
    const client = initPostgresClient();
    
    try {
        console.log('开始提取植物详情并保存到数据库...\n');
        
        // 测试数据库连接
        await client.connect();
        const result = await client.query('SELECT NOW() as current_time');
        console.log('数据库连接测试成功！当前时间:', result.rows[0].current_time);
        
        // 读取HTML文件
        const htmlContent = readFileSync('./plant-html.html', 'utf8');
        
        // 提取植物详情
        console.log('正在提取植物详情...');
        const plantDetails = extractPlantDetails(htmlContent);
        
        console.log(`提取的字段数量: ${Object.keys(plantDetails).length}`);
        console.log(`相关植物数量: ${plantDetails.related_plants.length}`);
        console.log(`图片数量: ${plantDetails.images.length}`);
        
        // 保存到数据库
        console.log('\n正在保存到数据库...');
        const saved = await savePlantDetailsToDB(client, plantDetails);
        
        if (saved) {
            console.log('\n=== 植物详情保存完成 ===');
            console.log(`拉丁名: ${plantDetails.latin_name}`);
            console.log(`俗名: ${plantDetails.common_name}`);
            console.log(`科名: ${plantDetails.family}`);
            console.log(`食用评级: ${plantDetails.edibility_rating}`);
            console.log(`药用评级: ${plantDetails.medicinal_rating}`);
        }
        
    } catch (error) {
        console.error('程序执行过程中出现错误:', error);
    } finally {
        await client.end();
        console.log('\n数据库连接已关闭');
    }
}

// 运行主函数
main();