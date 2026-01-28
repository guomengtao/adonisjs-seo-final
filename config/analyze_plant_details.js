import { Client } from 'pg';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { config } from 'dotenv';
import * as cheerio from 'cheerio';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 加载环境变量
config({ path: `${__dirname}/../.env` });

// 初始化PostgreSQL客户端
function initPostgresClient() {
    const connectionString = `postgresql://${process.env.PG_USER}:${process.env.PG_PASSWORD}@${process.env.PG_HOST}:${process.env.PG_PORT}/${process.env.PG_DB_NAME}?sslmode=no-verify`;
    
    console.log('正在初始化PostgreSQL客户端...');
    console.log(`连接URL: postgresql://${process.env.PG_USER}:***@${process.env.PG_HOST}:${process.env.PG_PORT}/${process.env.PG_DB_NAME}?sslmode=no-verify`);
    
    return new Client({
        connectionString: connectionString,
        ssl: {
            rejectUnauthorized: false // 完全忽略SSL证书验证
        }
    });
}

// 检查数据库连接
async function testDatabaseConnection(client) {
    try {
        console.log('正在测试数据库连接...');
        await client.connect();
        const result = await client.query('SELECT NOW() as current_time');
        console.log('数据库连接测试成功！当前时间:', result.rows[0].current_time);
        return true;
    } catch (error) {
        console.error('数据库连接测试失败:', error);
        return false;
    }
}

// 获取一条待分析的记录（已抓取HTML但未分析）
async function getPendingAnalysisRecord(client) {
    try {
        // 先检查表是否有analysis_status字段
        const checkQuery = `
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'raw_plants' 
            AND column_name = 'analysis_status'
        `;
        
        const checkResult = await client.query(checkQuery);
        
        if (checkResult.rows.length === 0) {
            console.log('analysis_status字段不存在，使用旧版查询');
            // 使用旧版查询（没有analysis_status字段）
            const oldQuery = `
                SELECT id, latin_name, raw_html, common_name
                FROM raw_plants 
                WHERE status = 'completed' 
                AND raw_html IS NOT NULL
                AND raw_html != ''
                ORDER BY id ASC 
                LIMIT 1
                FOR UPDATE SKIP LOCKED
            `;
            
            const result = await client.query(oldQuery);
            
            if (result.rows.length === 0) {
                console.log('没有找到待分析的记录');
                return null;
            }
            
            return result.rows[0];
        } else {
            // 使用新版查询（有analysis_status字段）
            const newQuery = `
                SELECT id, latin_name, raw_html, common_name
                FROM raw_plants 
                WHERE status = 'completed' 
                AND analysis_status IS NULL
                AND raw_html IS NOT NULL
                AND raw_html != ''
                ORDER BY id ASC 
                LIMIT 1
                FOR UPDATE SKIP LOCKED
            `;
            
            const result = await client.query(newQuery);
            
            if (result.rows.length === 0) {
                console.log('没有找到待分析的记录');
                return null;
            }
            
            return result.rows[0];
        }
    } catch (error) {
        console.error('获取待分析记录失败:', error);
        return null;
    }
}

// 更新记录状态为分析中
async function updateStatusToAnalyzing(client, recordId) {
    try {
        // 先检查表是否有analysis_status字段
        const checkQuery = `
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'raw_plants' 
            AND column_name = 'analysis_status'
        `;
        
        const checkResult = await client.query(checkQuery);
        
        if (checkResult.rows.length === 0) {
            console.log('analysis_status字段不存在，跳过状态更新');
            return true;
        } else {
            const query = `
                UPDATE raw_plants 
                SET analysis_status = 'analyzing', 
                    analysis_started_at = NOW(),
                    updated_at = NOW() 
                WHERE id = $1
            `;
            
            await client.query(query, [recordId]);
            console.log(`记录 ${recordId} 分析状态已更新为 analyzing`);
            return true;
        }
    } catch (error) {
        console.error(`更新记录 ${recordId} 分析状态失败:`, error);
        return false;
    }
}

