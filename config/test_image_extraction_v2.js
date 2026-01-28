import * as cheerio from 'cheerio';
import * as fs from 'fs';

// 读取本地HTML文件
const htmlContent = fs.readFileSync('./plant-html.html', 'utf8');

// 定义更新后的图片提取函数
function extractImages($) {
    const images = {
        main: [],       // 主要植物图片（来自特定表格）
        additional: []  // 其他相关图片
    };
    
    // 定义常见图标和非植物图片的模式
    const nonPlantImagePatterns = [
        'icon', 'rating', 'spacer', 'placeholder', 'loading', 'searchV1b',
        'advert', 'book', 'gif', 'water2.jpg', 'water3.jpg', 'sun.jpg'
    ];
    
    try {
        // 辅助函数：判断是否为非植物图片
        function isNonPlantImage(src) {
            if (!src) return true;
            const lowerSrc = src.toLowerCase();
            return nonPlantImagePatterns.some(pattern => lowerSrc.includes(pattern));
        }
        
        // 辅助函数：标准化图片URL
        function normalizeImageUrl(url, baseUrl) {
            if (!url) return null;
            
            if (url.startsWith('http')) {
                return url;
            } else if (url.startsWith('../')) {
                return baseUrl + url.substring(2);
            } else if (url.startsWith('/')) {
                return baseUrl + url;
            } else {
                return baseUrl + '/' + url;
            }
        }
        
        // 1. 优先提取主要植物图片（从特定表格中）
        $('#ContentPlaceHolder1_tblPlantImges img').each((index, element) => {
            const img = $(element);
            const src = img.attr('src')?.trim();
            
            // 检查是否为有效图片
            if (src && !isNonPlantImage(src)) {
                const image = {
                    url: src,
                    alt: img.attr('alt')?.trim() || null,
                    title: img.attr('title')?.trim() || null,
                    width: img.attr('width')?.trim() || null,
                    height: img.attr('height')?.trim() || null,
                    source: 'main_table'  // 标记来源
                };
                
                images.main.push(image);
            }
        });
        
        // 2. 提取其他表格中的植物图片
        $('table td[valign="top"][align="center"] img').each((index, element) => {
            const img = $(element);
            const src = img.attr('src')?.trim();
            
            if (src && !isNonPlantImage(src)) {
                const image = {
                    url: src,
                    alt: img.attr('alt')?.trim() || null,
                    title: img.attr('title')?.trim() || null,
                    width: img.attr('width')?.trim() || null,
                    height: img.attr('height')?.trim() || null,
                    source: 'other_table'
                };
                
                // 确保不与主要图片重复
                const isDuplicate = images.main.some(existing => existing.url === image.url);
                if (!isDuplicate) {
                    images.additional.push(image);
                }
            }
        });
        
        // 3. 过滤和处理图片URL（标准化相对路径）
        const baseUrl = 'https://pfaf.org';
        
        // 处理主要图片
        images.main = images.main.map(image => ({
            ...image,
            url: normalizeImageUrl(image.url, baseUrl)
        }));
        
        // 处理附加图片
        images.additional = images.additional.map(image => ({
            ...image,
            url: normalizeImageUrl(image.url, baseUrl)
        }));
        
        // 4. 合并所有图片，优先显示主要图片
        const allImages = [...images.main, ...images.additional];
        
        console.log(`图片提取完成：${images.main.length}张主要植物图片，${images.additional.length}张附加图片`);
        
        return allImages;
        
    } catch (error) {
        console.error('提取图片信息失败:', error);
        return [];
    }
}

// 加载HTML并测试图片提取
const $ = cheerio.load(htmlContent);
const extractedImages = extractImages($);

// 输出结果
console.log('\n=== 提取到的植物图片结果 ===');
console.log(`总共提取到 ${extractedImages.length} 张植物图片`);

if (extractedImages.length > 0) {
    console.log('\n详细图片信息:');
    extractedImages.forEach((image, index) => {
        console.log(`\n图片 ${index + 1}:`);
        console.log(`  URL: ${image.url}`);
        console.log(`  Alt: ${image.alt}`);
        console.log(`  Title: ${image.title}`);
        console.log(`  Width: ${image.width}`);
        console.log(`  Height: ${image.height}`);
        console.log(`  Source: ${image.source}`);
    });
} else {
    console.log('没有提取到植物图片');
}