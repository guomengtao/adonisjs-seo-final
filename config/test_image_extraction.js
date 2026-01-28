import * as cheerio from 'cheerio';
import * as fs from 'fs';

// 读取本地HTML文件
const htmlContent = fs.readFileSync('./plant-html.html', 'utf8');

// 定义图片提取函数
function extractImages($) {
    const images = [];
    
    try {
        // 1. 提取主要植物图片（从特定的表格中）
        $('#ContentPlaceHolder1_tblPlantImges img').each((index, element) => {
            const img = $(element);
            const image = {
                url: img.attr('src')?.trim() || null,
                alt: img.attr('alt')?.trim() || null,
                title: img.attr('title')?.trim() || null,
                width: img.attr('width')?.trim() || null,
                height: img.attr('height')?.trim() || null
            };
            
            // 过滤掉所有属性都为null的对象
            const hasValidData = Object.values(image).some(value => value !== null);
            if (hasValidData) {
                images.push(image);
            }
        });
        
        // 2. 提取通用植物图片（考虑其他可能的选择器）
        $('.plant-images img').each((index, element) => {
            const img = $(element);
            const image = {
                url: img.attr('src')?.trim() || null,
                alt: img.attr('alt')?.trim() || null,
                title: img.attr('title')?.trim() || null,
                caption: img.closest('.image-container').find('.caption').text()?.trim() || null
            };
            
            // 过滤掉所有属性都为null的对象，并且确保不重复添加
            const hasValidData = Object.values(image).some(value => value !== null);
            if (hasValidData) {
                const isDuplicate = images.some(existing => existing.url === image.url);
                if (!isDuplicate) {
                    images.push(image);
                }
            }
        });
        
        // 3. 提取页面中所有有意义的图片（作为补充）
        $('img:not([src*="placeholder"]):not([src*="spacer"]):not([src*="loading"])').each((index, element) => {
            const img = $(element);
            const image = {
                url: img.attr('src')?.trim() || null,
                alt: img.attr('alt')?.trim() || null,
                title: img.attr('title')?.trim() || null,
                width: img.attr('width')?.trim() || null,
                height: img.attr('height')?.trim() || null
            };
            
            // 过滤条件：有有效的图片URL且不为空
            if (image.url && image.url.length > 5) {
                // 确保不重复添加
                const isDuplicate = images.some(existing => existing.url === image.url);
                if (!isDuplicate) {
                    images.push(image);
                }
            }
        });
        
        // 4. 标准化图片URL（处理相对路径）
        const baseUrl = 'https://pfaf.org';
        images.forEach(image => {
            if (image.url && !image.url.startsWith('http')) {
                if (image.url.startsWith('../')) {
                    image.url = baseUrl + image.url.substring(2);
                } else if (image.url.startsWith('/')) {
                    image.url = baseUrl + image.url;
                } else {
                    image.url = baseUrl + '/' + image.url;
                }
            }
        });
        
    } catch (error) {
        console.error('提取图片信息失败:', error);
    }
    
    return images;
}

// 加载HTML并测试图片提取
const $ = cheerio.load(htmlContent);
const extractedImages = extractImages($);

// 输出结果
console.log('提取到的图片数量:', extractedImages.length);
console.log('提取到的图片详情:');
extractedImages.forEach((image, index) => {
    console.log(`\n图片 ${index + 1}:`);
    console.log(`  URL: ${image.url}`);
    console.log(`  Alt: ${image.alt}`);
    console.log(`  Title: ${image.title}`);
    console.log(`  Width: ${image.width}`);
    console.log(`  Height: ${image.height}`);
    console.log(`  Caption: ${image.caption}`);
});