// 安全提取文本内容
function safeExtractText($, selector) {
    try {
        const element = $(selector);
        return element.text()?.trim() || null;
    } catch (error) {
        return null;
    }
}

// 针对PFAF网站的特殊提取函数
function extractPFAFText($, label) {
    try {
        // 查找包含标签的b元素
        const labelElement = $(`b:contains("${label}")`);
        
        if (labelElement.length > 0) {
            // 找到包含b元素的tr行
            const row = labelElement.closest('tr');
            if (row.length > 0) {
                // 在tr中查找包含值的td（通常是第二个td）
                const valueTds = row.find('td').slice(1); // 跳过第一个td（包含标签）
                
                for (let i = 0; i < valueTds.length; i++) {
                    const valueTd = $(valueTds[i]);
                    const text = valueTd.text()?.trim();
                    
                    // 检查是否包含有效文本（不是空字符串且不是标签本身）
                    if (text && text !== label) {
                        return text;
                    }
                }
            }
            
            // 备用方法：如果表格结构不标准，尝试直接查找相邻的span元素
            const spanElement = labelElement.closest('td').next('td').find('span');
            if (spanElement.length > 0) {
                const text = spanElement.text()?.trim();
                if (text) return text;
            }
        }
        
        return null;
    } catch (error) {
        return null;
    }
}

// 安全提取属性值
function safeExtractAttr($, selector, attr) {
    try {
        const element = $(selector);
        return element.attr(attr)?.trim() || null;
    } catch (error) {
        return null;
    }
}

// 提取相关植物信息
function extractRelatedPlants($) {
    const relatedPlants = [];
    
    try {
        $('.related-plants .plant-item').each((index, element) => {
            const plant = {
                latin_name: safeExtractText($(element), '.latin-name'),
                common_name: safeExtractText($(element), '.common-name'),
                family: safeExtractText($(element), '.family'),
                edibility_rating: safeExtractText($(element), '.edibility-rating'),
                medicinal_rating: safeExtractText($(element), '.medicinal-rating'),
                usda_hardiness: safeExtractText($(element), '.usda-hardiness'),
                habitats: safeExtractText($(element), '.habitats'),
                range: safeExtractText($(element), '.range'),
                known_hazards: safeExtractText($(element), '.known-hazards'),
                weed_potential: safeExtractText($(element), '.weed-potential'),
                physical_characteristics: safeExtractText($(element), '.physical-characteristics'),
                image_url: safeExtractAttr($(element), '.plant-image', 'src')
            };
            
            // 过滤掉所有属性都为null的对象
            const hasValidData = Object.values(plant).some(value => value !== null);
            if (hasValidData) {
                relatedPlants.push(plant);
            }
        });
    } catch (error) {
        console.error('提取相关植物信息失败:', error);
    }
    
    return relatedPlants;
}

// 提取图片信息
function extractImages($) {
    const images = [];
    
    try {
        $('.plant-images img').each((index, element) => {
            const image = {
                url: $(element).attr('src')?.trim() || null,
                alt: $(element).attr('alt')?.trim() || null,
                title: $(element).attr('title')?.trim() || null,
                caption: $(element).closest('.image-container').find('.caption').text()?.trim() || null
            };
            
            // 过滤掉所有属性都为null的对象
            const hasValidData = Object.values(image).some(value => value !== null);
            if (hasValidData) {
                images.push(image);
            }
        });
    } catch (error) {
        console.error('提取图片信息失败:', error);
    }
    
    return images;
}

// 提取护理图标信息
function extractCareIcons($) {
    const careIcons = [];
    
    try {
        $('.care-icons .icon').each((index, element) => {
            const icon = {
                type: $(element).attr('data-type')?.trim() || null,
                level: $(element).attr('data-level')?.trim() || null,
                description: $(element).attr('title')?.trim() || null
            };
            
            // 过滤掉所有属性都为null的对象
            const hasValidData = Object.values(icon).some(value => value !== null);
            if (hasValidData) {
                careIcons.push(icon);
            }
        });
    } catch (error) {
        console.error('提取护理图标信息失败:', error);
    }
    
    return careIcons;
}

