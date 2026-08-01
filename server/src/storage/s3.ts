import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { FileStorageAdapter, StoredObjectInput } from './types';

export interface S3StorageOptions {
  region: string;
  bucket: string;
  publicUrl: string;
  endpoint?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  forcePathStyle?: boolean;
}

function validateKey(key: string) {
  if (!key || key.includes('\\') || key.startsWith('/') || key.split('/').some((part) => !part || part === '.' || part === '..')) {
    throw new Error('Invalid storage key');
  }
}

export class S3FileStorageAdapter implements FileStorageAdapter {
  private readonly client: S3Client;

  constructor(private readonly options: S3StorageOptions) {
    this.client = new S3Client({
      region: options.region,
      endpoint: options.endpoint,
      forcePathStyle: options.forcePathStyle,
      credentials: options.accessKeyId && options.secretAccessKey ? {
        accessKeyId: options.accessKeyId,
        secretAccessKey: options.secretAccessKey,
      } : undefined,
    });
  }

  async put({ key, data, contentType }: StoredObjectInput): Promise<void> {
    validateKey(key);
    await this.client.send(new PutObjectCommand({
      Bucket: this.options.bucket,
      Key: key,
      Body: data,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000, immutable',
    }));
  }

  async delete(key: string): Promise<void> {
    validateKey(key);
    await this.client.send(new DeleteObjectCommand({ Bucket: this.options.bucket, Key: key }));
  }

  getPublicUrl(key: string): string {
    validateKey(key);
    const encoded = key.split('/').map(encodeURIComponent).join('/');
    return `${this.options.publicUrl.replace(/\/$/, '')}/${encoded}`;
  }
}
