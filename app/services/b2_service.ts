import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import env from '#start/env'

class B2Service {
  private client: S3Client

  constructor() {
    // 确保从 .env 读取的是完整的 https://... 链接
    const endpoint = env.get('B2_ENDPOINT') 
    
    this.client = new S3Client({
      endpoint: endpoint, 
      region: env.get('B2_REGION') || 'us-east-005',
      credentials: {
        accessKeyId: env.get('B2_ACCESS_KEY_ID')!,
        secretAccessKey: env.get('B2_SECRET_ACCESS_KEY')!,
      },
      // 关键配置：强制使用路径风格访问（B2 兼容性更好）
      forcePathStyle: true, 
    })
  }

  async upload(buffer: Buffer, key: string) {
    const bucketName = env.get('B2_BUCKET_NAME')

    await this.client.send(new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: buffer,
      ContentType: 'image/webp',
    }))

    // 返回链接：endpoint/bucket/key
    const rawEndpoint = env.get('B2_ENDPOINT')
    return `${rawEndpoint}/${bucketName}/${key}`
  }

  async download(key: string): Promise<Buffer> {
    const bucketName = env.get('B2_BUCKET_NAME')

    const response = await this.client.send(new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    }))

    // 将 response.Body 转换为 Buffer
    if (!response.Body) {
      throw new Error(`No content returned for key: ${key}`)
    }

    const chunks: Buffer[] = []
    for await (const chunk of response.Body as any) {
      chunks.push(chunk)
    }

    return Buffer.concat(chunks)
  }
}

export default new B2Service()