// 调试HTML结构
function debugHtmlStructure(html, latinName) {
    const $ = cheerio.load(html);
    
    console.log('=== HTML结构调试开始 ===');
    console.log('目标拉丁名:', latinName);
    console.log('HTML长度:', html.length);
    
    // 检查是否包含拉丁名
    const hasLatinName = html.includes(latinName);
    console.log('HTML是否包含拉丁名:', hasLatinName);
    
    // 检查常见的选择器
    const selectors = ['h1', 'h2', 'h3', 'title', '.latin-name', '.scientific-name', '.plant-name', 'strong', 'b'];
    
    for (const selector of selectors) {
        const elements = $(selector);
        if (elements.length > 0) {
            console.log(`选择器 "${selector}" 找到 ${elements.length} 个元素:`);
            elements.each((index, element) => {
                if (index < 3) { // 只显示前3个
                    const text = $(element).text()?.trim();
                    if (text && text.length > 0) {
                        console.log(`  [${index}] ${text.substring(0, 100)}`);
                    }
                }
            });
        }
    }
    
    // 查找包含特定标签的文本内容
    const labels = ['Common Name', 'Family', 'USDA hardiness', 'Known Hazards', 'Habitats', 'Range'];
    
    console.log('\\n=== 检查PFAF标签结构 ===');
    for (const label of labels) {
        // 尝试多种选择器
        const bElements = $(`b:contains("${label}")`);
        const strongElements = $(`strong:contains("${label}")`);
        const spanElements = $(`span:contains("${label}")`);
        
        console.log(`标签 "${label}":`);
        console.log(`  b元素: ${bElements.length} 个`);
        console.log(`  strong元素: ${strongElements.length} 个`);
        console.log(`  span元素: ${spanElements.length} 个`);
        
        // 检查b元素的结构
        if (bElements.length > 0) {
            bElements.each((index, element) => {
                if (index < 1) { // 只显示第一个
                    const html = $(element).html();
                    const text = $(element).text()?.trim();
                    const parentHtml = $(element).parent().html()?.substring(0, 300);
                    const parentText = $(element).parent().text()?.trim();
                    
                    // 查看父元素的父元素（更大的容器）
                    const grandParentHtml = $(element).parent().parent().html()?.substring(0, 500);
                    const grandParentText = $(element).parent().parent().text()?.trim();
                    
                    console.log(`  b元素HTML: ${html}`);
                    console.log(`  b元素文本: ${text}`);
                    console.log(`  父元素HTML: ${parentHtml}`);
                    console.log(`  父元素文本: ${parentText}`);
                    console.log(`  祖父元素HTML: ${grandParentHtml}`);
                    console.log(`  祖父元素文本: ${grandParentText}`);
                }
            });
        }
    }
    
    // 检查整个Summary部分的HTML结构
    console.log('\\n=== 检查Summary部分结构 ===');
    const summarySection = $('#summary');
    if (summarySection.length > 0) {
        console.log('找到Summary部分，HTML长度:', summarySection.html()?.length);
        console.log('Summary文本前500字符:', summarySection.text()?.substring(0, 500));
    } else {
        console.log('未找到Summary部分');
    }
    
    // 检查其他可能包含植物详情的部分
    console.log('\\n=== 检查其他详情部分 ===');
    const sections = ['#physical_characteristics', '#edible_uses', '#medicinal_uses', '#other_uses', '#cultivation_details', '#propagation'];
    for (const section of sections) {
        const element = $(section);
        if (element.length > 0) {
            console.log(`找到${section}部分，HTML长度:`, element.html()?.length);
            console.log(`${section}文本前200字符:`, element.text()?.substring(0, 200));
        } else {
            console.log(`未找到${section}部分`);
        }
    }
    
    // 查找包含拉丁名的元素
    const latinElements = $('*:contains("' + latinName + '")');
    console.log(`\\n包含拉丁名 "${latinName}" 的元素数量:`, latinElements.length);
    
    if (latinElements.length > 0) {
        latinElements.each((index, element) => {
            if (index < 3) {
                const tagName = element.tagName;
                const className = $(element).attr('class') || '';
                const text = $(element).text()?.trim();
                console.log(`  [${index}] <${tagName} class="${className}"> ${text?.substring(0, 100)}`);
            }
        });
    }
    
    console.log('=== HTML结构调试结束 ===');
}

