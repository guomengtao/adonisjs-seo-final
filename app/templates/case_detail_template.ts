// 案件详情模板数据接口
export interface CaseDetailTemplateData {
  caseData: {
    full_name: string;
    missing_since: string;
    [key: string]: any;
  };
  caseHtml: string;
  images: Array<{
    storage_path: string;
    [key: string]: any;
  }>;
  tags: Array<{
    name_en?: string;
    name: string;
    [key: string]: any;
  }>;
  urlPathSegments: string[];
  englishPathSegments: string[];
  imgBaseUrl: string;
  breadcrumbs: string;
  prevCase?: {
    id: string;
    full_name: string;
    path: string;
  };
  nextCase?: {
    id: string;
    full_name: string;
    path: string;
  };
}

export const generateCaseDetailHtml = (data: CaseDetailTemplateData): string => {
  const { caseData, caseHtml, images, tags, urlPathSegments, imgBaseUrl, breadcrumbs } = data;
  
  // 移除图片展示部分的HTML内容
  const cleanedCaseHtml = caseHtml.replace(/<div\s+id=["']photos["'][^>]*>[\s\S]*?<\/div>/g, '');
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${caseData.full_name} - Missing Person Case</title>
    <link href="/dist/localtailwind.css" rel="stylesheet">
    <style>
        strong { font-weight: bold; color: red; }
    </style>
</head>
<body class="bg-gray-50 font-sans text-gray-900">
    <!-- 头部 -->
    <header class="bg-white shadow-md">
        <div class="max-w-3xl mx-auto px-4 py-4 flex justify-between items-center">
            <div class="flex items-center space-x-2">
                <h1 class="text-2xl font-bold text-blue-600">Missing Persons Database</h1>
            </div>
            <nav>
                <ul class="flex space-x-4">
                    <li><a href="${urlPathSegments.length > 0 ? '../'.repeat(urlPathSegments.length) : ''}index.html" class="text-gray-600 hover:text-blue-600">Home</a></li>
                    <li><a href="${urlPathSegments.length > 0 ? '../'.repeat(urlPathSegments.length) : ''}search.html" class="text-gray-600 hover:text-blue-600">Search</a></li>
                </ul>
            </nav>
        </div>
    </header>
    
    <!-- 面包屑导航 -->
    <div class="bg-white border-b border-gray-200">
        <div class="max-w-3xl mx-auto px-4 py-2">
            ${breadcrumbs}
        </div>
    </div>
    
    <!-- 主要内容 -->
    <main class="py-8">
        <div class="max-w-3xl mx-auto px-4">
            <!-- 案件标题 -->
            <div class="mb-8">
                <h1 class="text-3xl font-bold mb-2">${caseData.full_name}</h1>
                <p class="text-gray-600">Missing since: ${new Date(caseData.missing_since).toLocaleDateString()}</p>
            </div>
            
            <!-- 图片展示 - 使用纯Tailwind CSS实现毛玻璃填充效果 -->
            ${images.length > 0 ? `
            <div class="mb-8">
                <h2 class="text-2xl font-bold mb-4">Photos</h2>
                
                <!-- 使用Tailwind CSS实现1+N比例强制逻辑 -->
                <div class="grid grid-cols-3 gap-1 p-2">
                    <!-- Hero Image - 首屏大图 (4:3比例) -->
                    <div class="col-span-3 aspect-[4/3] rounded-lg overflow-hidden relative">
                        <!-- 毛玻璃背景 -->
                        <div class="absolute inset-0 bg-cover bg-center blur-xl transform scale-105" 
                             style="background-image: url('${imgBaseUrl}/${images[0].storage_path}');"></div>
                        <!-- 主体图片 -->
                        <img src="${imgBaseUrl}/${images[0].storage_path}" 
                             alt="${caseData.full_name}" 
                             class="w-full h-full object-contain relative z-10">
                    </div>
                    
                    <!-- Thumbnail Grid - 缩略图池 (3列矩阵) -->
                    ${images.length > 1 ? images.slice(1).map(img => `
                    <div class="aspect-square rounded-md overflow-hidden relative">
                        <!-- 毛玻璃背景 -->
                        <div class="absolute inset-0 bg-cover bg-center blur-md transform scale-110" 
                             style="background-image: url('${imgBaseUrl}/${img.storage_path}');"></div>
                        <!-- 主体图片 -->
                        <img src="${imgBaseUrl}/${img.storage_path}" 
                             alt="${caseData.full_name}" 
                             class="w-full h-full object-contain relative z-10 hover:scale-105 transition-transform duration-300">
                    </div>
                    `).join('') : ''}
                </div>
            </div>
            ` : ''}
            
            <!-- 标签 -->
            ${tags.length > 0 ? `
            <div class="mb-8">
                <h2 class="text-2xl font-bold mb-4">Tags</h2>
                <div class="flex flex-wrap gap-2">
                    ${tags.map(tag => `
                    <span class="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">${tag.name_en || tag.name}</span>
                    `).join('')}
                </div>
            </div>
            ` : ''}
            
            <!-- 案件详情内容 -->
            <div class="bg-white rounded-lg shadow-md p-6">
                <h2 class="text-2xl font-bold mb-4 text-red-500">Case Details</h2>
                
                <!-- 优化后的案件详情内容 -->
                ${(() => {
                    let html = cleanedCaseHtml;
                    
                    // 1. 将所有h2标题加粗并设为红色
                    html = html.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '<h2 class="text-xl font-bold text-red-600 mt-8 mb-4">$1</h2>');
                    
                    // 2. 将所有h3标题加粗并设为红色
                    html = html.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '<h3 class="text-lg font-bold text-red-600 mt-6 mb-3">$1</h3>');
                    
                    // 3. 提取基本信息部分（如果有）
                    const basicInfoMatch = html.match(/<div[^>]*class="stat-item"[^>]*>[\s\S]*?<\/div>/g);
                    if (basicInfoMatch) {
                        let basicInfo = basicInfoMatch.join('');
                        // 将基本信息中的标签（如Sex、Race、Age、Missing Since）加粗并设为红色
                        basicInfo = basicInfo.replace(/<span class="stat-label">(.*?)<\/span>/g, (match: string, label: string) => {
                            // 检查标签是否包含需要高亮的关键词
                            const keywords: string[] = ['Sex', 'Race', 'Age', 'Missing Since', 'Missing From', 'Date of Birth', 'Height', 'Weight'];
                            let highlightedLabel: string = label;
                            
                            // 处理组合标签（如Sex/Race, Height/Weight）
                            if (label.includes('/')) {
                                const parts: string[] = label.split('/');
                                highlightedLabel = parts.map((part: string) => {
                                    const trimmedPart: string = part.trim();
                                    return keywords.some((keyword: string) => trimmedPart.includes(keyword)) 
                                        ? `<span class="font-bold text-red-600">${trimmedPart}</span>`
                                        : trimmedPart;
                                }).join('/');
                            } else {
                                // 处理单个标签
                                if (keywords.some((keyword: string) => label.includes(keyword))) {
                                    highlightedLabel = `<span class="font-bold text-red-600">${label}</span>`;
                                }
                            }
                            
                            return `<span class="stat-label">${highlightedLabel}</span>`;
                        });
                        html = html.replace(basicInfoMatch.join(''), `<div class="mb-8 p-4 bg-gray-50 rounded-lg"><h3 class="text-lg font-bold text-red-600 mb-4">Basic Information</h3><div class="grid grid-cols-2 gap-4">${basicInfo}</div></div>`);
                    }
                    
                    // 5. 将独立的Missing Since标题加粗并设为红色
                    html = html.replace(/<h2[^>]*>Missing Since[^<]*<\/h2>/gi, '<h2 class="text-xl font-bold text-red-600 mt-8 mb-4">Missing Since</h2>');
                    html = html.replace(/<h3[^>]*>Missing Since[^<]*<\/h3>/gi, '<h3 class="text-lg font-bold text-red-600 mt-6 mb-3">Missing Since</h3>');
                    
                    // 6. 将Details of Disappearance部分单独作为一个区块
                    html = html.replace(/(<h2[^>]*>Details of Disappearance<\/h2>[\s\S]*?)(?=<h2|$)/gi, '<div class="mb-8 p-4 bg-gray-50 rounded-lg">$1</div>');
                    
                    // 7. 将Investigating Agency和Source Information作为一个区域放在最后
                    const agencyAndSourcesMatch = html.match(/(<h3[^>]*>Investigating Agency<\/h3>[\s\S]*?)(<h3[^>]*>Sources<\/h3>[\s\S]*?)(?=<h2|$)/gi);
                    if (agencyAndSourcesMatch) {
                        const agencyAndSources = agencyAndSourcesMatch[0];
                        // 移除原来的部分
                        html = html.replace(agencyAndSources, '');
                        // 添加到最后
                        html += `<div class="mt-10 p-4 bg-gray-50 rounded-lg">${agencyAndSources}</div>`;
                    }
                    
                    // 8. 提取并格式化更新信息
                    const updateInfoMatch = html.match(/Updated\s+\d+\s+times since[\s\S]*?(?=<h2|$)/gi);
                    if (updateInfoMatch) {
                        const updateInfo = updateInfoMatch[0];
                        // 移除原来的部分
                        html = html.replace(updateInfo, '');
                        // 添加到最后作为独立区域
                        html += `<div class="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-gray-700">${updateInfo}</div>`;
                    }
                    
                    return html;
                })()}
            </div>
            
            <!-- 上一个/下一个案例链接 -->
            <div class="mt-8 flex justify-between">
                ${data.prevCase ? `
                <div class="flex-1 mr-4">
                    <a href="${data.prevCase.path}/${data.prevCase.id}.html" class="block p-4 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow">
                        <div class="text-sm text-gray-500 mb-1">Previous Case</div>
                        <div class="text-lg font-bold text-blue-600">${data.prevCase.full_name}</div>
                    </a>
                </div>
                ` : '<div class="flex-1 mr-4"></div>'}
                
                ${data.nextCase ? `
                <div class="flex-1 ml-4">
                    <a href="${data.nextCase.path}/${data.nextCase.id}.html" class="block p-4 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow text-right">
                        <div class="text-sm text-gray-500 mb-1">Next Case</div>
                        <div class="text-lg font-bold text-blue-600">${data.nextCase.full_name}</div>
                    </a>
                </div>
                ` : '<div class="flex-1 ml-4"></div>'}
            </div>
        </div>
    </main>
    
    <!-- 尾部 -->
    <footer class="bg-white shadow-inner mt-12 py-4">
        <div class="max-w-3xl mx-auto px-4 text-center text-gray-500">
            <p>© ${new Date().getFullYear()} Missing Persons Database. All rights reserved.</p>
        </div>
    </footer>
</body>
</html>`;
};