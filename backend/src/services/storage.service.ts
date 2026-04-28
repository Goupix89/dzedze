import * as Minio from 'minio';
import { logger } from '../utils/logger';

const client = new Minio.Client({
  endPoint: process.env.MINIO_ENDPOINT || 'localhost',
  port: parseInt(process.env.MINIO_PORT || '9000'),
  useSSL: process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY!,
  secretKey: process.env.MINIO_SECRET_KEY!,
});

const BUCKET = process.env.MINIO_BUCKET || 'cleaning-supervision';

export async function initializeStorage() {
  const exists = await client.bucketExists(BUCKET);
  if (!exists) {
    await client.makeBucket(BUCKET, 'eu-west-1');
    // Set bucket lifecycle: auto-delete after 30 days
    await client.setBucketLifecycle(BUCKET, {
      Rule: [{
        ID: 'auto-expire',
        Status: 'Enabled',
        Expiration: { Days: 30 },
      }],
    });
    logger.info(`Created bucket: ${BUCKET}`);
  }
}

export class StorageService {
  static async upload(data: Buffer, key: string, contentType: string): Promise<void> {
    await client.putObject(BUCKET, key, data, data.length, {
      'Content-Type': contentType,
      'X-Amz-Server-Side-Encryption': 'AES256',
    });
  }

  static async download(key: string): Promise<Buffer> {
    const stream = await client.getObject(BUCKET, key);
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  }

  static async delete(key: string): Promise<void> {
    await client.removeObject(BUCKET, key);
  }

  static async getPresignedUrl(key: string, expirySeconds = 900): Promise<string> {
    return client.presignedGetObject(BUCKET, key, expirySeconds);
  }

  static async getUploadUrl(key: string, expirySeconds = 300): Promise<string> {
    return client.presignedPutObject(BUCKET, key, expirySeconds);
  }
}