// 提取植物详细信息
function extractPlantDetails(html, latinName) {
    const $ = cheerio.load(html);
    
    // 调试HTML结构
    debugHtmlStructure(html, latinName);
    
    const plantDetails = {
        // 基本信息
        latin_name: latinName, // 直接使用已知的拉丁名
        common_name: extractPFAFText($, 'Common Name'),
        family: extractPFAFText($, 'Family'),
        usda_hardiness: extractPFAFText($, 'USDA hardiness'),
        known_hazards: extractPFAFText($, 'Known Hazards'),
        habitats: extractPFAFText($, 'Habitats'),
        range: extractPFAFText($, 'Range'),
        height: extractPFAFText($, 'Height') || extractPFAFText($, 'Height '), // 有些标签可能有空格
        width: extractPFAFText($, 'Width') || extractPFAFText($, 'Width '),
        growth_rate: extractPFAFText($, 'Growth rate') || extractPFAFText($, 'Growth Rate'),
        growth_speed: extractPFAFText($, 'Growth'),
        edibility_rating: extractPFAFText($, 'Edibility Rating') || extractPFAFText($, 'Edibility'),
        other_uses_rating: extractPFAFText($, 'Other Uses Rating') || extractPFAFText($, 'Other Uses'),
        weed_potential: extractPFAFText($, 'Weed Potential'),
        medicinal_rating: extractPFAFText($, 'Medicinal Rating') || extractPFAFText($, 'Medicinal'),
        physical_characteristics: safeExtractText($, '#physical_characteristics p'),
        
        // 从h2标题中提取Synonyms
        synonyms: (() => {
            try {
                const synonymsElement = $('h2:contains("Synonyms")').next('p');
                return synonymsElement.text()?.trim() || null;
            } catch (error) {
                return null;
            }
        })(),
        
        plant_habitats: extractPFAFText($, 'Plant Habitats'),
        
        // 详细描述 - 从对应的h2标题后提取
        edible_uses: safeExtractText($, '#edible_uses p'),
        medicinal_uses: safeExtractText($, '#medicinal_uses p'),
        other_uses: safeExtractText($, '#other_uses p'),
        special_uses: safeExtractText($, '#special_uses p'),
        cultivation_details: safeExtractText($, '#cultivation_details p'),
        propagation: safeExtractText($, '#propagation p'),
        
        // 其他信息
        other_names: extractPFAFText($, 'Other Names'),
        native_range: extractPFAFText($, 'Native Range'),
        weed_potential_text: extractPFAFText($, 'Weed Potential Text'),
        conservation_status: extractPFAFText($, 'Conservation Status'),
        pollinators: extractPFAFText($, 'Pollinators'),
        
        // 元数据
        meta_description: safeExtractText($, 'meta[name="description"]'),
        page_title: safeExtractText($, 'title'),
        description: safeExtractText($, '#description'),
        soil_preferences: extractPFAFText($, 'Soil'),
        light_preferences: extractPFAFText($, 'Light'),
        moisture_preferences: extractPFAFText($, 'Moisture'),
        ph_preferences: extractPFAFText($, 'pH'),
        wind_tolerance: extractPFAFText($, 'Wind'),
        
        // 相关植物
        related_plants: extractRelatedPlants($),
        
        // 图片信息
        images: extractImages($),
        
        // 护理图标
        care_icons: extractCareIcons($)
    };
    
    return plantDetails;
}

