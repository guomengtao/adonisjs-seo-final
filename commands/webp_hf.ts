import { BaseCommand } from '@adonisjs/core/ace';
import db from '@adonisjs/lucid/services/db';
import HfService, { HfFile } from '#services/hf_service';
import axios from 'axios';

export default class WebpHfUpload extends BaseCommand {
  static commandName = 'webp:hf';
  static options = { startApp: true };

  async run() {
    this.logger.info('🚀 启动全量修复备份 (状态0+状态2)...');
    
    // 配置参数
    const batchSize = 5;  // 每次处理5个案件，保证数据库连接稳定
    const maxRetries = 3;  // 最大重试次数
    const retryDelay = 5000; // 重试延迟5秒

    try {
      // 1. 获取统计信息
      const stats = await this.getStats();
      this.logger.info(`📊 需要修复的图片: ${stats.total} 张`);
      this.logger.info(`📊 待处理状态0: ${stats.pending} 张`);
      this.logger.info(`📊 失败状态2: ${stats.failed} 张`);
      
      if (stats.total === 0) {
        this.logger.success('✅ 没有需要修复的图片！');
        return;
      }

      // 2. 分页处理案件（按案件分组，避免大量单次查询）
      let processedCases = 0;
      let totalImages = 0;
      let successImages = 0;
      let failedImages = 0;
      let currentPage = 0;
      
      while (processedCases < stats.uniqueCases) {
        // 获取当前页的案件ID列表
        const uniqueCases = await db
          .from('missing_persons_assets')
          .whereIn('hf_backup_status', [0, 2])
          .distinct('case_id')
          .limit(batchSize)
          .offset(currentPage * batchSize)
          .select('case_id');

        if (uniqueCases.length === 0) break;

        this.logger.info(`📦 正在处理批次 ${currentPage + 1}：${uniqueCases.length} 个案件`);
        
        // 处理每个案件
        for (const caseObj of uniqueCases) {
          const caseId = caseObj.case_id;
          this.logger.info(`🔍 正在处理案件: ${caseId}`);
          
          try {
            // 获取案件的HTML内容
            const caseData = await db.from('missing_persons_cases')
              .where('case_id', caseId)
              .select('case_html')
              .first();

            if (!caseData || !caseData.case_html) {
              this.logger.error(`❌ 案件 ${caseId}: 找不到HTML内容`);
              // 标记该案件的所有图片为永久失败
              await db.from('missing_persons_assets')
                .where('case_id', caseId)
                .whereIn('hf_backup_status', [0, 2])
                .update({ hf_backup_status: 3 });
              continue;
            }

            // 获取该案件需要修复的图片
            const images = await db.from('missing_persons_assets')
              .where('case_id', caseId)
              .whereIn('hf_backup_status', [0, 2])
              .select('id', 'storage_path', 'hf_path', 'original_filename');

            this.logger.info(`   └─ 找到 ${images.length} 张需要修复的图片`);
            totalImages += images.length;

            // 处理该案件的所有图片
            for (const image of images) {
              let retryCount = 0;
              let imageSuccess = false;
              
              while (retryCount < maxRetries && !imageSuccess) {
                try {
                  this.logger.info(`   📷 正在修复: ${image.original_filename}`);
                  
                  // 从case_html中提取原始图片URL
                  const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
                  const matches = [...caseData.case_html.matchAll(imgRegex)];
                  
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
                  this.logger.info(`   🔄 转换URL: ${weservUrl}`);
                  
                  const response = await axios.get(weservUrl, {
                    responseType: 'arraybuffer',
                    timeout: 30000 // 增加超时时间到30秒
                  });
                  
                  this.logger.info(`   📥 下载响应状态: ${response.status}`);
                  this.logger.info(`   📊 响应数据大小: ${response.data.length} 字节`);
                  
                  // 使用Blob传递内容，确保HF API接受
                  const buffer = Buffer.from(response.data);
                  const blob = new Blob([buffer]); // 创建Blob对象
                  const hfPath = image.hf_path || image.storage_path;
                  
                  // 上传到HF
                  const uploadSuccess = await this.uploadToHF([{
                    path: hfPath,
                    content: blob
                  }], `Repair image ${image.original_filename}`);
                  
                  if (uploadSuccess) {
                    // 更新图片状态为成功
                    await db.from('missing_persons_assets')
                      .where('id', image.id)
                      .update({ hf_backup_status: 1 });
                    
                    this.logger.success(`   ✅ 图片 ${image.original_filename} 修复成功！`);
                    imageSuccess = true;
                    successImages++;
                  } else {
                    throw new Error('HF上传失败');
                  }
                  
                } catch (imageError) {
                  retryCount++;
                  this.logger.error(`   ❌ 图片 ${image.original_filename} 失败 (${retryCount}/${maxRetries}): ${imageError.message}`);
                  
                  if (retryCount >= maxRetries) {
                    this.logger.error(`   ❌ 图片 ${image.original_filename} 最终失败，已达到最大重试次数`);
                    // 标记为失败状态
                    await db.from('missing_persons_assets')
                      .where('id', image.id)
                      .update({ hf_backup_status: 2 });
                    failedImages++;
                  } else {
                    this.logger.info(`   ⏳ ${retryDelay / 1000}秒后重试...`);
                    await new Promise(resolve => setTimeout(resolve, retryDelay));
                  }
                }
              }
            }
            
            processedCases++;
            
          } catch (caseError) {
            this.logger.error(`❌ 案件 ${caseId} 处理失败: ${caseError.message}`);
            // 标记该案件的所有图片为失败
            await db.from('missing_persons_assets')
              .where('case_id', caseId)
              .whereIn('hf_backup_status', [0, 2])
              .update({ hf_backup_status: 2 });
            failedImages++;
          }
        }
        
        currentPage++;
        
        // 批次之间休息1秒
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // 3. 显示最终统计
      this.logger.info('======================================');
      this.logger.success(`✨ 修复完成：`);
      this.logger.info(`   - 处理案件：${processedCases} 个`);
      this.logger.info(`   - 总图片数：${totalImages} 张`);
      this.logger.info(`   - 成功修复：${successImages} 张`);
      this.logger.info(`   - 修复失败：${failedImages} 张`);
      this.logger.info('======================================');
      this.logger.info('💡 提示：可再次运行此命令继续修复失败的图片');

    } catch (error) {
      this.logger.error(`🚨 运行出错: ${error.message}`);
      console.error(error.stack);
    }
  }

  // 获取统计信息
  async getStats() {
    // 获取总数
    const total = await db.from('missing_persons_assets')
      .whereIn('hf_backup_status', [0, 2])
      .count('id as total')
      .first();
    
    // 获取待处理数量
    const pending = await db.from('missing_persons_assets')
      .where('hf_backup_status', 0)
      .count('id as pending')
      .first();
    
    // 获取失败数量
    const failed = await db.from('missing_persons_assets')
      .where('hf_backup_status', 2)
      .count('id as failed')
      .first();
    
    // 获取唯一案件数
    const uniqueCases = await db.from('missing_persons_assets')
      .whereIn('hf_backup_status', [0, 2])
      .distinct('case_id')
      .count('case_id as uniqueCases')
      .first();

    return {
      total: parseInt(total?.total || '0'),
      pending: parseInt(pending?.pending || '0'),
      failed: parseInt(failed?.failed || '0'),
      uniqueCases: parseInt(uniqueCases?.uniqueCases || '0')
    };
  }

  // 上传到HF的方法
  async uploadToHF(files: HfFile[], commitMessage: string) {
    try {
      await HfService.batchUpload(files, commitMessage);
      return true;
    } catch (error) {
      this.logger.error(`   🚨 HF上传失败: ${error}`);
      return false;
    }
  }
}