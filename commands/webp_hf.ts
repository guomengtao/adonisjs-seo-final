import { BaseCommand } from '@adonisjs/core/ace';
import db from '@adonisjs/lucid/services/db';
import HfService, { HfFile } from '#services/hf_service';
import axios from 'axios';
import { args } from '@adonisjs/core/ace';

export default class WebpHfUpload extends BaseCommand {
  static commandName = 'webp:hf';
  static description = '专门用于Hugging Face备份：从B2同步已处理的WebP图片到HF';
  static options = { startApp: true };

  // 使用装饰器定义参数
  @args.string({
    description: '测试模式：仅处理指定数量的图片',
    required: false
  })
  testLimit!: string; // 添加明确赋值断言

  async run() {
    this.logger.info('🚀 启动Hugging Face专门备份命令...');
    this.logger.info('💡 特性：批量上传 + 重试机制 + 错误恢复 + 进度跟踪');
    this.logger.info('💡 已替换B2调用为images.weserv.nl直接下载服务');
    
    // 配置参数
    const batchSize = 100;  // 增加批量大小到100
    const maxRetries = 3;  // 最大重试次数
    const retryDelay = 5000; // 重试延迟5秒
    
    // 获取测试限制参数
    const testLimit = this.testLimit ? parseInt(this.testLimit) : 0;
    if (testLimit > 0) {
      this.logger.info(`📋 测试模式：仅处理 ${testLimit} 张图片`);
    }

    try {
      // 1. 内存映射法：一次性读取所有案件数据到Map
      this.logger.info('🔄 正在预加载案件数据...');
      const cases = await db.from('missing_persons_cases').select('case_id', 'case_html');
      const caseMap = new Map(cases.map(c => [c.case_id, c.case_html]));
      this.logger.info(`✅ 成功加载 ${caseMap.size} 条案件数据`);

      // 2. 分页处理所有待备份图片
      let processedCount = 0;
      let successCount = 0;
      let failedCount = 0;
      let lastId = 0; // 索引游标：记录最后处理的记录ID
      let currentPage = 0; // 当前页码
      let isFirstImage = true;  // 用于标记第一张图片，添加详细日志
      
      while (true) {
        // 获取当前批次的实际限制：应用测试限制
        let currentLimit = batchSize;
        if (testLimit > 0 && testLimit - processedCount < batchSize) {
          currentLimit = testLimit - processedCount;
        }
        
        currentPage++;
        // 获取当前页的待备份图片（单表查询）
        this.logger.info(`🔍 开始查询数据库 - 第 ${currentPage} 页，每页 ${currentLimit} 条记录`);
        this.logger.info(`📝 查询条件: hf_backup_status = 0, id > ${lastId}`);
        
        try {
          // 单表查询：使用索引游标和状态索引
          const images = await db
            .from('missing_persons_assets')
            .where('hf_backup_status', 0) // 0表示未备份
            .where('id', '>', lastId) // 使用ID游标，性能极佳
            .orderBy('id', 'asc') // 确保顺序一致
            .limit(currentLimit)
            .select(
              'id', 
              'case_id',
              'storage_path', 
              'hf_path',
              'original_filename'
            );
          
          this.logger.info(`✅ 数据库查询完成，找到 ${images.length} 条记录`);
          
          if (images.length > 0) {
            this.logger.info(`📋 第一条记录ID: ${images[0].id}`);
            this.logger.info(`📁 第一条记录存储路径: ${images[0].storage_path}`);
          }
          
          if (images.length === 0) break; // 没有更多记录，结束循环
          
          this.logger.info(`📦 正在处理图片：${images.length} 张，从ID ${lastId} 开始`);
          
          // 3. 批量处理当前页图片
          const hfQueue: { file: HfFile; imageId: number }[] = [];
          const processingFailIds: number[] = [];
          
          for (const image of images) {
            try {
              // 使用 storage_path 作为 hf_path，如果 hf_path 为空
              const hfPath = image.hf_path || image.storage_path;
              // 减少日志密度，仅在第一张或每10张图片打印一次
              if (isFirstImage || (processedCount + hfQueue.length + 1) % 10 === 0) {
                this.logger.info(`🔍 正在准备: ${image.storage_path}`);
              }
              
              // 内存映射：直接从Map获取case_html，无需Join查询
              const caseHtml = caseMap.get(image.case_id);
              if (!caseHtml) {
                throw new Error(`未找到案件ID ${image.case_id} 对应的HTML内容`);
              }
              
              // 从case_html中提取原始图片URL
              const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
              const matches = [...(caseHtml.matchAll(imgRegex) || [])];
              
              if (matches.length === 0) {
                throw new Error(`在HTML中未找到任何图片标签`);
              }
              
              // 找到与当前图片对应的原始URL
              let originalImageUrl = '';
              for (const match of matches) {
                const url = match[1];
                const filename = url.split('/').pop();
                if (filename === image.original_filename) {
                  originalImageUrl = url;
                  break;
                }
              }
              
              if (!originalImageUrl) {
                throw new Error(`未找到与 ${image.original_filename} 对应的原始图片URL`);
              }
              
              // 使用 images.weserv.nl 服务获取webp格式的图片
              const weservUrl = `https://images.weserv.nl/?url=${encodeURIComponent(originalImageUrl)}&output=webp&q=80`;
              
              // 第一张图片添加详细日志
              if (isFirstImage) {
                this.logger.info(`📷 第一张图片 - 原始URL: ${originalImageUrl}`);
                this.logger.info(`🔄 转换URL: ${weservUrl}`);
              }
              
              // 从images.weserv.nl下载图片
              const response = await axios.get(weservUrl, { responseType: 'arraybuffer' });
              
              // 第一张图片添加下载结果日志
              if (isFirstImage) {
                this.logger.info(`📥 下载响应状态: ${response.status}`);
                this.logger.info(`📦 响应数据类型: ${typeof response.data}`);
                this.logger.info(`📊 响应数据大小: ${response.data.length} 字节`);
              }
              
              const buffer = Buffer.from(response.data);
              
              // 第一张图片添加内存处理日志
              if (isFirstImage) {
                this.logger.info(`💾 Buffer大小: ${buffer.length} 字节`);
                this.logger.info(`🔄 Buffer转Blob...`);
              }
              
              // 添加到HF上传队列，同时记录图片ID
              hfQueue.push({
                file: {
                  path: hfPath,
                  content: new Blob([buffer])
                },
                imageId: image.id
              });
              
              // 第一张图片添加队列状态日志
              if (isFirstImage) {
                this.logger.info(`✅ 图片已成功加入HF上传队列`);
                this.logger.info(`📋 HF队列当前长度: ${hfQueue.length}`);
                this.logger.info(`📁 上传路径: ${hfPath}`);
                isFirstImage = false;  // 重置标志，只对第一张图片显示详细日志
              }
              
              // 减少日志密度
              if (isFirstImage || (processedCount + hfQueue.length) % 10 === 0) {
                this.logger.success(`   └─ ✅ 已准备好上传`);
              }
              
            } catch (imageError) {
              // 保留错误日志
              this.logger.error(`   └─ ❌ 准备失败: ${imageError.message}`);
              processingFailIds.push(image.id);
            }
          }
          
          // 批量更新预处理失败的图片状态
          if (processingFailIds.length > 0) {
            this.logger.info(`📝 正在批量更新 ${processingFailIds.length} 张预处理失败的图片状态`);
            await db.from('missing_persons_assets')
              .whereIn('id', processingFailIds)
              .update({ hf_backup_status: 2 }); // 2表示下载失败
            failedCount += processingFailIds.length;
          }
          
          // 4. 批量上传到HF
          const uploadSuccessIds: number[] = [];
          const uploadFailIds: number[] = [];
          
          if (hfQueue.length > 0) {
            let uploadSuccess = false;
            let retryCount = 0;
            
            while (retryCount < maxRetries && !uploadSuccess) {
              try {
                this.logger.info(`📤 正在上传 ${hfQueue.length} 张图片到 Hugging Face... (尝试 ${retryCount + 1}/${maxRetries})`);
                
                const commitMsg = `Batch ${currentPage}: ${hfQueue.length} images backup`;
                this.logger.info(`📝 提交信息: ${commitMsg}`);
                this.logger.info(`🚀 开始调用HfService.batchUpload...`);
                
                const result = await HfService.batchUpload(hfQueue.map(item => item.file), commitMsg);
                
                if (result === true) {
                  uploadSuccess = true;
                  this.logger.success(`✨ 批次 ${currentPage} 上传成功！`);
                  
                  // 收集上传成功的ID
                  uploadSuccessIds.push(...hfQueue.map(item => item.imageId));
                } else {
                  uploadSuccess = false;
                  this.logger.error(`❌ 批次 ${currentPage} 上传失败！`);
                  
                  // 收集上传失败的ID
                  uploadFailIds.push(...hfQueue.map(item => item.imageId));
                }
                
              } catch (uploadError) {
                retryCount++;
                this.logger.error(`🚨 上传失败 (${retryCount}/${maxRetries}): ${uploadError.message}`);
                
                if (retryCount < maxRetries) {
                  this.logger.info(`⏳ ${retryDelay / 1000}秒后重试...`);
                  await new Promise(resolve => setTimeout(resolve, retryDelay));
                } else {
                  this.logger.error(`❌ 批次上传最终失败，已达到最大重试次数`);
                  // 收集上传失败的ID
                  uploadFailIds.push(...hfQueue.map(item => item.imageId));
                }
              }
            }
          }
          
          // 批量更新上传成功的图片状态
          if (uploadSuccessIds.length > 0) {
            this.logger.info(`📝 正在批量更新 ${uploadSuccessIds.length} 张上传成功的图片状态`);
            await db.from('missing_persons_assets')
              .whereIn('id', uploadSuccessIds)
              .update({ hf_backup_status: 1 }); // 1表示备份成功
            successCount += uploadSuccessIds.length;
          }
          
          // 批量更新上传失败的图片状态
          if (uploadFailIds.length > 0) {
            this.logger.info(`📝 正在批量更新 ${uploadFailIds.length} 张上传失败的图片状态`);
            await db.from('missing_persons_assets')
              .whereIn('id', uploadFailIds)
              .update({ hf_backup_status: 2 }); // 2表示上传失败
            failedCount += uploadFailIds.length;
          }
          
          // 更新最后处理的ID
          lastId = images[images.length - 1].id;
          processedCount += images.length;
          
          // 检查是否达到测试限制
          if (testLimit > 0 && processedCount >= testLimit) {
            this.logger.info(`📋 已达到测试限制（${testLimit}张图片），提前结束处理`);
            break;
          }
          
          // 批次之间休息500毫秒，避免服务器负载过高
          await new Promise(resolve => setTimeout(resolve, 500));
          
        } catch (dbError) {
          this.logger.error(`🚨 数据库查询失败: ${dbError.message}`);
          console.error(dbError.stack);
          break;
        }
      }

      // 5. 显示最终统计
      this.logger.info('======================================');
      this.logger.success(`✨ 备份完成：`);
      this.logger.info(`   - 处理图片总数：${processedCount} 张`);
      this.logger.info(`   - 成功备份：${successCount} 张`);
      this.logger.info(`   - 备份失败：${failedCount} 张`);
      this.logger.info('======================================');
      this.logger.info('💡 提示：可再次运行此命令继续备份失败的图片');
      this.logger.info('💡 失败的图片可通过 hf_backup_status = 2 进行查询');

    } catch (error) {
      this.logger.error(`🚨 运行出错: ${error.message}`);
      console.error(error.stack);
    }
  }
  
  // 移除getStats方法，不再需要统计查询
}