// 保存植物详情到数据库
async function savePlantDetailsToDB(client, plantDetails) {
    try {
        const query = `
            INSERT INTO plant_details (
                latin_name, common_name, family, usda_hardiness, known_hazards, 
                habitats, range, edibility_rating, other_uses_rating, weed_potential, 
                medicinal_rating, physical_characteristics, synonyms, plant_habitats,
                edible_uses, medicinal_uses, other_uses, special_uses, cultivation_details, propagation,
                other_names, native_range, weed_potential_text, conservation_status,
                meta_description, page_title, related_plants, images, care_icons
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
                $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29
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
            plantDetails.latin_name, plantDetails.common_name, plantDetails.family, 
            plantDetails.usda_hardiness, plantDetails.known_hazards, plantDetails.habitats,
            plantDetails.range, plantDetails.edibility_rating, plantDetails.other_uses_rating,
            plantDetails.weed_potential, plantDetails.medicinal_rating, plantDetails.physical_characteristics,
            plantDetails.synonyms, plantDetails.plant_habitats, plantDetails.edible_uses,
            plantDetails.medicinal_uses, plantDetails.other_uses, plantDetails.special_uses,
            plantDetails.cultivation_details, plantDetails.propagation, plantDetails.other_names,
            plantDetails.native_range, plantDetails.weed_potential_text, plantDetails.conservation_status,
            plantDetails.meta_description, plantDetails.page_title, 
            plantDetails.related_plants.length > 0 ? JSON.stringify(plantDetails.related_plants) : null,
            plantDetails.images.length > 0 ? JSON.stringify(plantDetails.images) : null,
            plantDetails.care_icons.length > 0 ? JSON.stringify(plantDetails.care_icons) : null
        ];
        
        await client.query(query, values);
        console.log(`✅ 植物详情已保存到数据库: ${plantDetails.latin_name}`);
        return true;
    } catch (error) {
        console.error('保存植物详情到数据库失败:', error);
        return false;
    }
}

// 计算分析结果统计
function calculateAnalysisResult(plantDetails) {
    const result = {
        total_fields: 29, // 总字段数
        extracted_fields: 0,
        related_plants_count: plantDetails.related_plants.length,
        images_count: plantDetails.images.length,
        care_icons_count: plantDetails.care_icons.length
    };
    
    // 计算已提取的字段数
    const fields = Object.keys(plantDetails);
    result.extracted_fields = fields.filter(field => {
        const value = plantDetails[field];
        if (Array.isArray(value)) {
            return value.length > 0;
        }
        return value !== null && value !== undefined && value !== '';
    }).length;
    
    return result;
}

// 更新记录分析状态为完成
async function updateAnalysisStatusToCompleted(client, recordId, analysisResult) {
    try {
        // 先检查表是否有analysis_status字段
        const checkQuery = `
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'raw_plants' 
            AND column_name = 'analysis_status'
        `;
        
        const checkResult = await client.query(checkQuery);
        
        if (checkResult.rows.length === 0) {
            console.log('analysis_status字段不存在，跳过状态更新');
            return true;
        } else {
            const query = `
                UPDATE raw_plants 
                SET analysis_status = 'completed', 
                    analysis_completed_at = NOW(),
                    analysis_result = $1,
                    updated_at = NOW() 
                WHERE id = $2
            `;
            
            await client.query(query, [JSON.stringify(analysisResult), recordId]);
            console.log(`记录 ${recordId} 分析状态已更新为 completed`);
            return true;
        }
    } catch (error) {
        console.error(`更新记录 ${recordId} 分析状态失败:`, error);
        return false;
    }
}

// 更新记录分析状态为失败
async function updateAnalysisStatusToFailed(client, recordId, errorMessage) {
    try {
        // 先检查表是否有analysis_status字段
        const checkQuery = `
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'raw_plants' 
            AND column_name = 'analysis_status'
        `;
        
        const checkResult = await client.query(checkQuery);
        
        if (checkResult.rows.length === 0) {
            console.log('analysis_status字段不存在，跳过状态更新');
            return true;
        } else {
            const query = `
                UPDATE raw_plants 
                SET analysis_status = 'failed', 
                    analysis_error_log = $1,
                    updated_at = NOW() 
                WHERE id = $2
            `;
            
            await client.query(query, [errorMessage, recordId]);
            console.log(`记录 ${recordId} 分析状态已更新为 failed`);
            return true;
        }
    } catch (error) {
        console.error(`更新记录 ${recordId} 分析状态失败:`, error);
        return false;
    }
}

// 获取分析统计信息
async function getAnalysisStatistics(client) {
    try {
        // 先检查表是否有analysis_status字段
        const checkQuery = `
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'raw_plants' 
            AND column_name = 'analysis_status'
        `;
        
        const checkResult = await client.query(checkQuery);
        
        if (checkResult.rows.length === 0) {
            console.log('analysis_status字段不存在，跳过分析统计');
            return [];
        } else {
            const query = `
                SELECT 
                    analysis_status,
                    COUNT(*) as count
                FROM raw_plants 
                WHERE raw_html IS NOT NULL
                AND raw_html != ''
                GROUP BY analysis_status
            `;
            
            const result = await client.query(query);
            
            console.log('\n=== 分析统计信息 ===');
            result.rows.forEach(row => {
                console.log(`${row.analysis_status || '未分析'}: ${row.count} 条记录`);
            });
            
            return result.rows;
        }
    } catch (error) {
        console.error('获取分析统计信息失败:', error);
        return [];
    }
}

// 单次分析函数
async function analyzeSinglePlantDetail() {
    const client = initPostgresClient();
    
    try {
        console.log('开始单次分析植物详情...\n');
        
        // 测试数据库连接
        const isConnected = await testDatabaseConnection(client);
        if (!isConnected) {
            console.error('无法连接到数据库，程序退出');
            return;
        }
        
        // 显示初始分析统计信息
        await getAnalysisStatistics(client);
        
        console.log('\n--- 开始处理一条待分析记录 ---');
        
        // 获取一条待分析的记录
        const record = await getPendingAnalysisRecord(client);
        
        if (!record) {
            console.log('没有待分析的记录，任务结束');
            return;
        }
        
        console.log(`分析记录: ID=${record.id}, 拉丁名=${record.latin_name}`);
        
        // 更新状态为分析中
        const statusUpdated = await updateStatusToAnalyzing(client, record.id);
        if (!statusUpdated) {
            console.log('状态更新失败，任务结束');
            return;
        }
        
        try {
            // 提取植物详情
        console.log('正在提取植物详情...');
        const plantDetails = extractPlantDetails(record.raw_html, record.latin_name);
        
        console.log(`提取的字段数量: ${Object.keys(plantDetails).length}`);
        console.log(`相关植物数量: ${plantDetails.related_plants.length}`);
        console.log(`图片数量: ${plantDetails.images.length}`);
            
            // 保存到植物详情表
            console.log('正在保存到数据库...');
            const saved = await savePlantDetailsToDB(client, plantDetails);
            
            if (saved) {
                // 计算分析结果
                const analysisResult = calculateAnalysisResult(plantDetails);
                
                // 更新分析状态为完成
                const analysisUpdated = await updateAnalysisStatusToCompleted(client, record.id, analysisResult);
                
                if (analysisUpdated) {
                    console.log(`✅ 记录 ${record.id} 分析成功`);
                    console.log('分析结果统计:');
                    console.log(`- 总字段数: ${analysisResult.total_fields}`);
                    console.log(`- 已提取字段数: ${analysisResult.extracted_fields}`);
                    console.log(`- 相关植物数: ${analysisResult.related_plants_count}`);
                    console.log(`- 图片数: ${analysisResult.images_count}`);
                    console.log(`- 护理图标数: ${analysisResult.care_icons_count}`);
                }
            }
            
        } catch (error) {
            // 更新为分析失败状态
            const errorMessage = error.message || '未知错误';
            const failureUpdated = await updateAnalysisStatusToFailed(client, record.id, errorMessage);
            if (failureUpdated) {
                console.log(`❌ 记录 ${record.id} 分析失败: ${errorMessage}`);
            }
        }
        
        // 显示最终统计信息
        console.log('\n=== 单次分析任务完成 ===');
        await getAnalysisStatistics(client);
        
    } catch (error) {
        console.error('程序执行过程中出现错误:', error);
    } finally {
        await client.end();
        console.log('\n数据库连接已关闭');
    }
}

// 运行主函数
analyzeSinglePlantDetail();