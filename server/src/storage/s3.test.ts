import { describe, expect, it } from 'vitest';
import { S3FileStorageAdapter } from './s3';

describe('S3FileStorageAdapter', () => {
  const storage = new S3FileStorageAdapter({
    region: 'auto', bucket: 'images', publicUrl: 'https://cdn.example.com/',
    endpoint: 'https://storage.example.com', accessKeyId: 'test', secretAccessKey: 'test',
  });

  it('builds an encoded public URL and rejects unsafe keys', () => {
    expect(storage.getPublicUrl('products/seller/a b.webp'))
      .toBe('https://cdn.example.com/products/seller/a%20b.webp');
    expect(() => storage.getPublicUrl('../secret')).toThrow('Invalid storage key');
  });
});
