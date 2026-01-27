import { commit } from '@huggingface/hub';
import * as hub from '@huggingface/hub';

// 查看模块信息
console.log('All exports:', Object.keys(hub));

// 查看commit函数的基本信息
console.log('Commit function exists:', typeof commit === 'function');

// 如果有uploadFilesWithProgress也查看
if (hub.uploadFilesWithProgress) {
  console.log('uploadFilesWithProgress exists:', typeof hub.uploadFilesWithProgress === 'function');
}

// 查看上传相关的API
const uploadApis = Object.keys(hub).filter(key => key.toLowerCase().includes('upload'));
console.log('Upload related APIs:', uploadApis);