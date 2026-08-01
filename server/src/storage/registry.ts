import path from 'node:path';
import type { AppEnv } from '../config/env';
import { LocalFileStorageAdapter } from './local';
import type { FileStorageAdapter } from './types';
import { S3FileStorageAdapter } from './s3';

export function createFileStorage(config: AppEnv): FileStorageAdapter {
  if (config.STORAGE_DRIVER === 'local') {
    return new LocalFileStorageAdapter(
      path.resolve(process.cwd(), config.LOCAL_UPLOAD_DIR),
      config.PUBLIC_API_URL,
    );
  }
  return new S3FileStorageAdapter({
    region: config.S3_REGION!,
    bucket: config.S3_BUCKET!,
    publicUrl: config.S3_PUBLIC_URL!,
    endpoint: config.S3_ENDPOINT,
    accessKeyId: config.S3_ACCESS_KEY_ID,
    secretAccessKey: config.S3_SECRET_ACCESS_KEY,
    forcePathStyle: config.S3_FORCE_PATH_STYLE,
  });
}
